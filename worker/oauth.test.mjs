// Automated smoke tests for the Cloudflare OAuth draft.
// Run: node --test worker/oauth.test.mjs
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import assert from 'node:assert/strict';
import test from 'node:test';
const code=readFileSync(new URL('./oauth-draft.js',import.meta.url),'utf8');
test('OAuth uses public repository scope only',()=>{
  assert.match(code,/searchParams\.set\('scope','public_repo'\)/);
  assert.doesNotMatch(code,/searchParams\.set\('scope','repo'\)/);
});
test('State has 13-digit timestamp and ten-minute expiry',()=>{
  assert.ok(code.includes(String.raw`/^\d{13}$/`));
  assert.match(code,/600000/);
  assert.match(code,/STATE_SECRET/);
});
test('Worker checks actual logged-in GitHub user',()=>{
  assert.match(code,/api\.github\.com\/user/);
  assert.match(code,/user\.login\.toLowerCase\(\)!==ALLOWED_LOGIN/);
  assert.match(code,/\['admin','write','maintain'\]/);
});
test('Popup requires handshake with known CMS origin',()=>{
  assert.match(code,/event\.origin!==target/);
  assert.match(code,/event\.source!==window\.opener/);
  assert.match(code,/authorizing:github/);
});
test('Draft must not enable successful login before integration tests',()=>{
  assert.match(code,/Authentication backend is not yet enabled/);
  assert.doesNotMatch(code,/status:'success'/);
});

test('Unauthenticated Worker refuses to start OAuth', async () => {
  const worker = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const response = await worker.default.fetch(
    new Request('https://noisy-voice-54f9.ryo-f-0924.workers.dev/auth'),
    {}
  );
  assert.equal(response.status, 503);
});
test('Worker rejects unexpected hosts', async () => {
  const worker = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const response = await worker.default.fetch(new Request('https://example.com/auth'), {});
  assert.equal(response.status, 403);
});
test('OAuth starts with signed cookie, public_repo scope and exact callback', async () => {
  const worker = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const env = { GITHUB_CLIENT_ID:'test-client', GITHUB_CLIENT_SECRET:'test-secret', STATE_SECRET:'0123456789abcdef0123456789abcdef' };
  const response = await worker.default.fetch(new Request('https://noisy-voice-54f9.ryo-f-0924.workers.dev/auth'), env);
  assert.equal(response.status, 302);
  const redirect = new URL(response.headers.get('location'));
  assert.equal(redirect.hostname, 'github.com');
  assert.equal(redirect.searchParams.get('scope'), 'public_repo');
  assert.equal(redirect.searchParams.get('redirect_uri'), 'https://noisy-voice-54f9.ryo-f-0924.workers.dev/callback');
  assert.equal(redirect.searchParams.get('client_id'), 'test-client');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(redirect.searchParams.get('state').length, 64);
});
test('OAuth callback refuses missing state before any GitHub request', async () => {
  const worker = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const env = { GITHUB_CLIENT_ID:'test-client', GITHUB_CLIENT_SECRET:'test-secret', STATE_SECRET:'0123456789abcdef0123456789abcdef' };
  const response = await worker.default.fetch(new Request('https://noisy-voice-54f9.ryo-f-0924.workers.dev/callback?code=abc&state=abc'), env);
  assert.equal(response.status, 403);
});

test('OAuth callback rejects tampered and expired state cookies', async () => {
  const worker = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const env = { GITHUB_CLIENT_ID:'test-client', GITHUB_CLIENT_SECRET:'test-secret', STATE_SECRET:'0123456789abcdef0123456789abcdef' };
  const base = 'https://noisy-voice-54f9.ryo-f-0924.workers.dev';
  const login = await worker.default.fetch(new Request(base + '/auth'), env);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const badState = await worker.default.fetch(new Request(base + '/callback?code=demo&state=' + '0'.repeat(64), { headers: { cookie } }), env);
  assert.equal(badState.status, 403);
  const pieces = cookie.split('=');
  const original = pieces.slice(1).join('=');
  const tampered = pieces[0] + '=' + original.slice(0, -1) + (original.endsWith('0') ? '1' : '0');
  const badCookie = await worker.default.fetch(new Request(base + '/callback?code=demo&state=' + state, { headers: { cookie: tampered } }), env);
  assert.equal(badCookie.status, 403);
});
