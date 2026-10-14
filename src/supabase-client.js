import {createClient} from '@supabase/supabase-js';

let clientPromise;
export function getSupabase(){
  clientPromise ||= fetch('/api/config',{headers:{Accept:'application/json'}})
    .then(async response=>{
      if(!response.ok)throw new Error('Account service is not configured on this deployment.');
      const config=await response.json();
      return createClient(config.url,config.key);
    });
  return clientPromise;
}

export async function ensurePlayerSession(){
  const supabase=await getSupabase();
  let {data:{session}}=await supabase.auth.getSession();
  if(!session){
    const result=await supabase.auth.signInAnonymously();
    if(result.error)throw result.error;
    session=result.data.session;
  }
  if(!session)throw new Error('Could not start a guest account.');
  await supabase.realtime.setAuth(session.access_token);
  return {supabase,session};
}
