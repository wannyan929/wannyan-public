// Automated smoke tests for the Cloudflare OAuth draft.
// Run: node --test worker/oauth.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const code=readFileSync(new URL('./oauth-draft.js',import.meta.url),'utf8');
test('OAuth uses public repository scope only',()=>{
  assert.match(code,/searchParams\.set\('scope','public_repo'\)/);
  assert.doesNotMatch(code,/searchParams\.set\('scope','repo'\)/);
});
test('State has 13-digit timestamp and ten-minute expiry',()=>{
  assert.match(code,/\^\\d\{13\}\$/);
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
