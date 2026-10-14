import data from './data/manhattan-roads.json' with {type:'json'};
import buildingData from './data/manhattan-buildings.json' with {type:'json'};
export const roadData={...data,projection:{origin:data.origin,horizontalScale:data.scale}};
export function project(lon,lat){const [lon0,lat0]=data.origin;return {x:(lon-lon0)*100750*data.scale,z:-(lat-lat0)*111320*data.scale};}
export const highwayRoads=data.roads.map(r=>({id:r.id,name:r.name,ref:r.ref||'',lanes:r.lanes,width:r.width,speedMph:r.speedMph,points:r.points.map(([x,z])=>({x,y:0,z}))}));
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function nearestRoad(p){let best=null;for(const road of highwayRoads)for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],distance=pointSegmentDistance(p,a,b);if(!best||distance<best.distance){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;best={road,distance,point:{x:a.x+dx*t,z:a.z+dz*t,y:0},yaw:Math.atan2(dx,dz)};}}return best;}
export function roadElevationAt(){return 0;}
const all=highwayRoads.flatMap(r=>r.points);
export const highwayBounds={minX:Math.min(...all.map(p=>p.x))-15,maxX:Math.max(...all.map(p=>p.x))+15,minZ:Math.min(...all.map(p=>p.z))-15,maxZ:Math.max(...all.map(p=>p.z))+15};
const origin=project(-73.9855,40.758);
export const connector={name:'Times Square access',ref:'LOCAL',width:8,lanes:2,points:[{x:origin.x,z:origin.z,y:0},nearestRoad(origin).point]};
export const worldData=buildingData;
