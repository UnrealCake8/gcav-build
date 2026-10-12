import {publicSupabaseConfig,sendJson,requireMethod} from '../lib/supabase-api.js';

export default function handler(req,res){
  if(!requireMethod(req,res,'GET'))return;
  try{
    const{url,key}=publicSupabaseConfig();
    sendJson(res,200,{url,key});
  }catch{
    sendJson(res,503,{error:'Account service is not configured'});
  }
}
