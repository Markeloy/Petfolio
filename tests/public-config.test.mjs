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
