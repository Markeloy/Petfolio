import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let source=await readFile(new URL('../lib/feeding/schedule.ts',import.meta.url),'utf8');
source=source.replace('@/lib/medications/schedule',new URL('../lib/medications/schedule.ts',import.meta.url).href);
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {feedingOn}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const asModule=text=>`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
let server=await readFile(new URL('../lib/feeding/server.ts',import.meta.url),'utf8');
const imports={
  'react':import.meta.resolve('react'),
  'next/navigation':asModule('export function notFound(){throw Error("not used")}'),
  '@/lib/health/server':asModule('export function healthContext(){throw Error("not used")}'),
  '@/lib/calendar/data':asModule('export async function allPages(query){const r=await query(0,499);if(r.error)throw Error("query failed");return r.data??[]}'),
  '@/lib/medications/schedule':new URL('../lib/medications/schedule.ts',import.meta.url).href,
  '@/lib/stock/types':new URL('../lib/stock/types.ts',import.meta.url).href,
  './schedule':asModule(code),
};
for(const [path,url] of Object.entries(imports))server=server.replace(`'${path}'`,`'${url}'`);
const serverCode=ts.transpileModule(server,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {feedingCalendar,feedingReminders}=await import(asModule(serverCode));
function client(tables) {
  return {from(table) {
    const filters=[];
    return {
      select(){return this;},order(){return this;},
      eq(k,v){filters.push(row=>row[k]===v);return this;},
      is(k,v){filters.push(row=>row[k]===v);return this;},
      gte(k,v){filters.push(row=>row[k]>=v);return this;},
      gt(k,v){filters.push(row=>row[k]>v);return this;},
      lt(k,v){filters.push(row=>row[k]<v);return this;},
      async range(from,to){return {data:(tables[table]??[]).filter(row=>filters.every(f=>f(row))).slice(from,to+1),error:null};},
    };
  }};
}
const plan={scheduled_time:'08:00:00',timezone:'Europe/Moscow',active_from:'2026-09-08',active_until:null,archived_at:null};
test('feeding version boundaries retain today and activate revision tomorrow',()=>{
  assert.equal(feedingOn({...plan,active_until:'2026-09-08'},'2026-09-08'),'2026-09-08T05:00:00.000Z');
  assert.equal(feedingOn({...plan,active_until:'2026-09-08'},'2026-09-09'),null);
  assert.equal(feedingOn({...plan,active_from:'2026-09-09'},'2026-09-08'),null);
  assert.equal(feedingOn({...plan,archived_at:'2026-09-08'},'2026-09-08'),null);
});
test('feeding timezone and daylight saving match calendar policy',()=>{
  assert.equal(feedingOn({...plan,scheduled_time:'00:30:00',timezone:'Asia/Tokyo'},'2026-09-08'),'2026-09-07T15:30:00.000Z');
  const dst={...plan,timezone:'America/New_York',active_from:'2026-01-01',scheduled_time:'02:30:00'};
  assert.equal(feedingOn(dst,'2026-03-08'),null);
  assert.equal(feedingOn({...dst,scheduled_time:'01:30:00'},'2026-11-01'),'2026-11-01T05:30:00.000Z');
});
test('calendar replaces projected feeding with its recorded snapshot and retains archived history',async()=>{
  const entry={...plan,id:'plan',pet_id:'pet',food:'Food',amount:50,unit:'г'};
  const log={id:'log',plan_id:'plan',pet_id:'pet',planned_on:'2026-09-08',scheduled_for:'2026-09-08T05:00:00.000Z',status:'fed',food:'Previous food',amount:25,unit:'г'};
  for(const archived_at of [null,'2026-09-08']){
    const data=await feedingCalendar(client({feeding_plans:[{...entry,archived_at}],feeding_logs:[log]}),['pet'],'2026-09-08','UTC',new Date('2026-09-08T01:00Z'));
    assert.equal(data.length,1);assert.equal(data[0].title,'Previous food');assert.equal(data[0].status,'Покормил');assert.match(data[0].detail,/25 г/);
  }
});
test('nearest feeding reminder skips a future marked feeding and selects tomorrow',async()=>{
  const entry={...plan,id:'plan',pet_id:'pet',food:'Food',amount:50,unit:'г'};
  const db=client({feeding_plans:[entry],feeding_logs:[{plan_id:'plan',pet_id:'pet',planned_on:'2026-09-08',scheduled_for:'2026-09-08T05:00:00.000Z'}]});
  const result=await feedingReminders(db,['pet'],new Date('2026-09-08T01:00Z'));
  assert.equal(result.get('pet').instant,'2026-09-09T05:00:00.000Z');assert.equal(result.get('pet').kind,'feeding');
});
