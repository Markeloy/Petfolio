import test from 'node:test';
import assert from 'node:assert/strict';
import {stockNotices,readIds,unreadCount} from '../lib/notifications/model.ts';
import {translator} from '../lib/i18n/core.ts';
const item={id:'food',name:'Корм Барсика',quantity:100,threshold:100,unit:'г',updated_at:'v1',archived_at:null};
test('shopping alerts include threshold equality and zero, exclude restocked and archived supplies',()=>{
  const t=translator('en');
  assert.equal(stockNotices([item],t).length,1);
  assert.equal(stockNotices([{...item,quantity:101}],t).length,0);
  assert.equal(stockNotices([{...item,quantity:0,threshold:0}],t).length,1);
  assert.equal(stockNotices([{...item,archived_at:'2026-09-09'}],t).length,0);
  const [notice]=stockNotices([item],t);assert.equal(notice.title,'Корм Барсика');assert.match(notice.detail,/100 g/);
  assert.equal(notice.href,'/stock/food');
});
test('reading clears unread count but preserves shopping task; a revised stock produces a new notice',()=>{
  const notices=stockNotices([item],translator('ru'));
  assert.equal(unreadCount(notices,new Set()),1);
  const read=new Set(readIds(JSON.stringify([notices[0].id])));
  assert.equal(unreadCount(notices,read),0);assert.equal(notices.length,1);
  assert.equal(unreadCount(stockNotices([{...item,updated_at:'v2'}],translator('ru')),read),1);
});
test('malformed receipts are ignored without truncating a large valid inbox',()=>{
  assert.deepEqual(readIds('not JSON'),[]);assert.deepEqual(readIds('{}'),[]);
  assert.deepEqual(readIds('[null,3,"ok"]'),['ok']);
  assert.deepEqual(readIds(JSON.stringify(['x'.repeat(501)])),[]);
  assert.equal(readIds(JSON.stringify(Array.from({length:600},(_,i)=>String(i)))).length,600);
});
