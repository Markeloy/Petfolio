import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProcedure} from '../lib/procedures/types.ts';
import {documentSort} from '../lib/documents/feed.ts';
const form=(values={})=>{const f=new FormData();for(const [k,v]of Object.entries({title:'Bath',kind:'bath',next_on:'2028-02-29',repeat_days:'14',notes:'',...values}))f.set(k,v);return f;};
test('procedures reject impossible dates and invalid intervals while supporting one-time care',()=>{assert.equal(parseProcedure(form()).repeat_days,14);assert.equal(parseProcedure(form({repeat_days:''})).repeat_days,null);for(const values of [{next_on:'2027-02-29'},{next_on:'2101-01-01'},{repeat_days:'0'},{repeat_days:'1.5'},{repeat_days:'366'},{kind:'__proto__'},{title:'  '}])assert.throws(()=>parseProcedure(form(values)));});
test('document ordering only accepts supported stable choices',()=>{for(const sort of ['newest','oldest','name','size'])assert.equal(documentSort(sort),sort);for(const input of ['__proto__','title desc',[],null])assert.equal(documentSort(input),'newest');});
