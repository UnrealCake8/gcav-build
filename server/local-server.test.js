import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalServer} from './index.js';

test('local server serves the game and authenticated API without a multiplayer socket endpoint',async t=>{
  const server=createLocalServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;

  const page=await fetch(base+'/');
  assert.equal(page.status,200);
  assert.match(await page.text(),/Grand Chamak Auto/);

  const socketPath=await fetch(base+'/multiplayer');
  assert.equal(socketPath.status,404);

  const unauthenticated=await fetch(base+'/api/game',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',payload:{}}),
  });
  assert.equal(unauthenticated.status,401);
});
