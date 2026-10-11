import data from './data/dubai-landmarks.json' with {type:'json'};
import {project} from './road-network.js';
const details={ 'burj-khalifa':['Burj Khalifa','tower',24,24,207], 'dubai-mall':['Dubai Mall','mall',40,32,12], 'mall-emirates':['Mall of the Emirates','mall',100,70,12], 'museum-future':['Museum of the Future','museum',35,25,20], 'dubai-frame':['Dubai Frame','frame',38,12,38], 'burj-arab':['Burj Al Arab','hotel',28,22,80] };
export const landmarks=data.landmarks.map(p=>{const [name,kind,w,d,h]=details[p.id];const {x,z}=project(p.lon,p.lat);return {...p,name,kind,w,d,h,x,z,entrance:{x:x+w/2+5,z}};});
export const roles=[{id:'resident',name:'Civilian',description:'Explore, meet players and shop.'},{id:'courier',name:'Delivery courier',description:'Collect parcels and earn delivery rewards.'},{id:'police',name:'Police officer',description:'Patrol for a salary and arrest wanted players.'},{id:'criminal',name:'Criminal',description:'Risk a shop robbery, arrest and bail.'},{id:'retail',name:'Shop worker',description:'Work a 60-second shop shift for AED 25.'}];
export const validRole=id=>roles.some(r=>r.id===id);
export const catalogue=[{id:'coffee',name:'Coffee',price:12},{id:'meal',name:'Lunch',price:30},{id:'souvenir',name:'City souvenir',price:45}];
export const insideRoom=(x,z,r=0)=>Math.abs(x)<=21-r&&Math.abs(z)<=13-r;
export const cycleMs=24*60*1000;
export function worldHour(now,epoch){return ((9+(now-epoch)/cycleMs*24)%24+24)%24;}
export function daylight(hour){return Math.max(0,Math.min(1,(Math.sin((hour-6)/24*Math.PI*2)+.12)*1.5));}
