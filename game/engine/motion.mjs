const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const motion=({x,y,sequence,animation,facing})=>({x,y,sequence,animation,facing});
export function createMotionTrack(initial,now){
 let samples=[{...motion(initial),at:now}];
 return {
  push(player,at){const last=samples.at(-1);if(player.sequence<=last.sequence)return;
   if(Math.hypot(player.x-last.x,player.y-last.y)>8)samples=[];
   samples.push({...motion(player),at:Math.max(at,last.at+1)});if(samples.length>8)samples.shift();
  },
  sample(at){const target=at-100,last=samples.at(-1);
   if(samples.length===1)return {...last};
   for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(target<=b.at){const t=clamp((target-a.at)/(b.at-a.at),0,1);return {...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}}
   const prev=samples.at(-2),dt=Math.max(1,last.at-prev.at),extra=clamp(target-last.at,0,120);
   const moving=last.animation==='walk'||last.animation==='jump';
   return {...last,x:clamp(last.x+(moving?clamp((last.x-prev.x)/dt,-.012,.012)*extra:0),0,99),y:clamp(last.y+(moving?clamp((last.y-prev.y)/dt,-.02,.02)*extra:0),0,59),animation:at-last.at>800?'idle':last.animation};
  }
 };
}
export function avatarFrame(player,now,punchAt=-Infinity){
 const age=now-punchAt,punching=age>=0&&age<300,frame=punching?Math.floor(age/50):player.animation==='walk'?Math.floor(now/50)%8:0;
 const pose={animation:player.animation,facing:player.facing,phase:frame/2,punchAge:punching?frame*.05:-1,time:frame*50};
 return {key:JSON.stringify([player.appearance||{},player.facing,player.animation,punching,frame]),pose};
}
