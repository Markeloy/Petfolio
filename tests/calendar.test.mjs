import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { calendarDate, monthDays } from '../lib/calendar/dates.ts';
import { occurrencesInDay } from '../lib/medications/schedule.ts';
// Transpile only the loader to resolve Next's aliases in Node's test runner.
let source = await readFile(new URL('../lib/calendar/data.ts', import.meta.url), 'utf8');
for (const path of ['medications/schedule', 'health/types']) source = source.replace(`@/lib/${path}`, new URL(`../lib/${path}.ts`, import.meta.url).href);
const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {calendarEntries, allPages} = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const schedule = {id:'s',medication_id:'m',schedule_type:'daily_time',scheduled_time:'00:30',days_of_week:[1,2,3,4,5,6,7],timezone:'Asia/Tokyo',active_from:'2026-01-01',active_until:null,is_active:true};
const medication = {id:'m',pet_id:'p',name:'Medicine',starts_on:'2026-01-01',ends_on:null,status:'active',dose_amount:1,dose_unit:'мл'};
test('calendar dates reject malformed queries; month grid handles leap years and Monday start', () => {
  for (const value of ['2026-02-30','x', ['2026-01-01'],'1800-01-01','2101-01-01']) assert.equal(calendarDate(value,'2026-09-08'),'2026-09-08');
  assert.equal(calendarDate('2028-02-29','fallback'),'2028-02-29');
  assert.equal(monthDays('2028-02-29').filter(Boolean).length,29);
  assert.equal(monthDays('2026-06-15')[0],'2026-06-01');
});
test('viewer day includes next local schedule day and handles daylight saving transitions', () => {
  assert.deepEqual(occurrencesInDay(schedule,medication,'2026-09-08','America/Los_Angeles'),['2026-09-08T15:30:00.000Z']);
  assert.deepEqual(occurrencesInDay({...schedule,timezone:'America/New_York',scheduled_time:'02:30'},medication,'2026-03-08','America/New_York'),[]);
  assert.equal(occurrencesInDay({...schedule,timezone:'America/New_York',scheduled_time:'01:30'},medication,'2026-11-01','America/New_York').length,1);
  assert.deepEqual(occurrencesInDay(schedule,{...medication,status:'paused'},'2026-09-08','UTC'),[]);
});
test('paging reads beyond response limits and fails instead of displaying incomplete results', async () => {
  const rows = Array.from({length:1001},(_,i) => i);
  assert.equal((await allPages(async (from,to) => ({data:rows.slice(from,to+1),error:null}))).length,1001);
  await assert.rejects(allPages(async () => ({data:[],error:{message:'offline'}})));
});
function client(tables) {
  return {from(table) {
    const filters=[];
    const query = {
      select(){return this;},order(){return this;},or(){return this;},
      eq(k,v){filters.push(row => row[k]===v);return this;},
      is(k,v){filters.push(row => row[k]===v);return this;},
      in(k,vs){filters.push(row => vs.includes(row[k]));return this;},
      gte(k,v){filters.push(row => row[k]>=v);return this;},
      lt(k,v){filters.push(row => row[k]<v);return this;},
      async range(from,to){return {data:(tables[table]??[]).filter(row=>filters.every(f=>f(row))).slice(from,to+1),error:null};},
    }; return query;
  }};
}
const dose = {id:'d',schedule_id:'s',scheduled_for:'2026-09-08T15:30:00.000Z',status:'given',dose_amount:0.5,dose_unit:'мл'};
test('recorded doses replace projections and retain original dose after course completion', async () => {
  for (const status of ['active','completed','paused']) {
    const entries = await calendarEntries(client({medications:[{...medication,status}],medication_schedules:[schedule],medication_doses:[dose]}),['p'],'2026-09-08','UTC',new Date('2026-09-08T12:00Z'));
    assert.equal(entries.length,1);assert.equal(entries[0].status,'Дано');assert.equal(entries[0].detail,'0,5 мл');
  }
});
test('past unrecorded doses are not invented, today remains unmarked and future is planned', async () => {
  const db=client({medications:[medication],medication_schedules:[schedule]});
  assert.equal((await calendarEntries(db,['p'],'2026-09-07','UTC',new Date('2026-09-08T18:00Z'))).length,0);
  assert.equal((await calendarEntries(db,['p'],'2026-09-08','UTC',new Date('2026-09-08T18:00Z')))[0].status,'Не отмечено');
  assert.equal((await calendarEntries(db,['p'],'2026-09-09','UTC',new Date('2026-09-08T18:00Z')))[0].status,'По расписанию');
});
test('health repeats and original records stay distinct; archives and other pets stay out', async () => {
  const event={id:'h',pet_id:'p',title:'Vaccine',kind:'vaccination',event_on:'2026-09-08',next_due_on:'2026-09-08',status:'completed',archived_at:null};
  const db=client({health_events:[event,{...event,id:'archive',archived_at:'2026-09-08'},{...event,id:'other',pet_id:'other'}]});
  const entries=await calendarEntries(db,['p'],'2026-09-08','UTC');
  assert.equal(entries.length,2);assert.equal(entries.filter(e=>!e.done).length,1);
  assert.equal(new Set(entries.map(e=>e.id)).size,2);
});
