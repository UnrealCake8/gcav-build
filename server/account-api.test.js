import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../api/config.js';
import wallet from '../api/wallet.js';
import transfer from '../api/transfer.js';

function response(){
 const headers={};return{headers,statusCode:200,body:'',setHeader(k,v){headers[k]=v;},status(n){this.statusCode=n;return this;},end(s=''){this.body=s;}};
}

test('account config does not leak readiness details or require secrets',()=>{
 const beforeUrl=process.env.SUPABASE_URL,beforeKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
 const res=response();config({method:'GET'},res);
 assert.equal(res.statusCode,503);
 assert.deepEqual(JSON.parse(res.body),{error:'Account service is not configured'});
 if(beforeUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=beforeUrl;
 if(beforeKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=beforeKey;
});

test('wallet and transfer APIs reject anonymous calls before contacting Supabase',async()=>{
 const walletRes=response();await wallet({method:'GET',headers:{}},walletRes);
 assert.equal(walletRes.statusCode,401);
 const transferRes=response();await transfer({method:'POST',headers:{},body:{}},transferRes);
 assert.equal(transferRes.statusCode,401);
});

test('API routes reject unsupported methods',async()=>{
 const configRes=response();config({method:'POST'},configRes);
 assert.equal(configRes.statusCode,405);
 const walletRes=response();await wallet({method:'POST',headers:{}},walletRes);
 assert.equal(walletRes.statusCode,405);
 const transferRes=response();await transfer({method:'GET',headers:{}},transferRes);
 assert.equal(transferRes.statusCode,405);
});
