import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseHousehold,invitationCode} from '../lib/family/selection.ts';
test('family selection honors membership, rejects stale or forged preferences, handles no memberships',()=>{
  const families=[{household_id:'own'},{household_id:'shared'}];
  assert.equal(chooseHousehold(families,'shared').household_id,'shared');
  for(const value of [undefined,'removed','forged'])assert.equal(chooseHousehold(families,value).household_id,'own');
  assert.equal(chooseHousehold([],'own'),null);
});
test('invitation codes normalize paste and reject missing, truncated or malformed codes',()=>{
  assert.equal(invitationCode('  '+'A1'.repeat(24)+'\n'),'a1'.repeat(24));
  for(const value of [null,{},'a'.repeat(47),'a'.repeat(49),'x'.repeat(48),'a'.repeat(24)+' '+'b'.repeat(23)])assert.equal(invitationCode(value),null);
});
