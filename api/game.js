import {authenticatedClient,requireMethod,sendJson} from '../lib/supabase-api.js';

const actions=new Set([
  'join','role','enter','exit','property-acquire','property-set-price',
  'property-renew-request','property-renew-answer','purchase','shift',
  'transfer','pos-create','pos-answer','rob','arrest','bail','outfit',
  'move','job-start','reset','chat','dial','answer','hangup',
]);

export default async function handler(req,res){
  if(!requireMethod(req,res,'POST'))return;
  const auth=await authenticatedClient(req);
  if(auth.error){sendJson(res,auth.status||401,{error:auth.error});return;}
  const {action,payload}=req.body||{};
  if(!actions.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload)){
    sendJson(res,400,{error:'Invalid game action'});return;
  }
  const {data,error}=await auth.supabase.rpc('gca_game_action',{
    p_action:action,
    p_payload:payload,
  });
  if(error){
    const message=error.message||'';
    const status=/Sign in required|permission denied/i.test(message)?401:/not found|insufficient|invalid|busy|unavailable|too close|cooldown|denied/i.test(message)?400:502;
    sendJson(res,status,{error:status===502?'The game action could not be completed.':message});return;
  }
  sendJson(res,200,data||{events:[]});
}
