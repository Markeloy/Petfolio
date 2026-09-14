import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate, parseMedicationEdit } from '../lib/medications/edit-validation.ts';
function form(values={}) { const f=new FormData(); for(const [k,v] of Object.entries({name:'Курс',startsOn:'2026-09-07',doseAmount:'1,5',...values})) f.set(k,v); return f; }
test('real calendar dates and leap years',()=>{
  assert.equal(validDate('2026-02-30'),false); assert.equal(validDate('2024-02-29'),true);
  assert.equal(validDate('2026-02-29'),false); assert.equal(validDate('bad'),false);
});
test('valid edit parses decimals and nullable fields',()=>{
  const result=parseMedicationEdit(form()); assert.equal(result.dose_amount,1.5); assert.equal(result.ends_on,null);
  assert.equal(parseMedicationEdit(form({doseAmount:''})).dose_amount,null);
});
test('invalid edits rejected before writes',()=>{
  for(const values of [{name:' '},{endsOn:'2026-09-06'},{startsOn:'2026-02-30'},{doseAmount:'-1'},{doseAmount:'Infinity'},{doseAmount:'10000000'}])
    assert.throws(()=>parseMedicationEdit(form(values)));
});
