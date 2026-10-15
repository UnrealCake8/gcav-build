import {highwayBounds,highwayRoads} from './road-network.js';
export const WORLD_BOUNDS=highwayBounds;
export const roads=highwayRoads.map(r=>({x:r.points.reduce((s,p)=>s+p.x,0)/r.points.length,z:r.points.reduce((s,p)=>s+p.z,0)/r.points.length,w:r.width,d:r.width}));
export const districts=[{name:'MIDTOWN MANHATTAN',minZ:WORLD_BOUNDS.minZ,maxZ:WORLD_BOUNDS.maxZ}];
export const landAreas=[WORLD_BOUNDS];
export const insideWorld=(x,z,r=0)=>x>=WORLD_BOUNDS.minX+r&&x<=WORLD_BOUNDS.maxX-r&&z>=WORLD_BOUNDS.minZ+r&&z<=WORLD_BOUNDS.maxZ-r;
export const districtAt=()=> 'MIDTOWN MANHATTAN';
