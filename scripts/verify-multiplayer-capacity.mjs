import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import config from '../cloud/config.json' with {type:'json'};
process.loadEnvFile(new URL('../.env.online.local',import.meta.url));
const admin=createClient(config.url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rpc=async(client,name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw Error(name+': '+error.message);return data;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),accounts=[],clients=[],report={at:new Date().toISOString(),transport:'authenticated batched motion and ordered durable event deltas',phases:[],passed:false};
const visual=process.argv.includes('--visual32'),stages=visual?[31]:[7,15,31];
const privateFile=new URL('../.cache/multiplayer-load-private.json',import.meta.url),reportFile=new URL('../verification/ambatopia/'+(visual?'multiplayer-32-repeat.json':'multiplayer-capacity.json'),import.meta.url);
const found=await admin.from('game_worlds').select('id').eq('name','QASCALE1018').single();assert.ok(found.data,'Create QASCALE1018 using the existing QA browser first');const world=found.data.id;
let chatUsers=[];
try{
 for(let i=0;i<31;i++){
  const email=randomUUID()+'@load.ambatopia.invalid',password=randomBytes(24).toString('base64url'),growId='LOAD'+randomBytes(4).toString('hex');
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
  accounts.push({id:data.user.id,growId});await writeFile(privateFile,JSON.stringify({world,accounts}));
  await rpc(admin,'game_register',{p_id:data.user.id,p_grow_id:growId,p_email:email,p_admin:false});
  const auth=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}}),signed=await auth.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;
  const token=signed.data.session.access_token,claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
  await rpc(admin,'game_activate_session',{p_user:data.user.id,p_session:claims.session_id});
  clients.push(createClient(config.url,config.publishableKey,{accessToken:async()=>token,auth:{persistSession:false,autoRefreshToken:false}}));
 }
 console.log('Provisioned 31 disposable load accounts. Human accounts are excluded.');
 for(const size of stages){
  const active=clients.slice(0,size),joined=[];
  for(const client of active)joined.push(await rpc(client,'game_join',{p_world:world}));
  const roster=await rpc(active[0],'game_roster',{p_world:world});assert.equal(roster.players.length,size+1,'QA browser must stay in the load world');
  const spawn=joined[0].snapshot.spawn,base=joined[0].players.find(p=>p.user_id===accounts[0].id),baseline=await Promise.all(active.map(client=>rpc(client,'game_sync_motion',{p_world:world})));
  const cursors=baseline.map(v=>v.cursor),seen=active.map(()=>new Map()),eventIds=active.map(()=>new Set()),eventKinds=active.map(()=>({})),seq=Array(size).fill(0),busy=Array(size).fill(0),submitted=new Map(),pending=new Set(),latencies=[],rtt=[],errors=[];
  let requests=0,accepted=0,minPlayers=size+1;const started=performance.now();
  function consume(i,value,sent){
   minPlayers=Math.min(minPlayers,value.players.length);
   rtt.push(performance.now()-sent);cursors[i]=Math.max(cursors[i],value.cursor);
   for(const p of value.players){const previous=seen[i].get(p.user_id)||0;if(p.sequence>previous){seen[i].set(p.user_id,p.sequence);const timestamp=submitted.get(p.user_id+':'+p.sequence);if(timestamp!=null)latencies.push(performance.now()-timestamp);}}
   for(const event of value.events)if(!eventIds[i].has(event.id)){eventIds[i].add(event.id);eventKinds[i][event.kind]=(eventKinds[i][event.kind]||0)+1;}
  }
  const tick=setInterval(()=>{
   for(let i=0;i<size;i++)if(busy[i]<2){busy[i]++;const sequence=++seq[i],sent=performance.now();submitted.set(accounts[i].id+':'+sequence,sent);requests++;
    const job=rpc(active[i],'game_sync_motion',{p_world:world,p_after:cursors[i],p_x:base.x+Math.sin((performance.now()-started)/1500+i)*.35,p_y:base.y,p_facing:i%2?'left':'right',p_animation:'walk',p_sequence:sequence}).then(v=>{if(v.accepted)accepted++;consume(i,v,sent);}).catch(e=>errors.push(e.message)).finally(()=>{busy[i]--;pending.delete(job);});pending.add(job);
   }
  },200);
  let expectedChat;
  try{
   await wait(6000);
   const state=await rpc(active[0],'game_state',{p_world:world}),tile={p_world:world,p_x:spawn.x+1,p_y:spawn.y+1,p_expected_version:state.world.version};
   let broken;for(let i=0;i<3;i++){broken=await rpc(active[0],'game_punch',{...tile,p_request_id:randomUUID()});await wait(250);}
   assert.equal(broken.edits[0]?.id,0,'three punches break the designated QA dirt tile');
   await rpc(active[0],'game_edit',{p_world:world,p_expected_version:broken.version,p_edits:[{x:spawn.x+1,y:spawn.y+1,layer:'foreground',id:1}],p_request_id:randomUUID()});
   expectedChat=await rpc(active[0],'game_chat',{p_world:world,p_text:'Capacity QA: '+(size+1)+' players, movement, punch, block and chat.',p_request_id:randomUUID()});chatUsers.push(accounts[0].id);
   console.log('LIVE '+(size+1)+' players: shared punch, restored block and chat submitted.');
   await wait(14000);
  }finally{clearInterval(tick);await Promise.allSettled([...pending]);}
  for(let i=0;i<size;i++){const sequence=++seq[i],sent=performance.now();submitted.set(accounts[i].id+':'+sequence,sent);consume(i,await rpc(active[i],'game_sync_motion',{p_world:world,p_after:cursors[i],p_x:base.x,p_y:base.y,p_facing:'right',p_animation:'idle',p_sequence:sequence}),sent);}
  for(let n=0;n<3;n++){await wait(250);await Promise.all(active.map(async(client,i)=>{const sent=performance.now();consume(i,await rpc(client,'game_sync_motion',{p_world:world,p_after:cursors[i]}),sent);}));}
  const converged=seen.every(map=>accounts.slice(0,size).every((account,i)=>map.get(account.id)===seq[i]));
  const eventsComplete=eventKinds.every(k=>k.punch===3&&k.edit===2&&k.chat===1)&&eventIds.every(ids=>ids.has(expectedChat)||ids.size>=6);
  const quantile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.floor((sorted.length-1)*p)]||0);};
  const phase={players:size+1,minPlayers,loadSenders:size,seconds:+((performance.now()-started)/1000).toFixed(1),requests,accepted,errors:errors.slice(0,5),errorCount:errors.length,propagationP50Ms:quantile(latencies,.5),propagationP95Ms:quantile(latencies,.95),rpcP95Ms:quantile(rtt,.95),allFinalPositionsConverged:converged,allClientsReceivedPunchBlockChat:eventsComplete,eventCounts:eventKinds[0]};
  phase.passed=minPlayers===size+1&&!errors.length&&converged&&eventsComplete&&phase.propagationP95Ms<1000;report.phases.push(phase);console.log(JSON.stringify(phase));await writeFile(reportFile,JSON.stringify(report,null,2));
  await Promise.all(active.map(client=>rpc(client,'game_leave',{p_world:world})));
  if(!phase.passed)break;
 }
 report.passed=report.phases.length===stages.length&&report.phases.every(p=>p.passed);
}finally{
 await Promise.allSettled(clients.map(client=>rpc(client,'game_leave',{p_world:world})));
 if(chatUsers.length){const removed=await admin.from('game_messages').delete().eq('world_id',world).in('user_id',[...new Set(chatUsers)]);if(removed.error)throw removed.error;}
 let clean=true;for(const account of accounts){const {error}=await admin.auth.admin.deleteUser(account.id);if(error)clean=false;}
 report.cleaned=clean;await writeFile(privateFile,JSON.stringify({world,accounts:clean?[]:accounts,cleaned:clean}));await writeFile(reportFile,JSON.stringify(report,null,2));
}
assert.ok(report.passed,'Load test did not satisfy all capacity/latency/convergence requirements');
