import {highwayBounds,highwayRoads} from './road-network.js';
export const WORLD_BOUNDS=highwayBounds;
export const roads=[...[-105,0,105].map(z=>({x:0,z,w:300,d:13})),...[-105,0,105].map(x=>({x,z:0,w:13,d:300})),{x:0,z:-245,w:18,d:290},{x:-105,z:-245,w:13,d:290},{x:105,z:-245,w:13,d:290},{x:20,z:-270,w:460,d:18},{x:20,z:-370,w:460,d:13},{x:240,z:-270,w:13,d:200}];
export const districts=[{name:'JUMEIRAH WATERFRONT',minZ:-145,maxZ:153},{name:'DOWNTOWN DUBAI',minZ:-390,maxZ:-145}];
export const landAreas=[WORLD_BOUNDS];
export const insideWorld=(x,z,r=0)=>x>=WORLD_BOUNDS.minX+r&&x<=WORLD_BOUNDS.maxX-r&&z>=WORLD_BOUNDS.minZ+r&&z<=WORLD_BOUNDS.maxZ-r;
export const districtAt=z=>z>2000?'AL BARSHA / AL SAFA':z<-2600?'CREEK / BUSINESS BAY CROSSING':'DOWNTOWN DUBAI';
