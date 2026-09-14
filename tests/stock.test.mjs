import test from 'node:test';
import assert from 'node:assert/strict';
import {quantity} from '../lib/stock/validation.ts';
test('stock quantities accept comma fractions and reject ambiguous or unsupported precision',()=>{
  assert.equal(quantity(' 1,125 '),1.125);assert.equal(quantity('0'),0);assert.equal(quantity('1000000000'),1000000000);
  for(const value of ['',null,'-1','NaN','Infinity','1e3','1.1234','1000000001','1,2.3'])assert.throws(()=>quantity(value));
  assert.throws(()=>quantity('0',true));assert.equal(quantity('0.001',true),0.001);
});
