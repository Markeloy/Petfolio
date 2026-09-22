// Controlled HTTP benchmark: real Next production renderer, synthetic Supabase.
// No credentials or production data. Not a substitute for a real browser/RLS test.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const cwd=process.env.BENCH_CWD||process.cwd();
const count=Number(process.env.BENCH_PETS||3),delay=Number(process.env.BENCH_DELAY_MS||40);
const uid='11111111-1111-4111-8111-111111111111',hid='22222222-2222-4222-8222-222222222222';
const mid='44444444-4444-4444-8444-444444444444',sid='55555555-5555-4555-8555-555555555555';
const today=new Date().toISOString().slice(0,10),now=new Date().toISOString();
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.com',email_confirmed_at:now,created_at:now,app_metadata:{provider:'email',providers:['email']},user_metadata:{name:'Fixture owner'}};
const pets=Array.from({length:count},(_,i)=>({id:`33333333-3333-4333-8333-${String(i+1).padStart(12,'0')}`,name:`Fixture pet ${i+1}`,household_id:hid,birth_date:'2022-01-01',avatar_url:`${hid}/fixture-${i}.png`,created_at:now,archived_at:null,weight_records:[{weight_kg:10+i,measured_at:today}],planned:[],repeats:[],pet_activities:[]}));
const schedule={id:sid,medication_id:mid,schedule_type:'daily_time',scheduled_time:'12:00:00',days_of_week:[1,2,3,4,5,6,7],timezone:'UTC',active_from:today,active_until:null,is_active:true};
const medication={id:mid,pet_id:pets[0].id,name:'Fixture medication',dose_amount:1,dose_unit:'мл',starts_on:today,ends_on:null,status:'active',created_by:uid,created_at:now,medication_schedules:[schedule]};
const tables={pets,profiles:[{id:uid,display_name:'Fixture owner',timezone:'UTC',updated_at:now}],households:[{id:hid,name:'Fixture household'}],household_members:[{household_id:hid,user_id:uid,role:'owner',joined_at:now}],medications:[medication],medication_schedules:[schedule],weight_records:pets.map(p=>({pet_id:p.id,...p.weight_records[0]}))};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const raw=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,role:'authenticated',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
const token=raw+'.'+createHmac('sha256','local-fixture-only').update(raw).digest('base64url');
const session={access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const cookie='sb-127-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
let requests=[],failTable=null;
const backend=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 requests.push({path:url.pathname,select:url.searchParams.get('select')});
 if(failTable&&url.pathname==='/rest/v1/'+failTable){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'fixture_failure',message:'Synthetic backend failure'}));return;}
 await new Promise(r=>setTimeout(r,delay));
 let result=[];
 if(url.pathname==='/auth/v1/user')result=user;
 else if(url.pathname==='/auth/v1/signup'||url.pathname==='/auth/v1/token')result=session;
 else if(url.pathname.startsWith('/storage/v1/object/sign/')){
   let text='';for await(const part of req)text+=part;
   const body=JSON.parse(text||'{}');
   result=body.paths?body.paths.map(path=>({path,signedURL:'/object/sign/pet-avatars/'+path+'?token=fixture',error:null})):{signedURL:'/object/sign/pet-avatars/fixture?token=fixture'};
 } else if(url.pathname.startsWith('/rest/v1/rpc/'))result=[];
 else {
  result=[...(tables[url.pathname.split('/').at(-1)]??[])];
  for(const [k,v] of url.searchParams){
   if(k.includes('.')||['select','order','limit','offset','or'].includes(k))continue;
   if(v.startsWith('eq.'))result=result.filter(r=>String(r[k])===v.slice(3));
   if(v.startsWith('in.('))result=result.filter(r=>v.slice(4,-1).split(',').includes(String(r[k])));
  }
  if(req.headers.accept?.includes('vnd.pgrst.object'))result=result[0]??null;
 }
 res.setHeader('content-type','application/json');res.setHeader('content-range','0-0/'+(Array.isArray(result)?result.length:1));res.end(JSON.stringify(result));
});
await new Promise(r=>backend.listen(3198,'127.0.0.1',r));
const server=spawn(process.execPath,['scripts/start-production.mjs'],{cwd,env:{...process.env,PORT:'3199',PETFOLIO_HOST:'127.0.0.1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3198',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_benchmark_fixture',NEXT_PUBLIC_APP_ENV:'development'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const results=[];
try{
 let ready=false;
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3199/manifest.webmanifest');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(ready,'server starts '+log);
 const pet=pets[0].id;
 const routes=[['/','Fixture pet'],[`/pets/${pet}/health`,'Здоровье'],[`/pets/${pet}/care`,'Текущие курсы'],[`/pets/${pet}/care/medications/${mid}`,'История приёмов'],['/calendar','Календарь'],['/stock','Запасы'],[`/pets/${pet}/documents`,'Документы'],[`/pets/${pet}/nutrition`,'Питание'],[`/pets/${pet}/activity`,'Активность'],['/family','Участники'],['/settings','Fixture owner']];
 for(const [path,label] of routes){
  const samples=[];
  for(let n=0;n<3;n++){
   requests=[];const start=performance.now();
   const r=await fetch('http://127.0.0.1:3199'+path,{headers:{cookie},redirect:'manual'});
   const firstByte=performance.now()-start,html=await r.text(),total=performance.now()-start;
   assert.equal(r.status,200,path);assert.ok(html.includes(label),path+' renders usable content');
   assert.ok(!html.includes('NEXT_REDIRECT'),path+' stays authenticated');
   assert.ok(!/"digest":"\d+"/.test(html),path+' has no server error');
   samples.push({firstByteMs:Math.round(firstByte),completeMs:Math.round(total),requests:requests.length,dataRequests:requests.filter(r=>!r.path.startsWith('/auth/')).length});
  }
  results.push({path:path.replaceAll(pet,':pet').replaceAll(mid,':med'),samples});
 }
 if(process.env.BENCH_VERIFY_FLOWS==='1'){
  const base='http://127.0.0.1:3199';
  const signupHtml=await (await fetch(base+'/login?mode=signup')).text();
  const action=signupHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(action,'signup server action rendered');
  assert.ok(!signupHtml.includes('name="passwordConfirm"'),'signup has three fields');
  const form=new FormData();form.set(action[1],'');form.set('name','Fixture new owner');form.set('email','new-fixture@example.com');form.set('password','fixture-password-123');
  const signup=await fetch(base+'/login?mode=signup',{method:'POST',body:form,redirect:'manual'});
  assert.equal(signup.status,303);assert.equal(signup.headers.get('location'),'/onboarding/pet');
  assert.ok(signup.headers.getSetCookie().some(c=>c.startsWith('sb-127-auth-token=')),'immediate session written to cookies');
  for(const path of ['/onboarding/pet',`/pets/${pet}/health/weight/new`,`/pets/${pet}/health/new`,`/pets/${pet}/care/medications/new`,`/pets/${pet}/care/procedures/new`,`/pets/${pet}/nutrition/new`,`/pets/${pet}/documents/new`,`/pets/${pet}/activity/new`,'/stock/new']){
   const response=await fetch(base+path,{headers:{cookie}});const html=await response.text();
   assert.equal(response.status,200,path);assert.ok(html.includes('<form'),path+' form rendered');assert.ok(!html.includes('NEXT_REDIRECT'),path);
   assert.ok(!/"digest":"\d+"/.test(html),path+' no server error');
  }
  const nested=`/pets/${pet}/health`;
  failTable='health_events';
  const failed=await (await fetch(base+nested,{headers:{cookie}})).text();
  assert.ok(failed.includes('digest'),'backend error serialized for error boundary');
  assert.ok(!failed.includes('Synthetic backend failure'),'raw backend details not exposed');
  failTable=null;
  const recovered=await (await fetch(base+nested,{headers:{cookie}})).text();
  assert.ok(recovered.includes('<h1>Здоровье</h1>'),'route recovers on fresh request');
  const logout=await fetch(base+'/auth/signout',{method:'POST',headers:{cookie},redirect:'manual'});
  assert.equal(logout.status,302);assert.ok(logout.headers.getSetCookie().some(c=>c.includes('Max-Age=0')),'logout expires session cookie');
  console.log('PASS: actual signup Server Action receives session and sets cookies; onboarding and eight creation forms render; backend failure and recovery; logout cookie removal. Auth/data backend is synthetic.');
 }
 console.log(JSON.stringify({pets:count,delayMs:delay,results},null,2));
 if(process.env.BENCH_OUTPUT)await writeFile(process.env.BENCH_OUTPUT,JSON.stringify({pets:count,delayMs:delay,results},null,2));
}finally{server.kill();if(server.exitCode===null)await once(server,'exit');backend.closeAllConnections();await new Promise(r=>backend.close(r));}
