import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let source=await readFile(new URL('../app/login/actions.ts',import.meta.url),'utf8');
let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const adapters={
 'next/navigation':url('export function redirect(path){throw Object.assign(new Error("redirect"),{path})}'),
 '@/lib/supabase/server':url('export async function createClient(){return globalThis.signupFixture}'),
 '@/lib/analytics/server':url('export async function trackServer(c,event){globalThis.signupEvents.push(event)}'),
 '@/lib/analytics/context':url('export function analyticsContextFromForm(){return null}'),
};
for(const [key,value] of Object.entries(adapters))code=code.replaceAll(JSON.stringify(key),JSON.stringify(value));
const {signup}=await import(url(code));
test('signup with immediate session goes to onboarding; confirmation fallback and errors remain truthful',async()=>{
 for(const mode of ['session','confirmation','failure']){
  let received;globalThis.signupEvents=[];
  globalThis.signupFixture={auth:{signUp:async input=>{received=input;return {data:{session:mode==='session'?{}:null},error:mode==='failure'?{code:'signup_failed'}:null}}}};
  const form=new FormData();form.set('name',' Test owner ');form.set('email','fixture@example.com');form.set('password','fixture-password-123');
  await assert.rejects(()=>signup(form),error=>{
   if(mode==='session')assert.equal(error.path,'/onboarding/pet');
   else if(mode==='confirmation')assert.ok(new URL(error.path,'https://fixture.test').searchParams.get('message').includes('Подтвердите'));
   else assert.ok(new URL(error.path,'https://fixture.test').searchParams.has('error'));
   return true;
  });
  assert.equal(received.options.data.name,'Test owner');
  assert.equal(received.email,'fixture@example.com');
  assert.deepEqual(globalThis.signupEvents,mode==='session'?['signup_completed']:[]);
 }
 delete globalThis.signupFixture;delete globalThis.signupEvents;
});
