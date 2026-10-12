import {createClient} from '@supabase/supabase-js';

let clientPromise;
function getClient(){
  clientPromise ||= fetch('/api/config',{headers:{Accept:'application/json'}})
    .then(async response=>{
      if(!response.ok)throw new Error('Account service is not configured on this deployment.');
      const config=await response.json();
      return createClient(config.url,config.key);
    });
  return clientPromise;
}

export async function renderAccount(container,escapeHtml){
  container.querySelector('#accountContent')?.remove();
  const root=document.createElement('div');root.id='accountContent';container.append(root);
  root.insertAdjacentHTML('beforeend','<div class="card"><p>Loading your online account…</p></div>');
  try{
    const supabase=await getClient();
    const{data:{session}}=await supabase.auth.getSession();
    root.innerHTML='';
    if(!session){
      root.insertAdjacentHTML('beforeend',`<div class="card"><b>Save your account and online wallet</b><p>Sign in to see your cloud balance. New accounts start with AED 500.</p><label>Email<input id="accountEmail" type="email" autocomplete="email" maxlength="254"></label><label>Password<input id="accountPassword" type="password" autocomplete="current-password" minlength="8"></label><label>Player name<input id="accountName" maxlength="20" autocomplete="nickname"></label><button id="accountSignIn">Sign in</button> <button id="accountSignUp">Create account</button><p id="accountStatus" role="status"></p></div>`);
      const status=root.querySelector('#accountStatus');
      async function submit(mode){
        const email=root.querySelector('#accountEmail').value.trim();
        const password=root.querySelector('#accountPassword').value;
        const displayName=root.querySelector('#accountName').value.trim();
        status.textContent='';
        if(!email||password.length<8){status.textContent='Enter your email and a password of at least 8 characters.';return;}
        const buttons=root.querySelectorAll('#accountSignIn,#accountSignUp');buttons.forEach(button=>button.disabled=true);
        try{
          const result=mode==='signup'
            ?await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||'Player'}}})
            :await supabase.auth.signInWithPassword({email,password});
          if(result.error)throw result.error;
          if(result.data.session){await renderAccount(container,escapeHtml);return;}
          status.textContent='Check your email to confirm your account, then sign in here.';
        }catch(error){status.textContent=error.message||'Could not complete sign-in. Try again.';}
        finally{buttons.forEach(button=>button.disabled=false);}
      }
      root.querySelector('#accountSignIn').onclick=()=>submit('signin');
      root.querySelector('#accountSignUp').onclick=()=>submit('signup');
      return;
    }

    const response=await fetch('/api/wallet',{headers:{Authorization:`Bearer ${session.access_token}`,Accept:'application/json'},cache:'no-store'});
    const account=await response.json();
    if(!response.ok)throw new Error(account.error||'Could not load your online wallet.');
    root.insertAdjacentHTML('beforeend',`<div class="card"><b>Online account</b><p>${escapeHtml(account.profile?.display_name||'Player')} · ${escapeHtml(account.user.email||'')}</p><h2>AED ${Number(account.wallet.balance).toFixed(2)}</h2><p>Cloud wallet · saved to your account</p><button id="accountSignOut">Sign out</button></div>`);
    for(const entry of account.entries||[]){
      const amount=Number(entry.amount);
      root.insertAdjacentHTML('beforeend',`<div class="msg"><small>${escapeHtml(new Date(entry.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dubai'}))} GST</small>${escapeHtml(entry.label)}<br><b>${amount>=0?'+':'−'} AED ${Math.abs(amount).toFixed(2)}</b></div>`);
    }
    root.querySelector('#accountSignOut').onclick=async()=>{await supabase.auth.signOut();await renderAccount(container,escapeHtml);};
  }catch(error){
    root.innerHTML='';
    root.insertAdjacentHTML('beforeend',`<div class="card"><b>Account unavailable</b><p>${escapeHtml(error.message||'Please try again later.')}</p></div>`);
  }
}
