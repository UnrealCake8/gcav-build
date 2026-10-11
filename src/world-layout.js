export const WORLD_BOUNDS={minX:-210,maxX:270,minZ:-390,maxZ:153};
export const roads=[...[-105,0,105].map(z=>({x:0,z,w:300,d:13})),...[-105,0,105].map(x=>({x,z:0,w:13,d:300})),{x:0,z:-245,w:18,d:290},{x:-105,z:-245,w:13,d:290},{x:105,z:-245,w:13,d:290},{x:20,z:-270,w:460,d:18},{x:20,z:-370,w:460,d:13},{x:240,z:-270,w:13,d:200}];
export const districts=[{name:'JUMEIRAH WATERFRONT',minZ:-145,maxZ:153},{name:'DOWNTOWN DUBAI',minZ:-390,maxZ:-145}];
export const landAreas=[{minX:-155,maxX:155,minZ:-155,maxZ:155},{minX:-210,maxX:270,minZ:-390,maxZ:-145}];
export const insideWorld=(x,z,r=0)=>x>=WORLD_BOUNDS.minX+r&&x<=WORLD_BOUNDS.maxX-r&&z>=WORLD_BOUNDS.minZ+r&&z<=WORLD_BOUNDS.maxZ-r&&landAreas.some(a=>x>=a.minX+r&&x<=a.maxX-r&&z>=a.minZ+r&&z<=a.maxZ-r);
export const districtAt=z=>z<-145?'DOWNTOWN DUBAI':'JUMEIRAH WATERFRONT';
