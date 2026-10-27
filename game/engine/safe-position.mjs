import {ITEMS} from '../catalog.mjs';
export function safePosition(world,position=world.spawn){
 const clear=(x,y)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x+20/32>=world.width||y+30/32>=world.height)return false;
  for(let ty=Math.floor(y);ty<=Math.floor(y+29.99/32);ty++)for(let tx=Math.floor(x);tx<=Math.floor(x+19.99/32);tx++){const item=ITEMS.get(world.foreground[ty*world.width+tx]);if(item?.solid||item?.hazard)return false;}
  return true;
 };
 if(clear(position.x,position.y))return {x:position.x,y:position.y};
 const candidates=[];
 for(let y=0;y<world.height-1;y++)for(let x=0;x<world.width;x++)if(clear(x,y))candidates.push({x,y});
 candidates.sort((a,b)=>((a.x-position.x)**2+(a.y-position.y)**2)-((b.x-position.x)**2+(b.y-position.y)**2)||a.y-b.y||a.x-b.x);
 if(!candidates.length)throw Error('WORLD_HAS_NO_SAFE_SPAWN');
 return candidates[0];
}
