import test from 'node:test';
import assert from 'node:assert/strict';
import {safeRedirect} from '../lib/auth/redirect.ts';
const origin = 'https://petfolio.example';
test('confirmation keeps local paths, query and hash', () => {
  for (const input of ['/family?join=1#code', `${origin}/family?join=1#code`])
    assert.equal(safeRedirect(input, origin), '/family?join=1#code');
});
test('confirmation rejects external and normalized cross-origin destinations', () => {
  for (const input of [null, '', '//evil.example', '/\\evil.example', '\\\\evil.example', 'https://evil.example', 'https://petfolio.example@evil.example', 'javascript:alert(1)', 'data:text/html,test', '//\tevil.example'])
    assert.equal(safeRedirect(input, origin), '/onboarding/pet', String(input));
});
