import {ensurePlayerSession,getSupabase} from './supabase-client.js';

export class RealtimeSocket {
  constructor(){
    this.readyState=0;
    this.onopen=null;
    this.onclose=null;
    this.onmessage=null;
    this.onerror=null;
    this.channels=[];
    this.closed=false;
    this.connect();
  }

  async connect(){
    try{
      const {supabase,session}=await ensurePlayerSession();
      this.supabase=supabase;
      const topics=['gcav:world','gcav:user:'+session.user.id];
      for(const topic of topics){
        const channel=supabase.channel(topic,{config:{private:true}});
        channel.on('broadcast',{event:'game-event'},({payload})=>this.deliver(payload));
        this.channels.push(channel);
      }
      await Promise.all(this.channels.map(channel=>new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Realtime connection timed out')),10000);
        channel.subscribe(status=>{
          if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
          else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
            clearTimeout(timeout);reject(new Error('Realtime '+status.toLowerCase()));
          }
        });
      })));
      if(this.closed)return this.cleanup();
      this.readyState=1;
      this.onopen?.();
    }catch(error){
      this.onerror?.(error);
      this.readyState=3;
      this.cleanup();
      this.onclose?.();
    }
  }

  deliver(message){
    if(this.readyState!==1||!message||typeof message.type!=='string')return;
    this.onmessage?.({data:JSON.stringify(message)});
  }

  async send(raw){
    if(this.readyState!==1)throw new Error('Realtime is not connected');
    let message;
    try{message=JSON.parse(raw);}catch{return;}
    if(!message||typeof message.type!=='string')return;
    const {type:action,...payload}=message;
    try{
      const {session}=await (await getSupabase()).auth.getSession().then(({data})=>data);
      if(!session)throw new Error('Sign in required');
      const response=await fetch('/api/game',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({action,payload}),
        cache:'no-store',
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Game action failed');
      for(const event of result.events||[])this.deliver(event);
    }catch(error){
      this.onerror?.(error);
      this.deliver({type:'notice',text:error.message||'Game action failed'});
    }
  }

  async cleanup(){
    const channels=this.channels.splice(0);
    if(channels.length&&this.supabase)await Promise.all(channels.map(channel=>this.supabase.removeChannel(channel).catch(()=>{})));
  }

  close(){
    if(this.closed)return;
    this.closed=true;
    this.readyState=3;
    this.cleanup().finally(()=>this.onclose?.());
  }
}
