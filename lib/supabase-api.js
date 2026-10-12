import {createClient} from '@supabase/supabase-js';

export function sendJson(res,status,body){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

export function readBearer(req){
  const header=req.headers.authorization||'';
  const match=header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]||null;
}

export function publicSupabaseConfig(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Supabase is not configured');
  return{url,key};
}

export async function authenticatedClient(req){
  const accessToken=readBearer(req);
  if(!accessToken)return{error:'Sign in required'};
  let config;
  try{config=publicSupabaseConfig();}catch{return{error:'Account service is not configured',status:503};}
  const supabase=createClient(config.url,config.key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:`Bearer ${accessToken}`}},
  });
  const{data,error}=await supabase.auth.getUser(accessToken);
  if(error||!data.user)return{error:'Your session is invalid or expired',status:401};
  return{supabase,user:data.user};
}

export function requireMethod(req,res,method){
  if(req.method===method)return true;
  res.setHeader('Allow',method);
  sendJson(res,405,{error:`Use ${method}`});
  return false;
}
