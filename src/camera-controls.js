const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export const cameraFollowAlpha=dt=>1-Math.exp(-Math.max(0,dt)*12);
export function screenMovement(x,forward,yaw){return {x:x*Math.cos(yaw)-forward*Math.sin(yaw),z:-x*Math.sin(yaw)-forward*Math.cos(yaw)};}
// One independent gesture owner per surface; joystick pointers never enter this map.
export function createCameraControls(canvas,{enabled,onChange=()=>{},size=()=>({width:canvas.clientWidth,height:canvas.clientHeight}),now=()=>performance.now()}={}){
 const state={yaw:0,pitch:.35,zoom:1,lastInput:0};const pointers=new Map();
 function changed(){state.lastInput=now();onChange(state);}
 function stop(){for(const id of pointers.keys()){if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}pointers.clear();}
 function recenter(heading=0){stop();state.yaw=heading;state.pitch=.35;state.zoom=1;changed();}
 function zoom(amount){state.zoom=clamp(state.zoom*amount,.65,1.65);changed();}
 canvas.addEventListener('pointerdown',e=>{if(!enabled()||(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)||pointers.size>=2)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{const previous=pointers.get(e.pointerId);if(!previous)return;if(!enabled()){stop();return;}e.preventDefault();const current={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(current.x-other.x,current.y-other.y);if(before>5&&after>5)zoom(before/after);}else{const viewport=size();state.yaw-= (current.x-previous.x)/Math.max(viewport.width,320)*Math.PI*2;state.yaw=Math.atan2(Math.sin(state.yaw),Math.cos(state.yaw));state.pitch=clamp(state.pitch+(current.y-previous.y)/Math.max(viewport.height,240)*Math.PI,.08,1.1);changed();}pointers.set(e.pointerId,current);});
 const end=e=>pointers.delete(e.pointerId);for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end);
 canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();zoom(Math.exp(clamp(e.deltaY,-150,150)*.0015));},{passive:false});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 return {state,stop,recenter,get dragging(){return pointers.size>0;},update(dt,{driving=false,heading=0,moving=false}={}){if(driving&&moving&&!pointers.size&&now()-state.lastInput>1800)state.yaw+=angleDelta(state.yaw,heading+Math.PI)*(1-Math.exp(-dt*2.5));}};
}
