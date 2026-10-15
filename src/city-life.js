import data from './data/manhattan-landmarks.json' with {type:'json'};
import {project,nearestRoad} from './road-network.js';
export const landmarks=data.landmarks.map(p=>{const {x,z}=project(p.lon,p.lat),road=nearestRoad({x,z});const entrance=road?{x:road.point.x+Math.cos(road.yaw)*(road.road.width/2+3),z:road.point.z-Math.sin(road.yaw)*(road.road.width/2+3)}:{x,z};return {...p,x,z,w:0,d:0,h:0,entrance};});
export const roles=[{id:'resident',name:'Civilian',description:'Explore, meet players and shop.'},{id:'courier',name:'Delivery courier',description:'Collect parcels and earn delivery rewards.'},{id:'police',name:'Police officer',description:'Patrol for a salary and arrest wanted players.'},{id:'criminal',name:'Criminal',description:'Risk a shop robbery, arrest and bail.'},{id:'retail',name:'Shop worker',description:'Work a 60-second shop shift for AED 25.'}];
export const validRole=id=>roles.some(r=>r.id===id);
// No fictional addresses or purchasable buildings: the playable footprints are sourced features.
export const propertyListings=[];
export const catalogue=[{id:'coffee',name:'Coffee',price:12},{id:'meal',name:'Meal',price:30},{id:'souvenir',name:'City souvenir',price:45}];
export const insideRoom=(x,z,r=0)=>Math.abs(x)<=21-r&&Math.abs(z)<=13-r;
export const cycleMs=24*60*1000;
export function worldHour(now,epoch){return ((9+(now-epoch)/cycleMs*24)%24+24)%24;}
export function daylight(hour){return Math.max(0,Math.min(1,(Math.sin((hour-6)/24*Math.PI*2)+.12)*1.5));}
