import test from 'node:test';
import assert from 'node:assert/strict';
import { api, authApi, activeAuthSession } from '../src/services/api';

test('Web Smoke Test: API service configuration and endpoints', () => {
  assert.ok(api, 'Axios client instance must exist');
  assert.strictEqual(typeof api.get, 'function', 'api.get must be a function');
  assert.strictEqual(typeof api.post, 'function', 'api.post must be a function');
  assert.ok(authApi, 'authApi service object must exist');
  assert.strictEqual(typeof authApi.sendOtp, 'function', 'authApi.sendOtp must be a function');
  assert.strictEqual(typeof authApi.login, 'function', 'authApi.login must be a function');
});

test('Role tabs select independent access, refresh and CSRF credentials', () => {
  const storage = new Map<string, string>([
    ['annsetu_token', 'farmer-access'],
    ['annsetu_refresh_token', 'farmer-refresh'],
    ['annsetu_csrf_token', 'farmer-csrf'],
    ['annsetu_center_session', JSON.stringify({ token: 'center-access', refreshToken: 'center-refresh', csrfToken: 'center-csrf' })],
    ['annsetu_admin_session', JSON.stringify({ token: 'admin-access', refreshToken: 'admin-refresh', csrfToken: 'admin-csrf' })],
  ]);
  const originalWindow = (globalThis as any).window;
  const originalStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = { getItem: (key: string) => storage.get(key) ?? null };

  try {
    (globalThis as any).window = { location: { pathname: '/farmer/dashboard', search: '' } };
    assert.deepEqual(activeAuthSession(), {
      kind: 'farmer', token: 'farmer-access', refreshToken: 'farmer-refresh', csrfToken: 'farmer-csrf',
    });

    (globalThis as any).window.location.pathname = '/center/dashboard';
    assert.deepEqual(activeAuthSession(), {
      kind: 'center', token: 'center-access', refreshToken: 'center-refresh', csrfToken: 'center-csrf',
    });

    (globalThis as any).window.location.pathname = '/admin';
    assert.deepEqual(activeAuthSession(), {
      kind: 'admin', token: 'admin-access', refreshToken: 'admin-refresh', csrfToken: 'admin-csrf',
    });
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalStorage;
  }
});
