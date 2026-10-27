import {ITEMS} from './catalog.mjs';
export function validateSnapshot(value) {
  if(value?.schema!==1||value.width!==100||value.height!==60)throw Error('Unsupported world dimensions or schema');
  if(JSON.stringify(value).length>10485760)throw Error('World exceeds 10 MiB');
  for(const layer of ['foreground','background']) {
    if(!Array.isArray(value[layer])||value[layer].length!==6000)throw Error('World requires 6000 tiles per layer');
    if(value[layer].some(id=>!Number.isInteger(id)||!ITEMS.has(id)||(id!==0&&ITEMS.get(id).layer!==layer)))throw Error('Unknown item or wrong layer');
  }
  if(!Number.isFinite(value.spawn?.x)||!Number.isFinite(value.spawn?.y)||value.spawn.x<0||value.spawn.x>=100||value.spawn.y<0||value.spawn.y>=60)throw Error('Invalid spawn');
  return {schema:1,width:100,height:60,foreground:[...value.foreground],background:[...value.background],spawn:{x:value.spawn.x,y:value.spawn.y}};
}
export function createTerrain(seed='START') {
  let state=2166136261;for(const c of seed.toUpperCase())state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
  const doorX=2+state%96;
  const foreground=Array(6000).fill(0),background=Array(6000).fill(0);
  for(let y=0;y<60;y++)for(let x=0;x<100;x++) {
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    foreground[y*100+x]=y>=54?3:y<24?0:y>=25&&state%50===0?4:y>=51&&state%8<3?16:1;
    background[y*100+x]=y>=24?8:0;
  }
  foreground[2300+doorX]=15;foreground[2400+doorX]=3;
  return {schema:1,width:100,height:60,foreground,background,spawn:{x:doorX,y:23}};
}
