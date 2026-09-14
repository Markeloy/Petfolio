import test from 'node:test';
import assert from 'node:assert/strict';
import {serverPublicConfig,serializePublicConfig} from '../lib/config/public.ts';
test('runtime browser configuration has an explicit public allowlist',()=>{
 const c=serverPublicConfig({NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',SUPABASE_SERVICE_ROLE_KEY:'secret',DATABASE_URL:'private'});
 assert.equal(c.publishableKey,'sb_publishable_example');
 assert.ok(!JSON.stringify(c).includes('secret'));assert.ok(!JSON.stringify(c).includes('private'));
 for(const key of ['sb_secret_example','eyJhbGciOiJIUzI1NiJ9.secret.signature','service_role'])assert.equal(serverPublicConfig({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key}).publishableKey,'');
});
test('public JSON cannot close its script element',()=>{
 const c=serverPublicConfig({NEXT_PUBLIC_SUPABASE_URL:'</script><script>alert(1)</script>&'});
 const encoded=serializePublicConfig(c);
 assert.ok(!encoded.includes('<'));assert.ok(!encoded.includes('&'));assert.deepEqual(JSON.parse(encoded),c);
});

test('production launcher rejects a secret key without logging it',async()=>{
 const {spawnSync}=await import('node:child_process');
 const secret='sb_secret_do_not_print_this_value';
 const result=spawnSync(process.execPath,['scripts/start-production.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:secret}});
 assert.equal(result.status,1);
 assert.ok(result.stderr.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
 assert.ok(!result.stderr.includes(secret));assert.ok(!result.stdout.includes(secret));
});
