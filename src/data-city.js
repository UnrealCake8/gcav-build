import {renderMappedBuildings} from './mapped-buildings.js';
import {landmarks} from './city-life.js';
import signsData from './data/manhattan-signs.json' with {type:'json'};
import * as T from 'three';
import {highwayRoads,highwayBounds,connector,nearestRoad} from './road-network.js';
import {surface} from './waterfront.js';

export function createDataCity(scene,{box,mat,addBlocker}){
 const existing=new Set(scene.children),nightMaterials=[],lamps=[];
 const ground=mat('#879184'),roadmat=mat('#34393d'),paint=mat('#f0eee8'),buildingmat=mat('#ffffff'),signMaterial=mat('#f7f6f0'),poleMaterial=mat('#707875');
 buildingmat.map=surface('windows');
 roadmat.roughness=.95;roadmat.map=surface('asphalt');roadmat.color.set('#ffffff');roadmat.depthWrite=false;roadmat.polygonOffset=true;roadmat.polygonOffsetFactor=-1;roadmat.polygonOffsetUnits=-1;
 paint.depthWrite=false;paint.polygonOffset=true;paint.polygonOffsetFactor=-2;paint.polygonOffsetUnits=-2;
 const b=highwayBounds;box(b.maxX-b.minX,.4,b.maxZ-b.minZ,(b.minX+b.maxX)/2,-.2,(b.minZ+b.maxZ)/2,ground);
 const batches=new Map(),geo=new T.BoxGeometry(1,1,1),matrix=new T.Matrix4(),quat=new T.Quaternion();
 function part(w,h,d,x,y,z,m,yaw=0){if(!batches.has(m))batches.set(m,[]);quat.setFromAxisAngle(new T.Vector3(0,1,0),yaw);matrix.compose(new T.Vector3(x,y,z),quat,new T.Vector3(w,h,d));batches.get(m).push(matrix.clone());}
 function strip(a,b,width,y,m){const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)return;part(width,.04,length+.25,(a.x+b.x)/2,y,(a.z+b.z)/2,m,Math.atan2(b.x-a.x,b.z-a.z));}
 const roadSurfaceY=.04;
 for(const road of [...highwayRoads,connector])for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],p=road.points[i],dx=p.x-a.x,dz=p.z-a.z,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);if(length<.1)continue;
  strip(a,p,road.width,roadSurfaceY,roadmat);
  for(const side of [-1,1]){const ox=Math.cos(yaw)*road.width/2*side,oz=-Math.sin(yaw)*road.width/2*side;strip({x:a.x+ox,z:a.z+oz},{x:p.x+ox,z:p.z+oz},.12,roadSurfaceY+.025,paint);}
  const lanes=Math.min(4,Math.max(1,road.lanes||2));for(let n=1;n<lanes;n++){const offset=-road.width/2+road.width*n/lanes;for(let t=4;t<length;t+=12)part(.1,.025,3,a.x+dx*t/length+Math.cos(yaw)*offset,roadSurfaceY+.035,a.z+dz*t/length-Math.sin(yaw)*offset,paint,yaw);}
 }
 const buildingResult=renderMappedBuildings(scene,buildingmat,{addBlocker});
 // Official parking regulation posts are placed from their NYC DOT coordinates.
 const poleGeo=new T.BoxGeometry(.12,2.2,.12),boardGeo=new T.BoxGeometry(.72,.82,.08),poles=new T.InstancedMesh(poleGeo,poleMaterial,signsData.signs.length),boards=new T.InstancedMesh(boardGeo,signMaterial,signsData.signs.length);
 const point=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1);
 signsData.signs.forEach((s,i)=>{const [x,z]=s.position,road=nearestRoad({x,z}),yaw=road?.yaw||0;rotation.setFromAxisAngle(new T.Vector3(0,1,0),yaw);point.set(x,1.15,z);poles.setMatrixAt(i,matrix.compose(point,rotation,scale));point.set(x,2.42,z);boards.setMatrixAt(i,matrix.compose(point,rotation,scale));});
 poles.instanceMatrix.needsUpdate=true;boards.instanceMatrix.needsUpdate=true;poles.computeBoundingSphere();boards.computeBoundingSphere();scene.add(poles,boards);
 // Landmark names are map annotations on real public places; no replacement building models are fabricated.
 function label(text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='rgba(25,36,43,.88)';ctx.fillRect(0,0,512,96);ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText(text,256,62);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map,depthTest:true}));sprite.scale.set(Math.max(9,Math.min(25,text.length*.42)),2.8,1);sprite.position.set(x,y,z);scene.add(sprite);}
 for(const l of landmarks)label(l.name,l.x,5,l.z);
 for(const [m,items]of batches){const instanced=new T.InstancedMesh(geo,m,items.length);items.forEach((v,i)=>instanced.setMatrixAt(i,v));instanced.receiveShadow=true;if(m===roadmat)instanced.renderOrder=2;if(m===paint)instanced.renderOrder=3;instanced.computeBoundingSphere();scene.add(instanced);}
 const group=new T.Group();for(const o of [...scene.children])if(!existing.has(o))group.attach(o);scene.add(group);
 return {group,benchSpots:[],cameraObstacles:[buildingResult.mesh],update(time,day=1){},map:{park:null,villas:[],shops:[],downtown:buildingResult.buildings}};
}
