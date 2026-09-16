import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeXss } from '../src/common/pipes/xss-sanitizer.pipe';
import { Errors } from '../src/common/filters/errors';
import { BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { rows, first } from '../src/infrastructure/database/database.service';

describe('Security, Error Status Codes & Token Refresh Verification', () => {
  describe('1. XSS Input Sanitization', () => {
    test('should strip <script> tags from string input', () => {
      const malicious = '<script>alert("xss")</script>Hello Farmer';
      const clean = sanitizeXss(malicious);
      assert.equal(clean, 'Hello Farmer');
    });

    test('should strip inline javascript: event handlers', () => {
      const malicious = '<img src="x" onerror="alert(1)">Wheat 50kg';
      const clean = sanitizeXss(malicious);
      assert.ok(!String(clean).includes('onerror'));
      assert.ok(!String(clean).includes('alert'));
    });

    test('should recursively sanitize nested objects and arrays', () => {
      const payload = {
        name: 'Ramesh <script>alert(1)</script>',
        crops: ['Wheat <script>xss()</script>', 'Paddy'],
        meta: {
          note: '<iframe src="evil.com"></iframe>Valid Note',
        },
      };
      const sanitized = sanitizeXss(payload) as typeof payload;
      assert.equal(sanitized.name, 'Ramesh ');
      assert.equal(sanitized.crops[0], 'Wheat ');
      assert.equal(sanitized.crops[1], 'Paddy');
      assert.equal(sanitized.meta.note, 'Valid Note');
    });
  });

  describe('2. SQL Injection Prevention', () => {
    test('should block dangerous SQL statement chaining', async () => {
      const dummyClient = {
        $queryRawUnsafe: async () => [],
      } as any;

      await assert.rejects(
        async () => {
          await rows(dummyClient, 'SELECT * FROM users; DROP TABLE users; --', []);
        },
        /Dangerous SQL statement chaining detected/
      );
    });

    test('should detect potential SQL injection in query parameters', async () => {
      const dummyClient = {
        $queryRawUnsafe: async () => [],
      } as any;

      await assert.rejects(
        async () => {
          await rows(dummyClient, 'SELECT * FROM users WHERE login = $1', ["admin' OR '1'='1"]);
        },
        /Potential SQL injection pattern detected/
      );
    });
  });

  describe('3. Error Filter Status Codes & Structured Details', () => {
    const errorFilter = new Errors();

    test('should return structured status code 400 for validation failure', () => {
      let capturedStatus = 0;
      let capturedJson: any = null;

      const mockRes = {
        status: (s: number) => {
          capturedStatus = s;
          return {
            json: (payload: any) => {
              capturedJson = payload;
            },
          };
        },
      };

      const mockReq = {
        url: '/api/v1/auth/register',
        path: '/api/v1/auth/register',
        requestId: 'test-req-123',
      };

      const mockHost = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => mockRes,
          getRequest: () => mockReq,
        }),
      } as any;

      const badReq = new BadRequestException(['mobile must be 10 digits', 'name is required']);
      errorFilter.catch(badReq, mockHost);

      assert.equal(capturedStatus, 400);
      assert.equal(capturedJson.statusCode, 400);
      assert.equal(capturedJson.error, 'Bad Request');
      assert.ok(capturedJson.details.includes('mobile must be 10 digits'));
      assert.equal(capturedJson.requestId, 'test-req-123');
    });

    test('should map token expiration to 401 with TOKEN_EXPIRED code', () => {
      let capturedStatus = 0;
      let capturedJson: any = null;

      const mockRes = {
        status: (s: number) => {
          capturedStatus = s;
          return {
            json: (payload: any) => {
              capturedJson = payload;
            },
          };
        },
      };

      const mockReq = { url: '/api/v1/auth/profile', path: '/api/v1/auth/profile', requestId: 'test-401' };
      const mockHost = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => mockRes,
          getRequest: () => mockReq,
        }),
      } as any;

      const tokenExpiredErr = new Error('jwt expired');
      tokenExpiredErr.name = 'TokenExpiredError';

      errorFilter.catch(tokenExpiredErr, mockHost);

      assert.equal(capturedStatus, 401);
      assert.equal(capturedJson.statusCode, 401);
      assert.equal(capturedJson.code, 'TOKEN_EXPIRED');
      assert.equal(capturedJson.error, 'Unauthorized');
    });

    test('should map rate limit 429 correctly', () => {
      let capturedStatus = 0;
      let capturedJson: any = null;

      const mockRes = {
        status: (s: number) => {
          capturedStatus = s;
          return {
            json: (payload: any) => {
              capturedJson = payload;
            },
          };
        },
      };

      const mockReq = { url: '/api/v1/auth/login', path: '/api/v1/auth/login', requestId: 'test-429' };
      const mockHost = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => mockRes,
          getRequest: () => mockReq,
        }),
      } as any;

      const rateLimitErr = new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Rate limit of 15 requests/min exceeded. Please retry in 60 seconds.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );

      errorFilter.catch(rateLimitErr, mockHost);

      assert.equal(capturedStatus, 429);
      assert.equal(capturedJson.statusCode, 429);
      assert.equal(capturedJson.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(capturedJson.error, 'Too Many Requests');
    });
  });
});
