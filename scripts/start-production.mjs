import {spawn} from 'node:child_process';
import {serverPublicConfig} from '../lib/config/public.ts';
const config=serverPublicConfig();
let validUrl=false;
try {const url=new URL(config.supabaseUrl);validUrl=url.protocol==='https:'||(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:');}catch{}
if(!validUrl||!config.publishableKey||!['production','staging','development'].includes(config.environment)||!/^\d+\.\d+\.\d+$/.test(config.appVersion)){
 console.error('Petfolio: check NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public sb_publishable key), NEXT_PUBLIC_APP_ENV and NEXT_PUBLIC_APP_VERSION. Values are not logged.');
 process.exit(1);
}
const port=process.env.PORT??'3000',host=process.env.PETFOLIO_HOST??'0.0.0.0';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname',host,'--port',port],{stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Petfolio server could not start');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
