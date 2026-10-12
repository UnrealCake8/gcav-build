import {authenticatedClient,requireMethod,sendJson} from '../lib/supabase-api.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req,res){
  if(!requireMethod(req,res,'POST'))return;
  const auth=await authenticatedClient(req);
  if(auth.error){sendJson(res,auth.status||401,{error:auth.error});return;}
  const{recipientId,amount,requestId}=req.body||{};
  if(!uuid.test(String(recipientId||''))||!uuid.test(String(requestId||''))||
     typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>10000||
     Math.round(amount*100)!==amount*100){
    sendJson(res,400,{error:'Enter a valid player and an amount in AED (up to 10,000).'});return;
  }
  const{data,error}=await auth.supabase.rpc('gca_transfer_money',{
    p_recipient:recipientId,
    p_amount:amount,
    p_request_id:requestId,
  });
  if(error){
    const message=error.message||'';
    const status=/Sign in required/i.test(message)?401:/Insufficient funds|Choose another player|Invalid transfer|Request id already used/i.test(message)?400:502;
    sendJson(res,status,{error:status===502?'The transfer could not be completed. Try again.':message});return;
  }
  sendJson(res,200,data);
}
