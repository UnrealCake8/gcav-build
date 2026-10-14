export function soundMix({enabled=true,active=true,driving=false,speed=0}={}){
 const motion=Math.max(0,Math.min(1,Math.abs(Number(speed)||0)/28));
 return {
  ambient:enabled&&active?0.18:0,
  engine:enabled&&active&&driving?0.028+motion*0.07:0,
  road:enabled&&active&&driving?motion*0.035:0,
  engineHz:48+motion*105,
 };
}

export function createSoundscape(){
 const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;
 let context=null,master=null,ambientGain=null,engineGain=null,roadGain=null,enginePitch=null,engineOvertone=null,lastUpdate=0;
 let enabled=localStorage.getItem('gca-sound')!=='off';

 function noiseSource(){
  const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;return source;
 }
 function start(){
  if(!AudioContextClass)return false;
  if(!context){
   context=new AudioContextClass();master=context.createGain();master.gain.value=.7;master.connect(context.destination);
   ambientGain=context.createGain();ambientGain.gain.value=0;const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=360;const wind=noiseSource();wind.connect(lowpass);lowpass.connect(ambientGain);ambientGain.connect(master);wind.start();
   const surf=noiseSource(),surfFilter=context.createBiquadFilter(),surfGain=context.createGain();surfFilter.type='bandpass';surfFilter.frequency.value=620;surfFilter.Q.value=.5;surfGain.gain.value=.2;surf.connect(surfFilter);surfFilter.connect(surfGain);surfGain.connect(ambientGain);surf.start();
   engineGain=context.createGain();engineGain.gain.value=0;const engineFilter=context.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=420;enginePitch=context.createOscillator();enginePitch.type='sawtooth';enginePitch.frequency.value=48;engineOvertone=context.createOscillator();engineOvertone.type='sine';engineOvertone.frequency.value=96;const overtoneGain=context.createGain();overtoneGain.gain.value=.3;enginePitch.connect(engineFilter);engineOvertone.connect(overtoneGain);overtoneGain.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(master);enginePitch.start();engineOvertone.start();
   roadGain=context.createGain();roadGain.gain.value=0;const roadFilter=context.createBiquadFilter();roadFilter.type='highpass';roadFilter.frequency.value=140;const roadNoise=noiseSource();roadNoise.connect(roadFilter);roadFilter.connect(roadGain);roadGain.connect(master);roadNoise.start();
  }
  if(context.state==='suspended')context.resume().catch(()=>{});
  return true;
 }
 function setEnabled(value){enabled=!!value;localStorage.setItem('gca-sound',enabled?'on':'off');if(enabled)start();else if(context)master.gain.setTargetAtTime(0,context.currentTime,.04);return enabled;}
 function update(state={}){
  if(!context||context.state!=='running')return;
  const now=context.currentTime;if(now-lastUpdate<.09)return;lastUpdate=now;
  const mix=soundMix({...state,enabled});
  master.gain.setTargetAtTime(.7,now,.12);
  ambientGain.gain.setTargetAtTime(mix.ambient,now,.8);
  engineGain.gain.setTargetAtTime(mix.engine,now,.08);
  roadGain.gain.setTargetAtTime(mix.road,now,.15);
  enginePitch.frequency.setTargetAtTime(mix.engineHz,now,.12);
  engineOvertone.frequency.setTargetAtTime(mix.engineHz*2,now,.12);
 }
 return {start,update,setEnabled,get enabled(){return enabled;},get supported(){return !!AudioContextClass;}};
}
