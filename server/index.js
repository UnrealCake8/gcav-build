import {crossedTolls} from '../src/salik.js';
import {createWalletStore} from './wallet-store.js';
import {insideWorld} from '../src/world-layout.js';
import {validOutfit} from '../src/outfits.js';
import http from 'node:http';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
const MAX_CLIP=1024*1024, TTL=5*60*1000;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
export function createGameServer({origins=[],maxPlayers=16,clipTTL=TTL,ringTimeout=30000,walletPath=null,clock=()=>Date.now(),tollOptions={}}={}){
 const wallets=createWalletStore(walletPath);
 const clients=new Map(),tokens=new Map(),calls=new Map(),clips=new Map();let phoneNumber=100,storedBytes=0;
 const send=(ws,m)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));};
 const playerById=id=>[...clients.values()].find(p=>p.id===id);
 const participant=(p,c)=>p&&c&&(c.a===p.id||c.b===p.id);
 function bank(a,event=null){for(const [ws,p]of clients)if(p.account===a)send(ws,{type:'bank',...wallets.view(a),event});}
 function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 function dropClip(id){const c=clips.get(id);if(c){storedBytes-=c.data.length;clips.delete(id);}}
 function endCall(c,reason){if(!c)return;clearTimeout(c.timer);for(const id of [c.a,c.b]){const p=playerById(id);if(p){p.callId=null;send(p.ws,{type:'call-ended',callId:c.id,reason});}}calls.delete(c.id);for(const [id,clip]of clips)if(clip.callId===c.id)dropClip(id);}
 const server=http.createServer(async(req,res)=>{req.setTimeout(15000);try{const url=new URL(req.url,'http://local');const p=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));
 if(url.pathname==='/health'){json(res,200,{status:'ok'});return;}
 if(url.pathname.startsWith('/api/')){
 if(!p||!p.joined){json(res,401,{error:'Session required'});return;}
 if(req.method==='POST'&&url.pathname==='/api/clips'){
 if(!origins.includes(req.headers.origin)){json(res,403,{error:'Origin denied'});return;}
 const c=calls.get(req.headers['x-call-id']);if(!participant(p,c)||c.state!=='active'){json(res,403,{error:'Answered private call required'});return;}
 const now=Date.now();if(p.uploading||now-p.lastClip<800){json(res,429,{error:'Wait before sending another clip'});return;}
 const mime=(req.headers['content-type']||'').split(';')[0].trim();if(!['audio/webm','audio/ogg','audio/mp4'].includes(mime)){json(res,415,{error:'Unsupported audio format'});return;}
 if(Number(req.headers['content-length'])>MAX_CLIP){json(res,413,{error:'Clip too large'});return;}
 p.uploading=true;let data=[],length=0;try{for await(const chunk of req){length+=chunk.length;if(length>MAX_CLIP){json(res,413,{error:'Clip exceeds 1 MB'});return;}data.push(chunk);}}finally{p.uploading=false;}
 if(!length){json(res,400,{error:'Empty clip'});return;}if(!calls.has(c.id)){json(res,409,{error:'Call ended during upload'});return;}
 if(storedBytes+length>32*1024*1024){json(res,503,{error:'Audio storage busy; try later'});return;}
 const id=randomUUID(),recipient=c.a===p.id?c.b:c.a;clips.set(id,{data:Buffer.concat(data),mime,callId:c.id,sender:p.id,recipient,expires:now+clipTTL});storedBytes+=length;p.lastClip=now;
 send(playerById(recipient)?.ws,{type:'voice-clip',id,callId:c.id,from:p.number,name:p.name});json(res,201,{id});return;}
 if(req.method==='GET'&&url.pathname.startsWith('/api/clips/')){const id=url.pathname.slice('/api/clips/'.length),clip=clips.get(id);if(!clip||Date.now()>clip.expires){dropClip(id);json(res,404,{error:'Clip expired'});return;}if(clip.recipient!==p.id){json(res,403,{error:'Private recording'});return;}res.writeHead(200,{'Content-Type':clip.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(clip.data);return;}
 json(res,404,{error:'Not found'});return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return;}
 const path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);if(!['index.html','game.js','style.css'].includes(path)){json(res,404,{error:'Not found'});return;}
 const data=await readFile(resolve(fileURLToPath(new URL('../dist/',import.meta.url)),path));res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'microphone=(self)','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch{if(!res.headersSent)json(res,500,{error:'Request failed'});else res.end();}});
 const wss=new WebSocketServer({noServer:true,maxPayload:2048});
 server.on('upgrade',(req,socket,head)=>{if(req.url!=='/multiplayer'||!origins.includes(req.headers.origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}if(clients.size>=maxPlayers){socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 wss.on('connection',ws=>{const p={ws,id:randomUUID(),token:randomBytes(32).toString('hex'),number:String(++phoneNumber),name:'Player',joined:false,x:8,z:12,yaw:0,vehicle:false,outfit:'street',lastMove:Date.now(),lastChat:0,lastClip:0,lastDial:0,count:0,window:Date.now(),alive:true,callId:null};clients.set(ws,p);tokens.set(p.token,p);send(ws,{type:'welcome',id:p.id,number:p.number,token:p.token});ws.on('pong',()=>p.alive=true);
 ws.on('message',raw=>{try{const now=Date.now();if(now-p.window>1000){p.window=now;p.count=0;}if(++p.count>40){ws.close(1008,'Rate limit');return;}const m=JSON.parse(raw);
 if(m.type==='join'){if(p.joined)return;p.account=wallets.open(m.walletKey);send(ws,{type:'wallet',key:p.account.key,...wallets.view(p.account)});p.name=String(m.name||'Player').replace(/[\x00-\x1f]/g,'').slice(0,20);if(validOutfit(m.outfit))p.outfit=m.outfit;p.joined=true;}
 if(m.type==='outfit'&&p.joined&&validOutfit(m.outfit))p.outfit=m.outfit;
 if(m.type==='move'&&p.joined){if(![m.x,m.z,m.yaw].every(Number.isFinite)||!insideWorld(m.x,m.z))return;const dt=Math.max(.08,(now-p.lastMove)/1000);if(Math.hypot(m.x-p.x,m.z-p.z)>35*dt+3)return;const previous={x:p.x,z:p.z,vehicle:p.vehicle};for(const event of crossedTolls(p.account.tolls,previous,m,clock(),tollOptions)){wallets.entry(p.account,-event.total,'Salik · '+event.name,{kind:'salik',gate:event.name,base:event.base,vat:event.vat,reason:event.reason,direction:event.direction});bank(p.account,event);}p.x=m.x;p.z=m.z;p.yaw=m.yaw%(2*Math.PI);p.vehicle=!!m.vehicle;p.lastMove=now;}
 if(m.type==='job-start'&&p.joined&&p.account.job===0){p.account.job=1;wallets.save();bank(p.account);}
 if(m.type==='move'&&p.joined){const a=p.account;if(a.job===1&&Math.hypot(p.x+105,p.z)<8){a.job=2;wallets.save();bank(a);}else if(a.job===2&&Math.hypot(p.x-105,p.z-105)<8){a.job=0;wallets.entry(a,150,'Waterfront delivery',{kind:'delivery'});bank(a);}}
 if(m.type==='reset'&&p.joined){p.x=8;p.z=12;p.yaw=0;p.vehicle=false;p.lastMove=now;}
 if(m.type==='chat'&&p.joined&&now-p.lastChat>=800){p.lastChat=now;const text=String(m.text||'').trim().slice(0,240);if(text)for(const [other,q]of clients)if(q.joined)send(other,{type:'chat',name:p.name,text});}
 if(m.type==='dial'&&p.joined){if(now-p.lastDial<2000){send(ws,{type:'call-error',message:'Wait before calling again'});return;}p.lastDial=now;const other=[...clients.values()].find(q=>q.joined&&q.number===String(m.number));if(!other||other===p||other.callId||p.callId){send(ws,{type:'call-error',message:!other?'Player is offline or number not found':'Line busy'});return;}
 const c={id:randomUUID(),a:p.id,b:other.id,state:'ringing',timer:null};calls.set(c.id,c);p.callId=other.callId=c.id;send(ws,{type:'call-ringing',callId:c.id,number:other.number,name:other.name});send(other.ws,{type:'call-incoming',callId:c.id,number:p.number,name:p.name});c.timer=setTimeout(()=>endCall(c,'No answer'),ringTimeout);}
 if(m.type==='answer'){const c=calls.get(m.callId);if(c&&c.b===p.id&&c.state==='ringing'){c.state='active';clearTimeout(c.timer);for(const id of[c.a,c.b])send(playerById(id)?.ws,{type:'call-active',callId:c.id});}}
 if(m.type==='hangup'){const c=calls.get(m.callId);if(participant(p,c))endCall(c,'Call ended');}
 }catch{ws.close(1007,'Invalid message');}});
 ws.on('close',()=>{endCall(calls.get(p.callId),'Player disconnected');clients.delete(ws);tokens.delete(p.token);});ws.on('error',()=>{});});
 const tick=setInterval(()=>{const players=[...clients.values()].filter(p=>p.joined).map(({id,name,number,x,z,yaw,vehicle,outfit})=>({id,name,number,x,z,yaw,vehicle,outfit}));for(const [ws,p]of clients)if(p.joined)send(ws,{type:'state',players});},80);
 const ping=setInterval(()=>{for(const [ws,p]of clients){if(!p.alive){ws.terminate();continue;}p.alive=false;ws.ping();}},30000);
 const cleanup=setInterval(()=>{for(const[id,c]of clips)if(Date.now()>c.expires)dropClip(id);},1000);
 return{server,wss,close:async()=>{clearInterval(tick);clearInterval(ping);clearInterval(cleanup);for(const c of calls.values())clearTimeout(c.timer);for(const ws of clients.keys())ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||3000),origins=(process.env.ALLOWED_ORIGINS||`http://localhost:${port},http://127.0.0.1:${port}`).split(',').map(s=>s.trim()).filter(Boolean);const game=createGameServer({origins,walletPath:resolve('data/wallets.json'),tollOptions:{ramadan:process.env.SALIK_RAMADAN==='true',specialDay:process.env.SALIK_SPECIAL_DAY==='true'}});game.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Game ready at http://localhost:${port}. Website, multiplayer and private voice clips share this server.`));}
