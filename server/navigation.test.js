import test from 'node:test';
import assert from 'node:assert/strict';
import {findRoute,routeDistance,routeInstruction} from '../src/navigation.js';
test('route planner returns finite coordinates for nearby city positions',()=>{const route=findRoute({x:8,z:0},{x:8,z:12});assert.ok(route.length>=2);assert.ok(route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));assert.ok(routeDistance(route)>=0);});
test('route planner safely rejects invalid coordinates',()=>{assert.deepEqual(findRoute(null,{x:0,z:0}),[]);assert.deepEqual(findRoute({x:NaN,z:0},{x:0,z:0}),[]);});
test('route guidance reports progress and arrival',()=>{const route=[{x:0,z:0},{x:0,z:30},{x:30,z:30}];assert.match(routeInstruction({x:0,z:0},route),/m remaining|turn/i);assert.equal(routeInstruction({x:30,z:30},route),'You have arrived');});
