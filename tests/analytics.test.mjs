import test from 'node:test';
import assert from 'node:assert/strict';
import {validAnalyticsProperties} from '../lib/analytics/privacy.ts';
test('analytics rejects private text, unexpected keys and incorrect value types',()=>{
 assert.equal(validAnalyticsProperties('dose_recorded',{status:'given',already_recorded:false,schedule_type:'daily_time'}),true);
 for(const payload of [
 {status:'private diagnosis',already_recorded:false,schedule_type:'daily_time'},
 {status:'given',already_recorded:'false',schedule_type:'daily_time'},
 {status:'given',already_recorded:false,schedule_type:'daily_time',notes:'private'},
 {status:'given',already_recorded:false},
 ]) assert.equal(validAnalyticsProperties('dose_recorded',payload),false);
 assert.equal(validAnalyticsProperties('landing_viewed',{utm_campaign:'person@example.com'}),false);
 assert.equal(validAnalyticsProperties('app_error_seen',{error_code:'raw_exception_message'}),false);
 assert.equal(validAnalyticsProperties('unknown',{}),false);
 assert.equal(validAnalyticsProperties('toString',{}),false);
 assert.equal(validAnalyticsProperties('landing_viewed',{}),true);
});
