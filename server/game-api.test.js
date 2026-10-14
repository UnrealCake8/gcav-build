import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameHandler} from '../api/game.js';

function response(){
  const headers={};
  return{headers,statusCode:200,body:'',status(code){this.statusCode=code;return this;},setHeader(k,v){headers[k]=v;return this;},end(s=''){this.body=s;}};
}

test('game route requires an authenticated session',async()=>{
  const handler=createGameHandler({authenticate:async()=>({error:'Sign in required',status:401})});
  const res=response();
  await handler({method:'POST',body:{action:'transfer',payload:{}}},res);
  assert.equal(res.statusCode,401);
  assert.deepEqual(JSON.parse(res.body),{error:'Sign in required'});
});

test('game route rejects unsupported actions and malformed payloads before RPC',async()=>{
  let calls=0;
  const authenticate=async()=>({supabase:{rpc:async()=>{calls++;return{data:{events:[]}};}}});
  const handler=createGameHandler({authenticate});
  for(const body of [{action:'admin-credit',payload:{}},{action:'move',payload:[]},{action:'move',payload:null}]){
    const res=response();
    await handler({method:'POST',body},res);
    assert.equal(res.statusCode,400);
  }
  assert.equal(calls,0);
});

test('game route forwards authenticated action payload to the database RPC',async()=>{
  const calls=[];
  const expected={events:[{type:'bank',balance:450}]};
  const handler=createGameHandler({authenticate:async()=>({supabase:{rpc:async(...args)=>{calls.push(args);return{data:expected};}}})});
  const payload={item:'coffee',requestId:'a7b8ec35-51de-495c-82c2-4d21124ad427'};
  const res=response();
  await handler({method:'POST',body:{action:'purchase',payload}},res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(calls,[["gca_game_action",{p_action:'purchase',p_payload:payload}]]);
  assert.deepEqual(JSON.parse(res.body),expected);
});

test('game route turns database failures into safe client responses',async()=>{
  const handler=createGameHandler({authenticate:async()=>({supabase:{rpc:async()=>({error:{message:'Insufficient funds'}})}})});
  const res=response();
  await handler({method:'POST',body:{action:'purchase',payload:{item:'meal'}}},res);
  assert.equal(res.statusCode,400);
  assert.deepEqual(JSON.parse(res.body),{error:'Insufficient funds'});
});
