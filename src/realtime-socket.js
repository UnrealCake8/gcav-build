import {ensurePlayerSession,getSupabase} from './supabase-client.js';

const idempotentActions=new Set([
  'role','property-acquire','property-set-price','property-renew-request',
  'property-renew-answer','purchase','shift','transfer','pos-create',
  'pos-answer','rob','arrest','bail','job-start','dial','answer','hangup',
]);
const checkpointMs=1000,heartbeatMs=20000,chatCooldownMs=800;

export class RealtimeSocket {
  constructor(){
    this.readyState=0;this.onopen=null;this.onclose=null;this.onmessage=null;this.onerror=null;
    this.channels=[];this.playerChannels=new Map();this.players=new Map();this.closed=false;
    this.lastCheckpoint=0;this.lastVehicle=null;this.lastState={x:8,z:12,yaw:0,vehicle:false};this.lastChat=0;this.heartbeat=null;
    this.connect();
  }

  async connect(){
    try{
      const {supabase,session}=await ensurePlayerSession();
      this.supabase=supabase;this.userId=session.user.id;
      const topics=['gcav:world','gcav:user:'+this.userId];
      for(const topic of topics){
        const channel=supabase.channel(topic,{config:{private:true}});
        channel.on('broadcast',{event:'game-event'},({payload})=>this.receiveServerEvent(payload));
        this.channels.push(channel);
      }
      await Promise.all(this.channels.map(channel=>this.subscribe(channel)));
      await this.addPlayerChannel(this.userId);
      if(this.closed)return this.cleanup();
      this.readyState=1;this.onopen?.();
      this.heartbeat=setInterval(()=>this.apiAction('move',this.lastState).catch(error=>this.onerror?.(error)),heartbeatMs);
    }catch(error){
      this.onerror?.(error);this.readyState=3;await this.cleanup();this.onclose?.();
    }
  }

  subscribe(channel){
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Realtime connection timed out')),10000);
      channel.subscribe(status=>{
        if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
        else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          clearTimeout(timeout);reject(new Error('Realtime '+status.toLowerCase()));
        }
      });
    });
  }

  async addPlayerChannel(id){
    if(this.playerChannels.has(id))return;
    const channel=this.supabase.channel('gcav:player:'+id,{config:{private:true}});
    channel.on('broadcast',{event:'player-state'},({payload})=>this.receivePlayerState(id,payload));
    channel.on('broadcast',{event:'player-chat'},({payload})=>this.receivePlayerChat(id,payload));
    this.playerChannels.set(id,channel);
    try{await this.subscribe(channel);}
    catch(error){this.playerChannels.delete(id);await this.supabase.removeChannel(channel);this.onerror?.(error);}
  }

  receiveServerEvent(event){
    if(!event||typeof event.type!=='string')return;
    if(event.type==='state'&&Array.isArray(event.players)){
      this.players=new Map(event.players.filter(p=>p&&typeof p.id==='string').map(p=>[p.id,p]));
      for(const player of this.players.values())this.addPlayerChannel(player.id);
      for(const [id,channel] of this.playerChannels){
        if(this.players.has(id))continue;
        this.playerChannels.delete(id);this.supabase.removeChannel(channel);
      }
    }
    this.deliver(event);
  }

  receivePlayerState(id,payload){
    if(!payload||!this.players.has(id))return;
    const x=Number(payload.x),z=Number(payload.z),yaw=Number(payload.yaw);
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(yaw)||Math.abs(x)>100000||Math.abs(z)>100000)return;
    const player=this.players.get(id);
    this.players.set(id,{...player,x,z,yaw,vehicle:payload.vehicle===true});
    this.deliver({type:'state',players:[...this.players.values()]});
  }

  receivePlayerChat(id,payload){
    if(!payload||typeof payload.text!=='string'||!this.players.has(id))return;
    const text=payload.text.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,240);
    if(!text)return;
    this.deliver({type:'chat',name:this.players.get(id).name||'Player',text});
  }

  deliver(message){
    if(this.readyState!==1||!message||typeof message.type!=='string')return;
    this.onmessage?.({data:JSON.stringify(message)});
  }

  async apiAction(action,payload){
    const {data:{session}}=await (await getSupabase()).auth.getSession();
    if(!session)throw new Error('Sign in required');
    const request={method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,payload}),cache:'no-store'};
    let response,result;
    for(let attempt=0;attempt<2;attempt++){
      try{response=await fetch('/api/game',request);result=await response.json();if(response.status<500||attempt===1)break;}
      catch(error){if(attempt===1)throw error;}
    }
    if(!response.ok)throw new Error(result.error||'Game action failed');
    for(const event of result.events||[])this.receiveServerEvent(event);
    return result;
  }

  async send(raw){
    if(this.readyState!==1)throw new Error('Realtime is not connected');
    let message;try{message=JSON.parse(raw);}catch{return;}
    if(!message||typeof message.type!=='string')return;
    const {type:action,...payload}=message;
    try{
      if(action==='move'){
        const state={x:Number(payload.x),z:Number(payload.z),yaw:Number(payload.yaw),vehicle:payload.vehicle===true};
        if(!Object.values(state).slice(0,3).every(Number.isFinite))return;
        this.lastState=state;
        let channel=this.playerChannels.get(this.userId);
        if(!channel){await this.addPlayerChannel(this.userId);channel=this.playerChannels.get(this.userId);}
        if(!channel)throw new Error('Player channel is not ready');
        await channel.send({type:'broadcast',event:'player-state',payload:state});
        const now=Date.now();
        if(now-this.lastCheckpoint>=checkpointMs||state.vehicle!==this.lastVehicle){
          this.lastCheckpoint=now;this.lastVehicle=state.vehicle;
          await this.apiAction('move',state);
        }
        return;
      }
      if(action==='chat'){
        const now=Date.now(),text=String(payload.text||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,240);
        if(!text||now-this.lastChat<chatCooldownMs)return;
        this.lastChat=now;
        const channel=this.playerChannels.get(this.userId);
        if(!channel)throw new Error('Player channel is not ready');
        const status=await channel.send({type:'broadcast',event:'player-chat',payload:{text}});
        if(status!=='ok')throw new Error('Realtime did not accept the message');
        this.deliver({type:'chat',name:this.players.get(this.userId)?.name||'You',text});
        return;
      }
      if(idempotentActions.has(action)&&!payload.requestId)payload.requestId=crypto.randomUUID();
      await this.apiAction(action,payload);
    }catch(error){this.onerror?.(error);this.deliver({type:'notice',text:error.message||'Game action failed'});}
  }

  async cleanup(){
    clearInterval(this.heartbeat);this.heartbeat=null;
    const channels=[...this.channels.splice(0),...this.playerChannels.values()];this.playerChannels.clear();
    if(channels.length&&this.supabase)await Promise.all(channels.map(channel=>this.supabase.removeChannel(channel).catch(()=>{})));
  }

  close(){if(this.closed)return;this.closed=true;this.readyState=3;this.cleanup().finally(()=>this.onclose?.());}
}
