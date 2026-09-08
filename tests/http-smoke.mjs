// Public rendering and unauthenticated access only. No live backend or account.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const port=3187,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port),'--hostname','127.0.0.1'],{
  cwd:new URL('..',import.meta.url),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_smoke_test'},stdio:['ignore','pipe','pipe'],
});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
const get=path=>fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(10000)});
try {
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
    if(server.exitCode!==null)throw new Error('Server exited: '+log);
    try{await get('/manifest.webmanifest');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}
  }
  assert.ok(ready,'production server starts');
  for(const [path,label] of [['/login','Добро пожаловать'],['/login?mode=signup','Создать аккаунт']]){
    const response=await get(path);assert.equal(response.status,200,path);assert.ok((await response.text()).includes(label),path);
  }
  const id='11111111-1111-4111-8111-111111111111';
  for(const path of ['/','/calendar','/family','/stock','/settings','/onboarding/pet',...['profile','care','health','nutrition','documents','activity'].map(section=>`/pets/${id}/${section}`)]){
    const response=await get(path);
    if(response.status===307)assert.equal(response.headers.get('location'),'/login',path);
    else {
      assert.equal(response.status,200,path);
      const html=await response.text();
      assert.ok(/<meta[^>]+http-equiv="refresh"[^>]+content="[01];url=\/login"/.test(html),path+' must stream a login redirect');
    }
  }
  const file=await get(`/pets/${id}/documents/${id}/file`);assert.equal(file.status,401);assert.match(file.headers.get('cache-control'),/no-store/);
  const missing=await get('/missing-smoke-route');assert.equal(missing.status,404);assert.ok((await missing.text()).includes('Запись недоступна'));
  const manifest=await get('/manifest.webmanifest');assert.equal((await manifest.json()).name,'Petfolio');
  assert.equal((await get('/sw.js')).status,200);
  console.log('PASS: production startup, login/signup rendering, 12 protected routes, private-file 401/no-store, Russian 404, manifest and service worker. No authenticated workflow or browser layout was tested.');
} finally {
  server.kill();if(server.exitCode===null)await once(server,'exit');
}
