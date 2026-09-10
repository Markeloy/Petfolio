import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSettings} from '../lib/auth/settings.ts';
test('account settings validate timezone and name',()=>{
  const f=new FormData();f.set('display_name',' Маша ');f.set('timezone','Pacific/Auckland');
  assert.deepEqual(parseSettings(f),{display_name:'Маша',timezone:'Pacific/Auckland'});
  f.set('timezone','not/a/timezone');assert.throws(()=>parseSettings(f));
  f.set('timezone','UTC');f.set('display_name',' ');assert.throws(()=>parseSettings(f));
});
