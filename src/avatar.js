import * as T from 'three';
import {getOutfit} from './outfits.js';
const material=color=>new T.MeshStandardMaterial({color,roughness:.85});
function mesh(parent,w,h,d,x,y,z,mat){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function pivot(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
export function applyOutfit(avatar,id){const rig=avatar.userData,o=getOutfit(id);rig.outfit=o.id;rig.top.color.set(o.top);rig.pants.color.set(o.pants);rig.cap.visible=o.cap;rig.robe.visible=!!o.robe;rig.tie.visible=o.id==='formal';}
export function createAvatar(scene,id='street'){
 const avatar=new T.Group(),body=pivot(avatar,0,0,0),top=material('#d8fc69'),pants=material('#26333f'),skin=material('#c69873'),shoe=material('#252a2f');
 mesh(body,.72,.85,.4,0,1.4,0,top);mesh(body,.34,.14,.3,0,1.88,0,skin);mesh(body,.5,.52,.48,0,2.16,0,skin);
 mesh(body,.51,.15,.49,0,2.38,0,material('#302c29'));const cap=mesh(body,.58,.12,.55,0,2.48,.03,shoe);mesh(cap,.52,.045,.25,0,-.025,.27,shoe);
 // Small facial details face +Z, matching movement yaw and car direction.
 for(const x of [-.13,.13])mesh(body,.055,.06,.018,x,2.18,.245,shoe);
 const arms=[],legs=[],knees=[];
 for(const side of [-1,1]){const arm=pivot(body,side*.49,1.77,0);mesh(arm,.24,.52,.25,0,-.24,0,top);mesh(arm,.21,.4,.22,0,-.68,0,skin);arms.push(arm);
 const leg=pivot(body,side*.2,.98,0);mesh(leg,.27,.48,.3,0,-.23,0,pants);const knee=pivot(leg,0,-.46,0);mesh(knee,.25,.4,.28,0,-.2,0,pants);mesh(knee,.29,.14,.42,0,-.43,.06,shoe);legs.push(leg);knees.push(knee);}
 const robe=mesh(body,.8,1.35,.47,0,.97,0,top),tie=mesh(body,.105,.57,.03,0,1.43,.215,material('#eeeeee'));
 avatar.userData={body,top,pants,cap,robe,tie,arms,legs,knees,phase:0,blend:0,lastX:null,lastZ:null};applyOutfit(avatar,id);scene.add(avatar);return avatar;
}
export function stepGait(state,distance,dt){
 // Spawn/reset teleports must never produce a walking cycle.
 const moving=distance>0.0005&&distance<Math.max(1,dt*12);const blend=state.blend+(Number(moving)-state.blend)*(1-Math.exp(-dt*12));
 return {phase:moving?(state.phase+distance*Math.PI*2/2.7)%(Math.PI*2):state.phase,blend};
}
export function setAvatarPose(avatar,pose='standing'){avatar.userData.pose=pose;}
export function animateAvatar(avatar,dt,walking=true){const r=avatar.userData;if(r.pose==='sitting'){r.body.position.y=-.25;r.body.rotation.z=0;r.legs[0].rotation.x=r.legs[1].rotation.x=-.1;r.knees[0].rotation.x=r.knees[1].rotation.x=-1.15;r.arms[0].rotation.x=r.arms[1].rotation.x=0;return;}if(r.pose==='sleeping'){r.body.position.y=1.1;r.body.rotation.z=Math.PI/2;r.legs[0].rotation.x=r.legs[1].rotation.x=0;r.knees[0].rotation.x=r.knees[1].rotation.x=0;r.arms[0].rotation.x=r.arms[1].rotation.x=0;return;}r.body.position.y=0;r.body.rotation.z=0;const x=avatar.position.x,z=avatar.position.z;const distance=r.lastX===null?0:Math.hypot(x-r.lastX,z-r.lastZ);r.lastX=x;r.lastZ=z;Object.assign(r,stepGait(r,walking?distance:0,dt));
 const swing=Math.sin(r.phase)*.62*r.blend;r.legs[0].rotation.x=swing;r.legs[1].rotation.x=-swing;r.arms[0].rotation.x=-swing*.85;r.arms[1].rotation.x=swing*.85;
 r.knees[0].rotation.x=Math.max(0,-Math.sin(r.phase))*.55*r.blend;r.knees[1].rotation.x=Math.max(0,Math.sin(r.phase))*.55*r.blend;
 r.body.position.y=Math.abs(Math.sin(r.phase*2))*.045*r.blend;r.body.rotation.z=Math.sin(r.phase)*.025*r.blend;r.robe.rotation.x=swing*.08;
}
