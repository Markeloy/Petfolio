import test from 'node:test';
import assert from 'node:assert/strict';
import {detectedMime} from '../lib/documents/types.ts';
test('document file signatures distinguish supported formats and reject renamed HTML',()=>{
  assert.equal(detectedMime(new TextEncoder().encode('%PDF-1.4')),'application/pdf');
  assert.equal(detectedMime(Uint8Array.from([255,216,255,224])),'image/jpeg');
  assert.equal(detectedMime(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(detectedMime(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
  for(const input of ['', '<html>', '<svg/>', 'MZbinary', 'RIFF0000WAVE'])assert.equal(detectedMime(new TextEncoder().encode(input)),null);
});
