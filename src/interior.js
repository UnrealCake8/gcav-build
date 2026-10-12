import * as T from 'three';
export function createInterior(scene,{box,mat}){const group=new T.Group();scene.add(group);group.visible=false;const obstacles=[];
function part(w,h,d,x,y,z,color,solid=false){const mesh=box(w,h,d,x,y,z,mat(color),false,group);if(solid)obstacles.push({x,z,w:w/2,d:d/2,mesh});}
part(44,.3,28,0,.2,0,'#d6d2c8');for(const x of [-22,22])part(.5,8,28,x,4,0,'#b8c7c9',true);for(const z of [-14,14])part(44,8,.5,0,4,z,'#b8c7c9',true);
for(const x of [-14,0,14]){part(10,3,5,x,1.7,-8,'#7eaa9d',true);part(10,.2,5,x,3.3,-8,'#d5bd8d');for(let n=-3;n<=3;n+=3)part(1,1,1,x+n,3.9,-8,'#d1a776');}
for(const x of [-17,17])for(const z of [1,7]){part(3,.4,1.5,x,1,z,'#8a7157',true);part(3,1,.2,x,1.4,z-.7,'#8a7157');}
part(5,.45,8,14,.48,-4,'#8a7157',true);part(5,.32,7.6,14,.86,-4,'#d8c5a8');part(2,.3,2.2,14,1.16,-6.2,'#f1e9dc');part(5,.14,.18,14,1.08,-7.8,'#8a7157');
const lit=new T.HemisphereLight('#ffffff','#9d8c73',2);group.add(lit);const bars=new T.Group();group.add(bars);for(let x=-20;x<=20;x+=2){const bar=new T.Mesh(new T.BoxGeometry(.12,7,.12),mat('#465762'));bar.position.set(x,3.5,12);bars.add(bar);}bars.visible=false;const exit=new T.Mesh(new T.TorusGeometry(2,.16,8,24),new T.MeshBasicMaterial({color:'#70bb8f'}));exit.rotation.x=Math.PI/2;exit.position.set(0,.5,10);group.add(exit);
return {group,obstacles,light:lit,sleepSpot:{x:14,z:-4},setSpace(id){bars.visible=id==='custody';exit.visible=id!=='custody';}};}
