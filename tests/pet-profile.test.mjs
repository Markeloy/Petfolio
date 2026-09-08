import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePetProfile} from '../lib/pets/validation.ts';
function form(values={}){const f=new FormData();for(const [k,v] of Object.entries({name:' Барсик ',species:'cat',sex:'male',...values}))f.set(k,v);return f;}
test('pet profile trims fields and supports clearing optional values',()=>{
  const p=parsePetProfile(form({birth_date:'2024-02-29',breed:'  '}),'2026-09-08');
  assert.equal(p.name,'Барсик');assert.equal(p.breed,null);assert.equal(p.birth_date,'2024-02-29');
});
test('pet profile rejects invalid/future dates and invalid identity fields',()=>{
  for(const values of [{name:' '},{name:'x'.repeat(101)},{birth_date:'2026-02-30'},{birth_date:'2026-09-09'},{species:'forged'},{sex:'forged'},{notes:'x'.repeat(5001)}])assert.throws(()=>parsePetProfile(form(values),'2026-09-08'));
});
