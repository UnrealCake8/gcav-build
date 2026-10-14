import * as T from 'three';
import data from './data/manhattan-buildings.json' with {type:'json'};
import {pointSegmentDistance} from './road-network.js';

export const mappedBuildings=data.buildings.map(b=>{const polygon=b.polygon.slice(0,-1).map(([x,z])=>({x,z})),xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z);return {...b,polygon,w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs),x:(Math.max(...xs)+Math.min(...xs))/2,z:(Math.max(...zs)+Math.min(...zs))/2};});
export function inFootprint(x,z,polygon,r=0){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;if(r&&pointSegmentDistance({x,z},a,b)<r)return true;}return inside;}
export function renderMappedBuildings(scene,material,{exclude=()=>false,addBlocker=()=>{}}={}){
 const rendered=mappedBuildings.filter(b=>!exclude(b));let bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 const geometry=new T.BoxGeometry(1,1,1),mesh=new T.InstancedMesh(geometry,material,rendered.length),matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),size=new T.Vector3();
 rendered.forEach((b,i)=>{let yaw=0,longest=0;for(let k=0;k<b.polygon.length;k++){const a=b.polygon[k],c=b.polygon[(k+1)%b.polygon.length],len=Math.hypot(c.x-a.x,c.z-a.z);if(len>longest){longest=len;yaw=Math.atan2(-(c.z-a.z),c.x-a.x);}}
  const cos=Math.cos(yaw),sin=Math.sin(yaw),local=b.polygon.map(p=>({x:(p.x-b.x)*cos-(p.z-b.z)*sin,z:(p.x-b.x)*sin+(p.z-b.z)*cos})),xs=local.map(p=>p.x),zs=local.map(p=>p.z),w=Math.max(2,Math.max(...xs)-Math.min(...xs)),d=Math.max(2,Math.max(...zs)-Math.min(...zs));
  rotation.setFromAxisAngle(new T.Vector3(0,1,0),yaw);position.set(b.x,.05+b.height/2,b.z);size.set(w,b.height,d);matrix.compose(position,rotation,size);mesh.setMatrixAt(i,matrix);bounds.minX=Math.min(bounds.minX,b.x-b.w/2);bounds.maxX=Math.max(bounds.maxX,b.x+b.w/2);bounds.minZ=Math.min(bounds.minZ,b.z-b.d/2);bounds.maxZ=Math.max(bounds.maxZ,b.z+b.d/2);addBlocker(b);});
 mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.computeBoundingSphere();scene.add(mesh);return {buildings:rendered,mesh,bounds};
}
