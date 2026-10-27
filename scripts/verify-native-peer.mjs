import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import config from '../cloud/config.json' with {type:'json'};
const accounts=JSON.parse(await readFile(new URL('../.cache/online-qa.json',import.meta.url))),user=accounts[1],world=accounts[0].worldId;
const response=await fetch('http://localhost:4175/api/account',{method:'POST',headers:{origin:'http://localhost:4175','content-type':'application/json'},body:JSON.stringify({action:'login',growId:user.growId,password:user.password})});
if(!response.ok)throw Error('QA login failed');const auth=await response.json();
const client=createClient(config.url,config.publishableKey,{accessToken:async()=>auth.accessToken,auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw Error(name+': '+error.message);return data;};
const appearance=(await rpc('game_me')).appearance,report={at:new Date().toISOString(),positions:[],chat:[],passed:false};
await writeFile(new URL('../.cache/native-peer-original.json',import.meta.url),JSON.stringify({user_id:user.id,world,appearance}));
try{
 await rpc('game_join',{p_world:world});
 await rpc('game_set_appearance',{p_appearance:{outfit:[66,0,0,0,0,0,0,0,0,0],skin:[230,180,130],hc:'',ec:'',lc:''}});
 console.log('READY: second QA avatar joined the QA world');
 for(let i=0;i<4;i++){
  const text='Peer bubble '+i,id=await rpc('game_chat',{p_world:world,p_text:text,p_request_id:randomUUID()});report.chat.push({id,text});
  const state=await rpc('game_state',{p_world:world});report.positions.push(state.players.map(p=>({id:p.user_id,x:p.x,y:p.y,animation:p.animation,appearance:p.appearance})));
  console.log('QA positions '+JSON.stringify(state.players.map(p=>({name:p.grow_id,x:p.x,y:p.y}))));
  await new Promise(resolve=>setTimeout(resolve,5000));await rpc('game_heartbeat',{p_world:world});
 }
 report.passed=report.positions.some(players=>players.length>=2);
}finally{
 const retry=async(name,args)=>{let error;for(let i=0;i<3;i++){try{return await rpc(name,args);}catch(cause){error=cause;}}throw error;};
 const cleanup=await Promise.allSettled([retry('game_set_appearance',{p_appearance:appearance}),retry('game_leave',{p_world:world})]);await client.removeAllChannels();
 report.cleanup=cleanup.map(result=>result.status==='fulfilled');if(report.cleanup.includes(false))report.passed=false;
 await writeFile(new URL('../verification/ambatopia/peer-report.json',import.meta.url),JSON.stringify(report,null,2));
}
