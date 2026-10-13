import {test} from 'node:test';
import assert from 'node:assert/strict';
import {landmarks,worldHour,daylight} from '../src/city-life.js';
import {insideWorld} from '../src/world-layout.js';

test('landmarks are finite, accessible geographic anchors; shared day cycle reaches night',()=>{
  assert.equal(landmarks.length,6);
  for(const landmark of landmarks){
    assert.ok(Number.isFinite(landmark.x)&&Number.isFinite(landmark.z));
    assert.ok(insideWorld(landmark.entrance.x,landmark.entrance.z));
  }
  assert.equal(worldHour(0,0),9);
  assert.equal(worldHour(12*60*1000,0),21);
  assert.ok(daylight(12)>.99);
  assert.equal(daylight(0),0);
});
