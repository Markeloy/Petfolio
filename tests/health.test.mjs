import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHealth,parseWeight,pageIndex } from '../lib/health/validation.ts';
import { dueDate } from '../lib/health/types.ts';
const form=(values)=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;};
const event={kind:'vaccination',title:'Ежегодная вакцинация',event_on:'2026-09-08',status:'completed'};
test('all health categories, optional fields and date rules',()=>{
  for(const kind of ['vaccination','parasite','visit','symptom','other'])assert.equal(parseHealth(form({...event,kind}),'2026-09-08').kind,kind);
  assert.equal(parseHealth(form(event),'2026-09-08').next_due_on,null);
  assert.equal(parseHealth(form({...event,event_on:'2027-01-01',status:'planned'}),'2026-09-08').status,'planned');
  for(const change of [{title:' '},{kind:'bad'},{status:'bad'},{event_on:'2026-02-30'},{event_on:'2026-09-09'},{next_due_on:'2026-09-07'},{notes:'a'.repeat(5001)}])
    assert.throws(()=>parseHealth(form({...event,...change}),'2026-09-08'));
});
test('reminders distinguish planned, repeated, cancelled and archived events',()=>{
  const row={...event,next_due_on:'2027-09-08',archived_at:null};
  assert.equal(dueDate(row),'2027-09-08');assert.equal(dueDate({...row,status:'planned'}),'2026-09-08');
  assert.equal(dueDate({...row,status:'cancelled'}),null);assert.equal(dueDate({...row,archived_at:'2026-09-08'}),null);
});
test('weight accepts comma decimals and rejects invalid measurements',()=>{
  const values={weight_kg:'4,125',measured_at:'2026-09-08T12:30'};
  assert.equal(parseWeight(form(values)).weight_kg,4.125);
  for(const change of [{weight_kg:''},{weight_kg:'0'},{weight_kg:'NaN'},{weight_kg:'-1'},{weight_kg:'5001'},{measured_at:'2026-02-30T12:30'},{measured_at:'2026-09-08T25:00'}])
    assert.throws(()=>parseWeight(form({...values,...change})));
});
test('pagination bounds malformed queries',()=>{
  for(const v of [undefined,'-1','Infinity','bad'])assert.equal(pageIndex(v),0);
  assert.equal(pageIndex('2.9'),2);assert.equal(pageIndex('9999999999'),100000);
});
