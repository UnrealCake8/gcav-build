import {authenticatedClient,requireMethod,sendJson} from '../lib/supabase-api.js';

export default async function handler(req,res){
  if(!requireMethod(req,res,'GET'))return;
  const auth=await authenticatedClient(req);
  if(auth.error){sendJson(res,auth.status||401,{error:auth.error});return;}
  const{data:profile,error:profileError}=await auth.supabase
    .from('gca_profiles').select('display_name').eq('user_id',auth.user.id).maybeSingle();
  if(profileError){sendJson(res,502,{error:'Could not load your account'});return;}
  const{data:wallet,error:walletError}=await auth.supabase
    .from('gca_wallets').select('balance,updated_at').eq('user_id',auth.user.id).maybeSingle();
  if(walletError){sendJson(res,502,{error:'Could not load your wallet'});return;}
  const{data:entries,error:ledgerError}=await auth.supabase
    .from('gca_ledger').select('id,amount,label,kind,metadata,created_at')
    .eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(100);
  if(ledgerError){sendJson(res,502,{error:'Could not load your transaction history'});return;}
  if(!wallet){sendJson(res,409,{error:'Your game wallet is still being created. Try again shortly.'});return;}
  sendJson(res,200,{user:{id:auth.user.id,email:auth.user.email||null},profile,wallet,entries:entries||[]});
}
