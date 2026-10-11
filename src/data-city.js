import {landmarks} from './city-life.js';
import * as T from 'three';import {highwayRoads,highwayBounds,connector,nearestRoad,pointSegmentDistance} from './road-network.js';import {tollGates} from './salik.js';import {surface} from './waterfront.js';
export function createDataCity(scene,{box,mat}){
 const existing=new Set(scene.children),nightMaterials=[],lamps=[];
 const sand=mat('#a4aaa0'),roadmat=mat('#464b4f'),white=mat('#e3e0d4'),stone=mat('#a9aaa4'),glass=mat('#6e919e',.36,.2),green=mat('#6d8564'),metal=mat('#354249');
 sand.roughness=1;roadmat.map=surface('asphalt');roadmat.color.set('#ffffff');glass.map=surface('windows');glass.color.set('#ffffff');
 roadmat.depthWrite=false;roadmat.polygonOffset=true;roadmat.polygonOffsetFactor=-1;roadmat.polygonOffsetUnits=-1;const paint=mat('#e3e0d4');paint.depthWrite=false;paint.polygonOffset=true;paint.polygonOffsetFactor=-2;paint.polygonOffsetUnits=-2;
 const b=highwayBounds;box(b.maxX-b.minX,.4,b.maxZ-b.minZ,(b.minX+b.maxX)/2,.1,(b.minZ+b.maxZ)/2,sand);
 const batches=new Map(),geo=new T.BoxGeometry(1,1,1),matrix=new T.Matrix4(),quat=new T.Quaternion();
 function part(w,h,d,x,y,z,m,yaw=0){if(!batches.has(m))batches.set(m,[]);quat.setFromAxisAngle(new T.Vector3(0,1,0),yaw);matrix.compose(new T.Vector3(x,y,z),quat,new T.Vector3(w,h,d));batches.get(m).push(matrix.clone());}
 function strip(a,b,width,y,m){const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)return;part(width,.04,length+.3,(a.x+b.x)/2,y,(a.z+b.z)/2,m,Math.atan2(b.x-a.x,b.z-a.z));}
 for(const road of [...highwayRoads,connector]){for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);if(length<.1)continue;strip(a,b,road.width,.65,roadmat);
 for(const side of [-1,1]){const ox=Math.cos(yaw)*road.width/2*side,oz=-Math.sin(yaw)*road.width/2*side;strip({x:a.x+ox,z:a.z+oz},{x:b.x+ox,z:b.z+oz},.12,.72,paint);}
 const lanes=Math.min(3,road.lanes||2);for(let n=1;n<lanes;n++){const offset=-road.width/2+road.width*n/lanes;for(let t=3;t<length;t+=10)part(.12,.025,3,a.x+dx*t/length+Math.cos(yaw)*offset,.74,a.z+dz*t/length-Math.sin(yaw)*offset,paint,yaw);}}}
 // Authored land-cover patches; geography is approximate, highways retain imported coordinates.
 const paving=mat('#bfc0b6'),grass=mat('#728767'),parking=mat('#717b7c');
 for(let k=0;k<highwayRoads.length;k+=3){const r=highwayRoads[k],v=r.points[Math.floor(r.points.length/2)];part(110,.05,95,v.x,.34,v.z,paving);if(k%12===0){part(36,.06,26,v.x+40,.39,v.z+38,grass);part(24,.07,30,v.x-40,.4,v.z+38,parking);for(let n=-2;n<=2;n++)part(9,.03,.15,v.x-40,.47,v.z+38+n*5,paint);}}
 for(const l of landmarks){part(l.w+80,.06,l.d+80,l.x,.36,l.z,paving);part(28,.08,20,l.x-l.w/2-20,.42,l.z,grass);}
 const buildings=[];
 function building(x,z,w,d,h,index){if(landmarks.some(l=>Math.abs(x-l.x)<l.w/2+w/2+30&&Math.abs(z-l.z)<l.d/2+d/2+30))return;if(buildings.some(b=>Math.abs(x-b.x)<(w+b.w)/2+22&&Math.abs(z-b.z)<(d+b.d)/2+22))return;if(landmarks.some(l=>pointSegmentDistance({x,z},l.entrance,nearestRoad(l.entrance).point)<Math.hypot(w,d)/2+6))return;if(nearestRoad({x,z}).distance<Math.hypot(w,d)/2+14)return;box(w,h,d,x,h/2+.4,z,index%3===0?white:glass,true);buildings.push({x,z,w,d});part(w+1,.5,d+1,x,h+.7,z,metal);for(let y=4;y<h;y+=5)part(w+.15,.12,d+.15,x,y,z,stone);}
 // Buildings remain procedural; the drivable highway centre-lines come from OSM.
 for(let x=-150;x<=175;x+=64)for(let z=-170;z<=165;z+=64){if(Math.hypot(x-8,z-12)<30)continue;building(x,z,18,18,18+Math.abs(x*7+z*3)%70,Math.abs(x+z));}
 for(let k=0;k<highwayRoads.length;k+=5){const r=highwayRoads[k],p=r.points[Math.floor(r.points.length/2)],next=r.points.at(-1),yaw=Math.atan2(next.x-p.x,next.z-p.z);for(const side of [-1,1]){const x=p.x+Math.cos(yaw)*65*side,z=p.z-Math.sin(yaw)*65*side;building(x,z,14,14,8+k%40,k);}}
 part(70,.12,55,8,.4,12,stone);part(20,.15,15,-12,.48,15,green); // Spawn plaza and access to the real road network.
 for(let x=-20;x<=30;x+=10){part(2,.18,.65,x,.9,32,mat('#896c4e'));part(2,.5,.15,x,1.2,31.7,metal);for(const dx of [-.7,.7])part(.1,.6,.5,x+dx,.6,32,metal);}
 const trunk=mat('#968465'),leaves=mat('#476b50'),trunkGeo=new T.CylinderGeometry(.18,.3,6,8),leafGeo=new T.SphereGeometry(1,8,5);
 for(let z=-15;z<=35;z+=12){if(nearestRoad({x:-24,z}).distance<14)continue;const t=new T.Mesh(trunkGeo,trunk);t.position.set(-24,3.4,z);t.castShadow=true;scene.add(t);const leaf=new T.Mesh(leafGeo,leaves);leaf.scale.set(2,1,2);leaf.position.set(-24,6.3,z);scene.add(leaf);}
 function label(text,x,y,z,width=15){const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#164b42';ctx.fillRect(0,0,512,100);ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText(text,256,63);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(width,2.7),new T.MeshBasicMaterial({map,side:T.DoubleSide}));sign.position.set(x,y,z);scene.add(sign);return sign;}
 for(const gate of tollGates){const {x,z,yaw,width}=gate;for(const side of [-1,1])part(.35,7,.35,x+Math.cos(yaw)*width/2*side,3.9,z-Math.sin(yaw)*width/2*side,metal);part(width+1,.5,.6,x,7.4,z,metal,yaw);const sign=label('SALIK · '+gate.name,x,6.4,z,width);sign.rotation.y=yaw;}
 for(let k=0;k<highwayRoads.length;k+=20){const r=highwayRoads[k],p=r.points[Math.floor(r.points.length/2)];label(r.ref+' · '+r.name.replace(/ \(.*\)/,''),p.x,6,p.z,17);}
 // Geographic anchors with deliberately simplified architecture and local access lanes.
 for(const l of landmarks){const {x,z,w,d,h}=l;part(w+30,.12,d+30,x,.42,z,stone);const e=l.entrance,access=nearestRoad(e).point;strip(e,access,7,.65,roadmat);
 part(14,.12,24,e.x+16,.48,e.z,roadmat);for(let n=-2;n<=2;n++)part(10,.04,.12,e.x+16,.51,e.z+n*4,white);
 if(l.kind==='tower'){for(let i=0;i<12;i++){const width=w*(1-i/14);box(width,14,width,x,7+i*14,z,glass,i===0);}part(.7,39,.7,x,188,z,white);}
 else if(l.kind==='frame'){const gold=mat('#c8a558',.35,.7);box(5,h,6,x-w/2,h/2,z,gold,true);box(5,h,6,x+w/2,h/2,z,gold,true);part(w+5,5,6,x,h,z,gold);}
 else if(l.kind==='museum'){box(15,3,8,x,1.5,z,stone,true);const ring=new T.Mesh(new T.TorusGeometry(10,3.8,12,40),mat('#bbc6ca',.25,.7));ring.scale.set(1.4,.8,1);ring.position.set(x,12,z);scene.add(ring);}
 else if(l.kind==='hotel'){box(w,4,d,x,2,z,white,true);for(let i=0;i<12;i++)part(w*(1-i/13),h/12,d,x,h/24+i*h/12,z,white);part(1,h+8,1,x-w/2,h/2,z,metal);}
 else {box(w,h,d,x,h/2,z,white,true);part(w-8,1,d-8,x,h+1,z,glass);part(12,7,18,x+w/2+4,3.5,z,glass);}
 buildings.push({x,z,w,d});label(l.name,x,Math.min(h+4,30),z,26);const door=new T.Mesh(new T.TorusGeometry(2,.18,8,24),new T.MeshBasicMaterial({color:'#8beac6'}));door.rotation.x=Math.PI/2;door.position.set(e.x,.7,e.z);scene.add(door);label('ENTER · E',e.x,3,e.z,8);
 }
 const glow=mat('#fff2b7');glow.emissive.set('#ffcf76');nightMaterials.push(glow,glass);
 for(let k=0;k<highwayRoads.length;k+=8){const r=highwayRoads[k],v=r.points[Math.floor(r.points.length/2)];for(const side of [-1,1]){const x=v.x+side*(r.width/2+3);part(.15,6,.15,x,3,v.z,metal);part(1,.2,1,x,6,v.z,glow);}}
 for(const [m,items]of batches){const instanced=new T.InstancedMesh(geo,m,items.length);items.forEach((v,i)=>instanced.setMatrixAt(i,v));instanced.receiveShadow=true;if(m===roadmat)instanced.renderOrder=2;if(m===paint)instanced.renderOrder=3;instanced.computeBoundingSphere();scene.add(instanced);}
 const group=new T.Group();for(const o of [...scene.children])if(!existing.has(o))group.attach(o);scene.add(group);
 return {group,update(time,day=1){glow.emissiveIntensity=(1-day)*2;glass.emissive.set('#d9ad63');glass.emissiveIntensity=(1-day)*.35;},map:{park:{x:-12,z:15,w:20,d:15},villas:[],shops:[],downtown:buildings}};
}
