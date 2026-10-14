import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soundMix} from '../src/soundscape.js';

test('sound mix provides quiet world ambience, engine and road noise only while driving',()=>{
 const walking=soundMix({active:true,driving:false,speed:0});
 const driving=soundMix({active:true,driving:true,speed:14});
 assert.ok(walking.ambient>0);
 assert.equal(walking.engine,0);
 assert.ok(driving.engine>0);
 assert.ok(driving.road>0);
 assert.ok(driving.engineHz>walking.engineHz);
});

test('muted or inactive game produces no sound',()=>{
 for(const mix of [soundMix({enabled:false,active:true,driving:true,speed:20}),soundMix({active:false,driving:true,speed:20})]){
  assert.equal(mix.ambient,0);assert.equal(mix.engine,0);assert.equal(mix.road,0);
 }
});
