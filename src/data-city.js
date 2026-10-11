import * as T from 'three';import {highwayRoads,highwayBounds,connector,nearestRoad} from './road-network.js';import {tollGates} from './salik.js';import {surface} from './waterfront.js';
export function createDataCity(scene,{box,mat}){
 const sand=mat('#c9bda2'),roadmat=mat('#464b4f'),white=mat('#e3e0d4'),stone=mat('#a9aaa4'),glass=mat('#6e919e',.36,.2),green=mat('#6d8564'),metal=mat('#354249');
 sand.map=surface('sand');sand.color.set('#ffffff');roadmat.map=surface('asphalt');roadmat.color.set('#ffffff');glass.map=surface('windows');glass.color.set('#ffffff');
 const b=highwayBounds;box(b.maxX-b.minX,.4,b.maxZ-b.minZ,(b.minX+b.maxX)/2,.1,(b.minZ+b.maxZ)/2,sand);
 const batches=new Map(),geo=new T.BoxGeometry(1,1,1),matrix=new T.Matrix4(),quat=new T.Quaternion();
 function part(w,h,d,x,y,z,m,yaw=0){if(!batches.has(m))batches.set(m,[]);quat.setFromAxisAngle(new T.Vector3(0,1,0),yaw);matrix.compose(new T.Vector3(x,y,z),quat,new T.Vector3(w,h,d));batches.get(m).push(matrix.clone());}
 function strip(a,b,width,y,m){const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)return;part(width,.04,length+.3,(a.x+b.x)/2,y,(a.z+b.z)/2,m,Math.atan2(b.x-a.x,b.z-a.z));}
 for(const road of [...highwayRoads,connector]){for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);if(length<.1)continue;strip(a,b,road.width,.38,roadmat);
 for(const side of [-1,1]){const ox=Math.cos(yaw)*road.width/2*side,oz=-Math.sin(yaw)*road.width/2*side;strip({x:a.x+ox,z:a.z+oz},{x:b.x+ox,z:b.z+oz},.12,.41,white);}
 const lanes=Math.min(3,road.lanes||2);for(let n=1;n<lanes;n++){const offset=-road.width/2+road.width*n/lanes;for(let t=3;t<length;t+=10)part(.12,.025,3,a.x+dx*t/length+Math.cos(yaw)*offset,.43,a.z+dz*t/length-Math.sin(yaw)*offset,white,yaw);}}}
 const buildings=[];
 function building(x,z,w,d,h,index){if(Math.hypot(x-40,z-40)<28)return;if(nearestRoad({x,z}).distance<Math.hypot(w,d)/2+14)return;box(w,h,d,x,h/2+.4,z,index%3===0?white:glass,true);buildings.push({x,z,w,d});part(w+1,.5,d+1,x,h+.7,z,metal);for(let y=4;y<h;y+=5)part(w+.15,.12,d+.15,x,y,z,stone);}
 // Buildings remain procedural; the drivable highway centre-lines come from OSM.
 for(let x=-150;x<=175;x+=36)for(let z=-170;z<=165;z+=36){if(Math.hypot(x-8,z-12)<30)continue;building(x,z,18,18,18+Math.abs(x*7+z*3)%70,Math.abs(x+z));}
 for(let k=0;k<highwayRoads.length;k+=5){const r=highwayRoads[k],p=r.points[Math.floor(r.points.length/2)],next=r.points.at(-1),yaw=Math.atan2(next.x-p.x,next.z-p.z);for(const side of [-1,1]){const x=p.x+Math.cos(yaw)*40*side,z=p.z-Math.sin(yaw)*40*side;building(x,z,14,14,8+k%40,k);}}
 part(70,.12,55,8,.4,12,stone);part(20,.15,15,-12,.48,15,green); // Spawn plaza and access to the real road network.
 for(let x=-20;x<=30;x+=10){part(2,.18,.65,x,.9,32,mat('#896c4e'));part(2,.5,.15,x,1.2,31.7,metal);for(const dx of [-.7,.7])part(.1,.6,.5,x+dx,.6,32,metal);}
 const trunk=mat('#968465'),leaves=mat('#476b50'),trunkGeo=new T.CylinderGeometry(.18,.3,6,8),leafGeo=new T.SphereGeometry(1,8,5);
 for(let z=-15;z<=35;z+=12){if(nearestRoad({x:-24,z}).distance<14)continue;const t=new T.Mesh(trunkGeo,trunk);t.position.set(-24,3.4,z);t.castShadow=true;scene.add(t);const leaf=new T.Mesh(leafGeo,leaves);leaf.scale.set(2,1,2);leaf.position.set(-24,6.3,z);scene.add(leaf);}
 function label(text,x,y,z,width=15){const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#164b42';ctx.fillRect(0,0,512,100);ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText(text,256,63);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(width,2.7),new T.MeshBasicMaterial({map,side:T.DoubleSide}));sign.position.set(x,y,z);scene.add(sign);return sign;}
 for(const gate of tollGates){const {x,z,yaw,width}=gate;for(const side of [-1,1])part(.35,7,.35,x+Math.cos(yaw)*width/2*side,3.9,z-Math.sin(yaw)*width/2*side,metal);part(width+1,.5,.6,x,7.4,z,metal,yaw);const sign=label('SALIK · '+gate.name,x,6.4,z,width);sign.rotation.y=yaw;}
 for(let k=0;k<highwayRoads.length;k+=20){const r=highwayRoads[k],p=r.points[Math.floor(r.points.length/2)];label(r.ref+' · '+r.name.replace(/ \(.*\)/,''),p.x,6,p.z,17);}
 // Recognisable skyline at the origin, with access roads left unobstructed.
 let height=0;for(let i=0;i<8;i++){const w=15-i*1.5;box(w,15,w,40,height+8,40,glass,i===0);height+=15;}part(.5,22,.5,40,132,40,white);buildings.push({x:40,z:40,w:15,d:15});
 for(const [m,items]of batches){const instanced=new T.InstancedMesh(geo,m,items.length);items.forEach((v,i)=>instanced.setMatrixAt(i,v));instanced.receiveShadow=true;instanced.computeBoundingSphere();scene.add(instanced);}
 return {update(){},map:{park:{x:-12,z:15,w:20,d:15},villas:[],shops:[],downtown:buildings}};
}
