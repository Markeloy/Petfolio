import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
async function compiled(path,adapters){
 let code=ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [name,value] of Object.entries(adapters))code=code.replaceAll("'"+name+"'",JSON.stringify(value));
 return import(asModule(code));
}
const schedule=new URL('../lib/medications/schedule.ts',import.meta.url).href;
const {getHealthReminders}=await compiled('lib/health/reminders.ts',{'@/lib/medications/schedule':schedule,'./types':new URL('../lib/health/types.ts',import.meta.url).href});
const {activityReminders}=await compiled('lib/activity/server.ts',{'@/lib/medications/schedule':schedule,'@/lib/calendar/data':asModule('export function allPages(){throw Error("unused")}'),'./types':new URL('../lib/activity/types.ts',import.meta.url).href});
test('embedded reminder queries limit each pet independently and keep deterministic ordering',async()=>{
 for(const domain of ['health','activity']){
  let requests=0;
  const client=createClient('https://fixture.invalid','sb_publishable_fixture',{auth:{persistSession:false},global:{fetch:async input=>{
   requests++;const url=new URL(input);
   assert.equal(url.searchParams.get('id'),'in.(a,b)');
   const base={pet_id:'a',id:'event-a',title:'Fixture A',kind:'visit',status:'planned',event_on:'2026-09-18',next_due_on:null};
   let rows;
   if(domain==='health'){
    for(const [alias,column] of [['planned','event_on'],['repeats','next_due_on']]){
     assert.equal(url.searchParams.get(alias+'.limit'),'1');
     assert.equal(url.searchParams.get(alias+'.order'),`${column}.asc,id.asc`);
     assert.equal(url.searchParams.get(alias+'.archived_at'),'is.null');
    }
    rows=[{id:'a',planned:[base],repeats:[]},{id:'b',planned:[],repeats:[{...base,id:'event-b',pet_id:'b',status:'completed',next_due_on:'2026-09-19'}]}];
   }else{
    assert.equal(url.searchParams.get('pet_activities.limit'),'1');
    assert.equal(url.searchParams.get('pet_activities.order'),'started_at.asc,id.asc');
    rows=['a','b'].map(id=>({id,pet_activities:[{id:'activity-'+id,pet_id:id,title:id,kind:'walk',duration_minutes:10,started_at:'2026-09-18T12:00:00Z'}]}));
   }
   return new Response(JSON.stringify(rows),{headers:{'content-type':'application/json'}});
  }}});
  const result=await (domain==='health'?getHealthReminders:activityReminders)(client,['a','b'],'UTC',new Date('2026-09-17T12:00:00Z'));
  assert.equal(requests,1);assert.deepEqual([...result.keys()],['a','b']);
  assert.ok(result.get('b').href.startsWith('/pets/b/'));
 }
});
