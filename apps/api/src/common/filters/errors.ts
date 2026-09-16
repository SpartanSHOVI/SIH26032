import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { env } from '../../config/env';

/**
 * Standard HTTP error names by status code.
 */
const STATUS_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

/**
 * Sanitizes error messages to prevent internal database queries, column names,
 * stack traces, or server filesystem paths from leaking to clients.
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An error occurred';
  const lower = msg.toLowerCase();
  if (
    lower.includes('select ') ||
    lower.includes('insert into') ||
    lower.includes('update ') ||
    lower.includes('delete from') ||
    lower.includes('relation "') ||
    lower.includes('column "') ||
    lower.includes('syntax error at or near') ||
    lower.includes('foreign key constraint') ||
    lower.includes('duplicate key value') ||
    lower.includes('prisma') ||
    lower.includes('/users/') ||
    lower.includes('/var/')
  ) {
    return 'A database operational error occurred. Please verify your input parameters.';
  }
  return msg;
}

@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      return;
    }
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorType = 'Internal Server Error';
    let message = 'An unexpected internal error occurred';
    let details: string[] | undefined = undefined;
    let code: string | undefined = undefined;

    if (error instanceof HttpException) {
      status = error.getStatus();
      errorType = STATUS_NAMES[status] || 'Http Exception';
      const rawResponse = error.getResponse();

      if (typeof rawResponse === 'string') {
        message = sanitizeErrorMessage(rawResponse);
      } else if (typeof rawResponse === 'object' && rawResponse !== null) {
        const obj = rawResponse as Record<string, any>;
        if (Array.isArray(obj.message)) {
          details = obj.message.map((m: unknown) => String(m));
          message = details.length > 0 ? details[0] : 'Validation failed';
        } else if (typeof obj.message === 'string') {
          message = sanitizeErrorMessage(obj.message);
        }
        if (obj.error && typeof obj.error === 'string') {
          errorType = obj.error;
        }
        if (obj.code && typeof obj.code === 'string') {
          code = obj.code;
        }
      } else {
        message = sanitizeErrorMessage(error.message);
      }
    } else if (error && typeof error === 'object' && 'name' in error) {
      const errObj = error as { name: string; message: string; code?: string };
      if (errObj.name === 'TokenExpiredError') {
        status = HttpStatus.UNAUTHORIZED;
        errorType = 'Unauthorized';
        message = 'Session has expired. Please sign in again.';
        code = 'TOKEN_EXPIRED';
      } else if (errObj.name === 'JsonWebTokenError') {
        status = HttpStatus.UNAUTHORIZED;
        errorType = 'Unauthorized';
        message = 'Invalid authentication token.';
        code = 'INVALID_TOKEN';
      } else if (errObj.code === 'P2002') {
        // Prisma unique constraint violation
        status = HttpStatus.CONFLICT;
        errorType = 'Conflict';
        message = 'A record with these unique details already exists.';
        code = 'RECORD_ALREADY_EXISTS';
      } else if (errObj.code === 'P2025') {
        // Prisma record not found
        status = HttpStatus.NOT_FOUND;
        errorType = 'Not Found';
        message = 'The requested record was not found.';
        code = 'RECORD_NOT_FOUND';
      } else if (env.NODE_ENV !== 'production' && errObj.message) {
        message = sanitizeErrorMessage(errObj.message);
      }
    }

    const payload = {
      statusCode: status,
      error: errorType,
      message,
      ...(details && details.length > 0 ? { details } : {}),
      ...(code ? { code } : {}),
      path: req?.url || req?.path || '',
      requestId: req?.requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(payload);

    if (status >= 500) {
      const e = error as Record<string, unknown>;
      console.error(
        JSON.stringify({
          event: 'request_failed',
          statusCode: status,
          requestId: req.requestId,
          path: req.url,
          type: error instanceof Error ? error.constructor.name : 'Unknown',
          code: env.NODE_ENV === 'production' ? undefined : e?.code,
          meta: env.NODE_ENV === 'production' ? undefined : e?.meta,
          message:
            env.NODE_ENV === 'production'
              ? undefined
              : error instanceof Error
              ? error.message
              : undefined,
        }),
      );
    }
  }
}

