import test from 'node:test';
import assert from 'node:assert/strict';
import { listOptions, pagination, searchPattern } from '../utils/listQuery.js';
import { sessionId } from '../utils/loginSession.js';

test('pagination caps results at ten and calculates stable offsets', () => {
  assert.deepEqual(listOptions({ page: '3', limit: '100' }), { page: 3, limit: 10, from: 20, to: 29, search: '' });
  assert.deepEqual(pagination(listOptions({ page: '2' }), 21), { page: 2, limit: 10, total: 21, totalPages: 3 });
  assert.equal(pagination(listOptions(), 0).totalPages, 0);
});
test('invalid pagination and malformed searches are rejected', () => {
  for (const value of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
    assert.throws(() => listOptions({ page: value }));
    assert.throws(() => listOptions({ limit: value }));
  }
  assert.throws(() => listOptions({ search: {} }));
  assert.throws(() => listOptions({ search: 'x'.repeat(101) }));
});
test('search treats wildcard characters literally', () => {
  assert.equal(searchPattern('a%b_c'), '%a\\%b\\_c%');
});
test('session identity stays the same across refreshed access tokens', () => {
  const token = (payload) => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  assert.equal(sessionId(token({ session_id: 'device-a', exp: 1 })), 'device-a');
  assert.equal(sessionId(token({ session_id: 'device-a', exp: 2 })), 'device-a');
  assert.notEqual(sessionId(token({ session_id: 'device-b' })), 'device-a');
  assert.equal(sessionId('invalid'), null);
  assert.equal(sessionId(token({})), null);
});

// Stub all I/O: no live Supabase calls.
test('login rejects a new session without revoking the existing one; middleware rejects stale tokens', async () => {
  process.env.SUPABASE_URL ||= 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY ||= 'test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';
  const { supabase, supabaseAdmin } = await import('../config/db.js');
  const { login, refresh, logout } = await import('../controllers/AuthController.js');
  const { verifyLoggedIn } = await import('../middleware/verifyLoggedIn.js');
  const token = `header.${Buffer.from(JSON.stringify({ session_id: 'new-session' })).toString('base64url')}.signature`;
  const auth = { user: { id: 'user-id' }, session: { access_token: token } };
  const original = { signIn: supabase.auth.signInWithPassword, getUser: supabase.auth.getUser,
    refresh: supabase.auth.refreshSession, signOut: supabaseAdmin.auth.admin.signOut, from: supabaseAdmin.from, rpc: supabaseAdmin.rpc };
  const revoked = [];
  const updates = [];
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    supabase.auth.signInWithPassword = async () => ({ data: auth });
    supabase.auth.getUser = async () => ({ data: { user: auth.user } });
    supabase.auth.refreshSession = async () => ({ data: auth });
    supabaseAdmin.auth.admin.signOut = async (...args) => { revoked.push(args); return {}; };
    supabaseAdmin.from = (table) => {
      const builder = { select() { return this; }, eq(key, value) { updates.push([key, value]); return this; },
        is() { return this; }, update() { return this; },
        single: async () => ({ data: { nama: 'Test', role: 'Mahasiswa' } }),
        maybeSingle: async () => ({ data: { lastLogin: '2026-10-30', logoutTime: null, sessionId: 'old-session' } }),
        then(resolve) { resolve({}); } };
      return builder;
    };
    supabaseAdmin.rpc = async () => ({ data: false });
    let res = response();
    await login({ body: { email: 'test@example.com', password: 'pass' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'AKUN_SEDANG_LOGIN');
    assert.deepEqual(revoked, [[token, 'local']]);
    res = response();
    await verifyLoggedIn({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('stale session accepted'));
    assert.equal(res.statusCode, 401);
    res = response();
    await refresh({ body: { refresh_token: 'refresh-token' } }, res);
    assert.equal(res.statusCode, 401);
    updates.length = 0;
    await logout({ headers: { authorization: `Bearer ${token}` } }, response());
    assert.ok(updates.some(([key, value]) => key === 'sessionId' && value === 'new-session'));
    supabaseAdmin.rpc = async () => ({ data: true });
    res = response();
    await login({ body: { email: 'test@example.com', password: 'pass' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.token, token);
  } finally {
    supabase.auth.signInWithPassword = original.signIn;
    supabase.auth.getUser = original.getUser;
    supabase.auth.refreshSession = original.refresh;
    supabaseAdmin.auth.admin.signOut = original.signOut;
    supabaseAdmin.from = original.from;
    supabaseAdmin.rpc = original.rpc;
  }
});
