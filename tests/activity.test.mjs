import test from 'node:test';
import assert from 'node:assert/strict';
import {parseActivity,activitySummary} from '../lib/activity/types.ts';
const form=values=>{const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;};
const base={title:'Evening walk',kind:'walk',status:'completed',started_at:'2026-09-08T18:00',duration_minutes:'30',distance_km:'2,125'};
test('activity validation accepts optional distance and categories, rejects malformed times and totals',()=>{
  for(const kind of ['walk','training','play','other'])assert.equal(parseActivity(form({...base,kind})).kind,kind);
  assert.equal(parseActivity(form(base)).distance_km,2.125);assert.equal(parseActivity(form({...base,distance_km:''})).distance_km,null);
  assert.equal(parseActivity(form({...base,distance_km:'0'})).distance_km,0);
  for(const change of [{title:''},{kind:'bad'},{status:'bad'},{duration_minutes:'0'},{duration_minutes:'1.5'},{duration_minutes:'1441'},{distance_km:'NaN'},{distance_km:'-1'},{distance_km:'1001'},{distance_km:'1.0001'},{started_at:'2026-02-30T12:00'},{started_at:'2026-09-08T24:00'}])assert.throws(()=>parseActivity(form({...base,...change})));
});
test('activity totals exclude plans/cancellations/archives and distinguish missing distance from zero',()=>{
  const row={status:'completed',archived_at:null,duration_minutes:30,distance_km:2.125};
  const result=activitySummary([row,{...row,duration_minutes:10,distance_km:null},{...row,duration_minutes:5,distance_km:0},{...row,status:'planned'},{...row,status:'cancelled'},{...row,archived_at:'2026-09-08'}]);
  assert.deepEqual(result,{count:3,minutes:45,km:2.125,distanceCount:2});
  assert.deepEqual(activitySummary([]),{count:0,minutes:0,km:0,distanceCount:0});
});
