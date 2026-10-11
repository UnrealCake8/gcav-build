export const outfits = [
 {id:'street',name:'Streetwear',top:'#d8fc69',pants:'#26333f',skin:'#c69873',cap:true},
 {id:'sport',name:'Sports kit',top:'#ef6548',pants:'#eeeeee',skin:'#c69873',cap:false},
 {id:'denim',name:'Denim jacket',top:'#467caa',pants:'#20222a',skin:'#c69873',cap:true},
 {id:'formal',name:'Business suit',top:'#222735',pants:'#222735',skin:'#c69873',cap:false},
 {id:'desert',name:'Desert robe',top:'#f3ecdb',pants:'#f3ecdb',skin:'#c69873',robe:true,cap:false},
 {id:'night',name:'Night runner',top:'#a66be0',pants:'#171b25',skin:'#c69873',cap:true}
];
export const validOutfit = id => outfits.some(o=>o.id===id);
export const getOutfit = id => outfits.find(o=>o.id===id)||outfits[0];
