import {CanActivate,ExecutionContext,ForbiddenException,Inject,Injectable,ServiceUnavailableException,HttpException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {AuthService} from '../../modules/auth/auth.service';
import {RedisService} from '../../infrastructure/redis/redis.service';
import {env} from '../../config/env';
@Injectable() export class AccessGuard implements CanActivate {
  private readonly allowedOrigins = new Set([
    env.APP_ORIGIN,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);

  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AuthService) private auth: AuthService,
    @Inject(RedisService) private redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') {
      return true;
    }
    const res = ctx.switchToHttp().getResponse();
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()]);
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (mutation) {
      const origin = (req.headers.origin || req.headers.referer) as string | undefined;
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const originHost = `${originUrl.protocol}//${originUrl.host}`;
          const isTunnel =
            originUrl.hostname.endsWith('.ngrok-free.app') ||
            originUrl.hostname.endsWith('.ngrok.io') ||
            originUrl.hostname.endsWith('.ngrok.app') ||
            originUrl.hostname.endsWith('.trycloudflare.com') ||
            originUrl.hostname.endsWith('.loca.lt') ||
            originUrl.hostname === 'localhost' ||
            originUrl.hostname === '127.0.0.1';

          if (!this.allowedOrigins.has(originHost) && !this.allowedOrigins.has(origin) && !isTunnel && env.NODE_ENV === 'production') {
            throw new ForbiddenException('CSRF check failed: untrusted request origin');
          }
        } catch (err) {
          if (err instanceof ForbiddenException) throw err;
          if (env.NODE_ENV === 'production') throw new ForbiddenException('CSRF check failed: invalid origin header');
        }
      } else if (!isPublic && env.NODE_ENV === 'production') {
        throw new ForbiddenException('CSRF check failed: origin or referer header required for mutation');
      }
    }

    if (!req.path.includes('/health')) {
      const isAuth = req.path.includes('/auth/');
      const limit = isAuth ? 15 : mutation ? 60 : 300;

      try {
        const count = (await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",
          1,
          `rate:${req.ip}:${isAuth ? 'auth' : mutation ? 'mutation' : 'read'}:${req.path}`,
        )) as number;

        if (res && typeof res.setHeader === 'function') {
          res.setHeader('X-RateLimit-Limit', String(limit));
          res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
        }

        if (count > limit) {
          if (res && typeof res.setHeader === 'function') {
            res.setHeader('Retry-After', '60');
          }
          throw new HttpException(
            {
              statusCode: 429,
              error: 'Too Many Requests',
              message: `Rate limit of ${limit} requests/min exceeded. Please slow down and try again.`,
              code: 'RATE_LIMIT_EXCEEDED',
            },
            429,
          );
        }
      } catch (e) {
        if (e instanceof HttpException) throw e;
        if (env.NODE_ENV === 'production') throw new ServiceUnavailableException('Rate limiter unavailable');
      }
    }

    if (isPublic) return true;

    const authHeader = req.headers.authorization as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    // Explicit Authorization header takes precedence over ambient shared browser cookie
    const token = bearerToken || req.cookies?.annsetu_access;

    const p = await this.auth.authenticate(token);
    req.user = p;

    const isCookieAuth = !bearerToken && !!req.cookies?.annsetu_access;
    if (mutation && (isCookieAuth || req.headers['x-csrf-token'])) {
      await this.auth.csrf(p, String(req.headers['x-csrf-token'] || ''));
    }

    const roles = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(p.role)) throw new ForbiddenException('Role not allowed');
    return true;
  }
}
