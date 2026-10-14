import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../api/config.js';
import game from '../api/game.js';
import wallet from '../api/wallet.js';
import transfer from '../api/transfer.js';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const assets=new Map([
  ['/','index.html'],['/index.html','index.html'],['/game.js','game.js'],['/style.css','style.css'],
]);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const routes=new Map([['/api/config',config],['/api/game',game],['/api/wallet',wallet],['/api/transfer',transfer]]);

function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function readJson(req){
  const parts=[];let length=0;
  for await(const part of req){length+=part.length;if(length>65536)throw Object.assign(new Error('Request too large'),{status:413});parts.push(part);}
  if(!length)return{};
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
}

export function createLocalServer(){
  return http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const handler=routes.get(url.pathname);
    if(handler){
      try{
        req.body=['POST','PUT','PATCH'].includes(req.method)?await readJson(req):undefined;
        res.status=function(code){res.statusCode=code;return res;};
        const setHeader=res.setHeader.bind(res);
        res.setHeader=(...args)=>{setHeader(...args);return res;};
        await handler(req,res);
      }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Request failed'});else res.end();}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return;}
    const file=assets.get(url.pathname);
    if(!file){json(res,404,{error:'Not found'});return;}
    try{
      const data=await readFile(resolve(root,file));
      res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'microphone=(self)'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{json(res,404,{error:'Build the game first with npm run build'});}
  });
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3000);
  createLocalServer().listen(port,'127.0.0.1',()=>console.log(`Local static preview at http://127.0.0.1:${port}. Multiplayer and game actions use Supabase Realtime and authenticated API routes.`));
}