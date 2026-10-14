import area from './data/dubai-buildings.json' with {type:'json'};
import data from './data/dubai-roads.json' with {type:'json'};
export const roadData=data;
export function project(lon,lat){return {x:(lon-data.projection.origin[0])*100750*data.projection.horizontalScale,z:-(lat-data.projection.origin[1])*111320*data.projection.horizontalScale};}
function elevationPoints(_road,coords){
 // OSM bridge/layer tags describe topology, not measured vertical clearance.
 // Keep roads on the ground until a surveyed elevation source is available.
 return coords.map(([lon,lat])=>({...project(lon,lat),y:0}));
}
export const highwayRoads=[...data.roads,...area.streets.filter(s=>!data.roads.some(r=>r.id===s.id))].map(r=>({...r,width:Math.max(5,Math.min(30,r.lanes*3.5)),points:elevationPoints(r,r.coordinates)}));
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function nearestRoad(p){let best=null;for(const road of highwayRoads)for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],distance=pointSegmentDistance(p,a,b);if(!best||distance<best.distance){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;best={road,distance,point:{x:a.x+dx*t,z:a.z+dz*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t},yaw:Math.atan2(dx,dz)};}}return best;}
export function roadElevationAt(p){const n=nearestRoad(p);return n&&n.distance<=n.road.width/2+2?n.point.y||0:0;}
export const highwayBounds={minX:Math.min(...highwayRoads.flatMap(r=>r.points.map(p=>p.x)))-90,maxX:Math.max(...highwayRoads.flatMap(r=>r.points.map(p=>p.x)))+90,minZ:Math.min(...highwayRoads.flatMap(r=>r.points.map(p=>p.z)))-90,maxZ:Math.max(...highwayRoads.flatMap(r=>r.points.map(p=>p.z)))+90};
export const connector={name:'Downtown access',ref:'LOCAL',width:10,points:[{x:8,z:0},nearestRoad({x:8,z:0}).point]};
