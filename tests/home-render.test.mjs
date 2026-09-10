// Render real home components with a read-only Link adapter, without a backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const asModule=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const react=import.meta.resolve('react');
const adapters={
  react,
  '@/lib/i18n/client':asModule(`import {translator} from '${new URL('../lib/i18n/core.ts',import.meta.url).href}';export const useT=()=>translator('en');`),
  'next/link':asModule(`import {createElement} from '${react}';export default function Link({prefetch,children,...props}){return createElement('a',props,children)};export const useLinkStatus=()=>({pending:false});`),
  './refresh-on-focus':asModule('export const RefreshOnFocus=()=>null;'),
};
let notificationSource=await readFile(new URL('../app/components/notification-center.tsx',import.meta.url),'utf8');
for(const [path,url]of Object.entries({...adapters,'@/lib/notifications/model':new URL('../lib/notifications/model.ts',import.meta.url).href}))notificationSource=notificationSource.replace(`'${path}'`,JSON.stringify(url));
const notificationCode=ts.transpileModule(notificationSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
adapters['./notification-center']=asModule(notificationCode);
const {NotificationCenter}=await import(adapters['./notification-center']);
let source=await readFile(new URL('../app/components/petfolio-home.tsx',import.meta.url),'utf8');
for(const [path,url]of Object.entries(adapters))source=source.replace(JSON.stringify(path),JSON.stringify(url));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const {PetfolioHome,BottomNav}=await import(asModule(code));
test('English home retains six sections, visible pet selection and original pet names',()=>{
  const pet={id:'pet-one',name:'Семья',image:null,stats:[['5 kg','Вес'],['2 years','Возраст']],reminder:null,reminderError:false};
  const html=renderToStaticMarkup(createElement(PetfolioHome,{pets:[pet,{...pet,id:'pet-two',name:'Milo'}]}));
  assert.equal((html.match(/class="sectionCard /g)??[]).length,6);
  assert.equal((html.match(/aria-pressed=/g)??[]).length,2);
  assert.match(html,/aria-pressed="true">Семья/);
  assert.match(html,/href="\/onboarding\/pet"/);
  assert.match(html,/href="\/pets\/pet-one\/care"/);
  assert.ok(!/[А-Яа-яЁё]/.test(html.replaceAll('Семья','')));
});
test('More renders without loading pet data and navigation has five real links',()=>{
  const html=renderToStaticMarkup(createElement(PetfolioHome,{pets:[],initialTab:'more'}));
  assert.match(html,/href="\/settings"/);assert.ok(!/[А-Яа-яЁё]/.test(html));
  const nav=renderToStaticMarkup(createElement(BottomNav,{active:'calendar'}));
  assert.equal((nav.match(/<a /g)??[]).length,5);assert.equal((nav.match(/aria-current="page"/g)??[]).length,1);
  assert.match(nav,/href="\/calendar"[^>]+aria-current="page"/);
});

test('bell is a dialog trigger with unread badge, individual and bulk read controls',()=>{
  const items=[{id:'stock:a:1',kind:'stock',title:'Food',detail:'Remaining: 100 g',href:'/stock/a'}];
  const html=renderToStaticMarkup(createElement(NotificationCenter,{items,scope:'user:family'}));
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/class="notificationBadge"[^>]*>1</);
  assert.match(html,/<dialog/);assert.match(html,/Mark all as read/);assert.match(html,/Mark as read/);
  assert.match(html,/href="\/stock\/a"/);assert.ok(!html.includes('/calendar'));
});
