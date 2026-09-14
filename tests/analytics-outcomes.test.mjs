import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function compile(path,adapters={}) {
 const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [name,url] of Object.entries(adapters))code=code.replaceAll("'"+name+"'",JSON.stringify(url)).replaceAll('"'+name+'"',JSON.stringify(url));
 return moduleUrl(code);
}
const events=await compile('lib/analytics/events.ts');
const server=await compile('lib/analytics/server.ts',{'./events':events,'./privacy':new URL('../lib/analytics/privacy.ts',import.meta.url).href});
const {trackServer}=await import(server);
const redirectAdapter=moduleUrl("export function redirect(path){throw Object.assign(new Error('redirect'),{path});}");
const clientAdapter=moduleUrl("export async function createClient(){return globalThis.petfolioOutcomeTestClient;}");
const actions=await compile('app/pets/[petId]/care/medications/[medicationId]/actions.ts',{
 'next/navigation':redirectAdapter,'next/cache':moduleUrl('export function revalidatePath(){}'),
 '@/lib/supabase/server':clientAdapter,'@/lib/analytics/server':server,
 '@/lib/analytics/context':await compile('lib/analytics/context.ts'),
 '@/lib/medications/schedule':moduleUrl("export function todayOccurrence(){return '2026-09-14T09:00:00Z';}"),
});
const {recordDose}=await import(actions);
test('analytics failures, rejections and timeout cannot escape into a business action',async()=>{
 await assert.doesNotReject(()=>trackServer({rpc:()=>Promise.reject(new Error('private raw error'))},'weight_recorded',{is_first_weight:false}));
 let calls=0;
 await trackServer({rpc:()=>{calls++;return Promise.resolve({error:null});}},'app_error_seen',{error_code:'private raw error'});
 assert.equal(calls,0);
 const start=Date.now();
 await trackServer({rpc:()=>new Promise(()=>{})},'weight_recorded',{is_first_weight:false});
 assert.ok(Date.now()-start<2000);
});
test('actual dose action emits outcome after DB, preserves first mark and ignores failed analytics',async()=>{
 for(const mode of ['success','existing','rls','network']){
  const calls=[];
  globalThis.petfolioOutcomeTestClient={
   auth:{getClaims:async()=>({data:{claims:{sub:'owner'}},error:null})},
   from(table){const chain={select(){return chain;},eq(){return chain;},is(){return chain;},maybeSingle:async()=>({data:table==='medication_schedules'?{schedule_type:'daily_time'}:{id:'available'}})};return chain;},
   rpc(name,args){
    calls.push({name,args});
    if(name==='track_analytics_event')return Promise.reject(new Error('analytics unavailable'));
    if(mode==='network')return Promise.reject(new Error('private network error'));
    if(mode==='rls')return Promise.resolve({data:null,error:{code:'42501'}});
    return Promise.resolve({data:[{id:'dose',status:'given',already_recorded:mode==='existing'}],error:null});
   }
  };
  const form=new FormData();form.set('status',mode==='existing'?'skipped':'given');
  await assert.rejects(()=>recordDose('pet','med','schedule','2026-09-14T09:00:00Z',form),error=>{
   assert.match(error.path,mode==='success'?/saved=new/:mode==='existing'?/saved=existing/:/error=/);return true;
  });
  assert.equal(calls[0].name,'record_medication_dose');
  assert.equal(calls[1].args.p_event_name,['rls','network'].includes(mode)?'dose_record_failed':'dose_recorded');
  if(mode==='existing'){assert.equal(calls[1].args.p_properties.status,'given');assert.equal(calls[1].args.p_properties.already_recorded,true);}
  assert.ok(!JSON.stringify(calls[1]).includes('private'));
  assert.ok(!Object.hasOwn(calls[1].args,'p_user_id'));
 }
 delete globalThis.petfolioOutcomeTestClient;
});
