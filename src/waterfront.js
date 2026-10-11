import * as T from 'three';
import {roads} from './world-layout.js';
// Deterministic, local textures and instanced props keep the city usable on tablets.
function random(seed=9217){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surface(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),rng=random();ctx.fillStyle={asphalt:'#505458',sand:'#dcc99f',paving:'#b8b6ad',windows:'#647f8b'}[kind];ctx.fillRect(0,0,256,256);
 if(kind==='windows'){for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){ctx.fillStyle=rng()>.75?'#d4c7a3':rng()>.5?'#536f7e':'#7c98a2';ctx.fillRect(x+3,y+3,25,27);ctx.fillStyle='#b5b3a6';ctx.fillRect(x,y,2,32);ctx.fillRect(x,y,32,2);}}
 else{for(let i=0;i<8000;i++){ctx.fillStyle=rng()>.5?'#ffffff12':'#00000015';const x=rng()*256,y=rng()*256;ctx.fillRect(x,y,kind==='sand'?2:1,1);}if(kind==='paving'){ctx.strokeStyle='#8f918c';ctx.lineWidth=1;for(let y=0;y<=256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y%64?16:0);x<256;x+=32){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke();}}}}
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(kind==='windows'?2:12,kind==='windows'?4:12);texture.anisotropy=4;return texture;}
export function createWaterfront(scene,{box,mat}){
 const batches=new Map(),cube=new T.BoxGeometry(1,1,1),matrix=new T.Matrix4(),q=new T.Quaternion();
 function instance(geo,m,x,y,z,sx,sy,sz,rotation=0){let batch=batches.get(geo.uuid+':'+m.uuid);if(!batch){batch={geo,m,items:[]};batches.set(geo.uuid+':'+m.uuid,batch);}q.setFromAxisAngle(new T.Vector3(0,1,0),rotation);matrix.compose(new T.Vector3(x,y,z),q,new T.Vector3(sx,sy,sz));batch.items.push(matrix.clone());}
 function detail(w,h,d,x,y,z,m,rotation=0){instance(cube,m,x,y,z,w,h,d,rotation);}
 const stone=mat('#c3c0b7'),ivory=mat('#e6dfce'),dark=mat('#35454b'),mark=mat('#eee9dc'),green=mat('#6c8260'),wood=mat('#8b6d4d'),trunk=mat('#9a8460'),leaves=mat('#466e50'),glass=mat('#7a9ca7',.3,.2),water=mat('#3e929e',.28,.25),red=mat('#ad6350');
 const asphalt=mat('#ffffff');asphalt.map=surface('asphalt');const sand=mat('#ffffff');sand.map=surface('sand');const paving=mat('#ffffff');paving.map=surface('paving');const facade=mat('#ffffff',.45,.15);facade.map=surface('windows');
 const sea=box(1400,.3,1400,0,-.75,0,water);box(310,1,310,0,-.2,0,sand);box(300,.09,18,0,.36,136,paving);
 // Shoreline promenade, seawall and beach: separate surfaces instead of flat land.
 detail(302,.35,.65,0,.5,147,stone);for(let x=-145;x<=145;x+=8){detail(.12,1,.12,x,1,146,dark);detail(8,.06,.06,x+4,1.4,146,dark);}box(302,.12,7,0,.36,151,sand);
 for(const axis of [0,1])for(const lane of [-105,0,105]){const horizontal=axis===0;detail(horizontal?300:13,.08,horizontal?13:300,horizontal?0:lane,.35,horizontal?lane:0,asphalt);
 for(const side of [-1,1]){detail(horizontal?300:2.4,.14,horizontal?2.4:300,horizontal?0:lane+side*8,.43,horizontal?lane+side*8:0,paving);detail(horizontal?300:.28,.16,horizontal?.28:300,horizontal?0:lane+side*6.7,.42,horizontal?lane+side*6.7:0,stone);}
 for(let v=-144;v<=144;v+=12){if([-105,0,105].some(n=>Math.abs(v-n)<12))continue;detail(horizontal?4:.16,.015,horizontal?.16:4,horizontal?v:lane,.403,horizontal?lane:v,mark);}}
 // Clear junctions, zebra crossings and stop lines on all four approaches.
 for(const x of [-105,0,105])for(const z of [-105,0,105]){detail(13,.018,13,x,.41,z,asphalt);for(const side of [-1,1]){for(let stripe=-4;stripe<=4;stripe+=1.4){detail(.65,.018,2.5,x+stripe,.435,z+side*10,mark);detail(2.5,.018,.65,x+side*10,.435,z+stripe,mark);}detail(5.5,.018,.22,x+side*3.2,.44,z+side*13,mark);}}
 const cylinder=new T.CylinderGeometry(.7,1,1,8),crown=new T.SphereGeometry(1,7,5);
 const leafGeometry=new T.BufferGeometry(),vertices=[],indices=[];for(let i=0;i<=8;i++){const t=i/8,width=Math.sin(t*Math.PI)*.42;vertices.push(-width,-.9*t*t,3.7*t,width,-.9*t*t,3.7*t);if(i<8){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}leafGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));leafGeometry.setIndex(indices);leafGeometry.computeVertexNormals();leaves.side=T.DoubleSide;
 function palm(x,z,height=7){instance(cylinder,trunk,x,height/2+.4,z,.28,height,.28);instance(crown,leaves,x,height+.4,z,.6,.4,.6);for(let i=0;i<8;i++){const angle=i*Math.PI*2/8;instance(leafGeometry,leaves,x,height+.5,z,1,1,1,angle);}}
 // Continuous pavements with properly placed street furnishings.
 function bench(x,z,rotation=0){detail(2.3,.15,.6,x,.85,z,wood,rotation);detail(2.3,.55,.12,x,1.2,z-.3,wood,rotation);for(const side of [-.8,.8])detail(.12,.55,.4,x+side,.6,z,dark);}
 const lamp=mat('#f0e4be');lamp.emissive=new T.Color('#e0c88b');lamp.emissiveIntensity=.3;
 function streetlight(x,z){instance(cylinder,dark,x,3.5,z,.09,6.3,.09);detail(1.5,.12,.15,x+.6,6.6,z,dark);detail(.7,.06,.3,x+1.1,6.5,z,lamp);}
 for(let x=-135;x<=135;x+=25){palm(x,128,6+(x+135)%3);bench(x,141);streetlight(x,139);if(Math.abs(x)>12)streetlight(x,12);}
 for(let z=-135;z<=100;z+=28){palm(121,z);streetlight(-117,z);}
 // Villas: recessed doors, window frames, roof parapets and landscaped front gardens.
 function villa(x,z,index){const wall=index%2?ivory:stone;box(20,8,17,x,4.4,z,wall,true);detail(21,.35,18,x,8.6,z,ivory);for(const side of [-1,1])detail(21,.6,.22,x,9,z+side*8.7,stone);detail(4,4,.12,x+5,2.5,z+8.55,wood);detail(4.4,.3,2,x+5,4.7,z+9,ivory);
 for(const wx of [-6,0,6])for(const y of [3,6.2]){detail(3.3,2,.16,x+wx,y,z+8.6,glass);detail(3.5,.14,.22,x+wx,y-1,z+8.7,ivory);detail(.1,2,.2,x+wx,y,z+8.7,ivory);}
 detail(20,.08,10,x,.37,z+16,green);detail(3,.09,11,x+5,.43,z+17,paving);detail(6,.09,8,x-5,.44,z+17,paving);palm(x-8,z+20,5);for(const dx of [-9,-5,-1])detail(2,1.1,1,x+dx,.9,z+21,green);}
 for(const z of [-60,60])for(const [i,x]of [-65,-35,35,65].entries())villa(x,z,i);
 // Walkable park with paths and a sheltered seating area.
 box(63,.12,39,-55,.4,28,green);detail(60,.08,3,-55,.49,28,paving);detail(3,.08,37,-55,.5,28,paving);for(const x of [-78,-65,-40,-28]){palm(x,19,5);palm(x,40,5);bench(x,32);}for(const x of [-63,-47])for(const z of [16,24])detail(.15,3.1,.15,x,1.9,z,wood);for(let x=-64;x<=-46;x+=1.4)detail(.3,.16,11,x,3.5,20,wood);
 // Small retail strip gives the centre street recognisable destinations.
 const labels=[];function sign(text,x,y,z){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#243c43';ctx.fillRect(0,0,512,96);ctx.fillStyle='#f3e9d3';ctx.font='600 40px Arial';ctx.textAlign='center';ctx.fillText(text,256,62);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(13,2.1),new T.MeshBasicMaterial({map:tex}));mesh.position.set(x,y,z);scene.add(mesh);labels.push(mesh);}
 for(const [i,x]of [35,60,85].entries()){box(20,5.5,12,x,3.1,-25,ivory,true);detail(18,3.2,.15,x,2.6,-18.9,glass);detail(20,.3,2.5,x,5.7,-18.4,red);sign(['WATERFRONT CAFE','CITY MARKET','AUTO SERVICE'][i],x,4.8,-18.65);detail(22,.1,6,x,.4,-15,paving);for(const dx of [-6,6]){detail(1,.08,1,x+dx,1,-14,wood);detail(.12,.7,.12,x+dx,.6,-14,dark);}}
 // Parking bays away from travel lanes.
 detail(32,.08,17,54,.36,-91,asphalt);for(let x=40;x<=68;x+=4){detail(.1,.02,7,x,.42,-94,mark);detail(.1,.02,7,x,.42,-85,mark);}detail(32,.02,.12,54,.42,-90,mark);
 // Downtown is a connected, playable district, with clear boulevards and walkable plazas.
 box(480,1,245,30,-.2,-272.5,sand);
 const downtown=[];
 for(const road of roads.filter(r=>r.z<-145)){detail(road.w,.08,road.d,road.x,.36,road.z,asphalt);if(road.w>road.d){for(const side of [-1,1])detail(road.w,.12,2,road.x,.44,road.z+side*(road.d/2+1),paving);for(let x=road.x-road.w/2+8;x<road.x+road.w/2;x+=12)if(![-105,0,105,240].some(v=>Math.abs(v-x)<13))detail(5,.02,.2,x,.42,road.z,mark);}else{for(const side of [-1,1])detail(2,.12,road.d,road.x+side*(road.w/2+1),.44,road.z,paving);for(let z=road.z-road.d/2+8;z<road.z+road.d/2;z+=12)if(Math.abs(z+270)>14&&Math.abs(z+370)>12)detail(.2,.02,5,road.x,.42,z,mark);}}
 function tower(x,z,h,w,index){box(w,h,w,x,h/2+.4,z,index%3===0?ivory:facade,true);downtown.push({x,z,w,d:w});detail(w+3,3,w+3,x,2,z,stone);detail(w+1,.5,w+1,x,h+.5,z,dark);detail(w*.45,2,w*.45,x,h+1.5,z,dark);for(let y=5;y<h;y+=6){detail(w+.3,.18,w+.3,x,y,z,ivory);if(index%2===0){detail(w,.16,1.8,x,y,z+w/2+.7,stone);detail(w,.5,.08,x,y+.3,z+w/2+1.5,dark);}}}
 for(const [i,x]of [-175,-140,-65,-30,40,75,150,195].entries()){tower(x,i===6?-345:-210,28+(i*19)%64,20,i);tower(x,-315,35+(i*17)%75,22,i+1);}
 // Landmark plaza and a shallow fountain sit east of the main northbound avenue.
 detail(100,.12,86,175,.4,-170,paving);detail(42,.12,32,160,.46,-210,stone);detail(38,.06,28,160,.55,-210,water);
 for(const x of [130,220])for(const z of [-135,-175,-215]){palm(x,z,7);bench(x-4,z+5);}
 let height=0;for(let i=0;i<8;i++){const w=22-i*2;box(w,17,w,180,height+8.9,-170,facade,i===0);height+=17;}detail(.8,28,.8,180,150,-170,ivory);downtown.push({x:180,z:-170,w:22,d:22});
 for(const [i,z]of [-65,-30,30,65].entries())tower(-135,z,15+i*3,17,i);
 for(let z=-155;z>=-365;z-=28){streetlight(14,z);palm(-16,z,6);streetlight(117,z);}
 for(let x=-190;x<=230;x+=28){streetlight(x,-282);if(![-105,0,105,240].some(v=>Math.abs(v-x)<15))palm(x,-257,6);}
 sign('DOWNTOWN DUBAI',32,6,-145);sign('WATERFRONT',-28,6,-140);
 // Thin, low-contrast water bands add motion without heavy shaders.
 const foam=mat('#96c2c4');foam.transparent=true;foam.opacity=.2;const waves=[];for(let z=160;z<210;z+=9){const wave=box(330,.015,.45,0,-.53,z,foam);waves.push(wave);}
 for(const {geo,m,items}of batches.values()){const mesh=new T.InstancedMesh(geo,m,items.length);items.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();scene.add(mesh);}
 return {update(time){waves.forEach((wave,i)=>{wave.position.z=160+i*9+Math.sin(time*.5+i)*1.5;});sea.material.color.setHSL(.51,.42,.4+Math.sin(time*.2)*.008);},map:{downtown,park:{x:-55,z:28,w:63,d:39},shops:[35,60,85].map(x=>({x,z:-25,w:20,d:12})),villas:[-60,60].flatMap(z=>[-65,-35,35,65].map(x=>({x,z,w:20,d:17})))}};
}
