import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../cloud/config.json' with {type:'json'};
const root=fileURLToPath(new URL('..',import.meta.url));process.loadEnvFile(join(root,'.env.online.local'));
const admin=createClient(config.url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=({data,error})=>{if(error)throw Error(error.message);return data;};
const accounts=[],worlds=[],clients=[],report={at:new Date().toISOString(),scope:'Supabase movement propagation smoke, not a sustained MMO capacity guarantee',phases:[],recommendedCap:0};
const privateFile=join(root,'.cache','load-qa-private.json');
async function persistPrivate(){await writeFile(privateFile,JSON.stringify({accounts,worlds}));}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 for(let i=0;i<8;i++){
  const growId='LOAD'+randomBytes(4).toString('hex'),email=randomUUID()+'@qa.growtopia.invalid',password=randomBytes(24).toString('base64url');
  const {user}=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true}));accounts.push({id:user.id,growId});await persistPrivate();
  unwrap(await admin.rpc('game_register',{p_id:user.id,p_grow_id:growId,p_email:email,p_admin:false}));
  const auth=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {session}=unwrap(await auth.auth.signInWithPassword({email,password}));const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
  unwrap(await admin.rpc('game_activate_session',{p_user:user.id,p_session:claims.session_id}));
  clients.push(createClient(config.url,config.publishableKey,{accessToken:async()=>session.access_token,auth:{persistSession:false,autoRefreshToken:false}}));
 }
 console.log('Provisioned 8 disposable load players (no admin role).');
 for(const size of [2,4,8]){
  const active=clients.slice(0,size),world=unwrap(await active[0].rpc('game_create_world',{p_name:'LOAD'+randomBytes(4).toString('hex'),p_request_id:randomUUID()}));worlds.push(world);await persistPrivate();
  for(const client of active)unwrap(await client.rpc('game_join',{p_world:world}));
  let failures=0,requests=0,accepted=0,superseded=0,received=0;const submitted=new Map(),latencies=[],channels=[];
  await Promise.all(active.map(async client=>{
   await client.realtime.setAuth();const channel=client.channel('game:'+world,{config:{private:true}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_events',filter:'world_id=eq.'+world},({new:event})=>{
    if(event.kind!=='move')return;const sent=submitted.get(event.payload.user_id+':'+event.payload.sequence);if(sent!=null){received++;latencies.push(performance.now()-sent);}
   });channels.push(channel);
   await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Load subscription timeout')),20000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(Error('Load channel rejected'));}});});
  }));
  const start=performance.now(),pending=new Set(),sequences=Array(size).fill(0),busy=Array(size).fill(0);
  const timer=setInterval(()=>{
   for(let i=0;i<size;i++)if(busy[i]<3){
    busy[i]++;const sequence=++sequences[i],x=5+Math.sin((performance.now()-start)/2000+i)*.5;submitted.set(accounts[i].id+':'+sequence,performance.now());requests++;
    const job=active[i].rpc('game_move',{p_world:world,p_x:x,p_y:22,p_facing:'right',p_animation:'walk',p_sequence:sequence}).then(({data,error})=>{if(error)failures++;else if(data===true)accepted++;else superseded++;}).catch(()=>failures++).finally(()=>{busy[i]--;pending.delete(job);});pending.add(job);
   }
  },200);
  await wait(15000);clearInterval(timer);await Promise.allSettled([...pending]);await wait(2000);
  const duration=(performance.now()-start)/1000,sorted=latencies.sort((a,b)=>a-b),quantile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??null;
  const expected=accepted*size,deliveryLoss=expected?Math.max(0,1-received/expected):1;
  const phase={clients:size,durationSeconds:+duration.toFixed(2),requests,accepted,superseded,errors:failures,received,expected,deliveryLoss:+deliveryLoss.toFixed(4),updatesPerPlayerPerSecond:+(accepted/15/size).toFixed(2),p50Ms:quantile(.5),p95Ms:quantile(.95)};
  phase.passed=!!latencies.length&&failures/requests<=.01&&deliveryLoss<=.01&&phase.p95Ms<=1000&&phase.updatesPerPlayerPerSecond>=4;
  report.phases.push(phase);if(phase.passed)report.recommendedCap=size;console.log(JSON.stringify(phase));
  await Promise.all(active.map(client=>client.removeAllChannels()));for(const client of active)await client.rpc('game_leave',{p_world:world});
  if(!phase.passed)break;
 }
}finally{
 await Promise.allSettled(clients.map(client=>client.removeAllChannels()));
 for(const world of worlds){const {error}=await admin.from('game_worlds').delete().eq('id',world);if(error)console.error('QA world cleanup requires retry.');}
 let clean=true;for(const account of accounts){const {error}=await admin.auth.admin.deleteUser(account.id);if(error){clean=false;console.error('QA account cleanup requires retry.');}}
 if(clean)await rm(privateFile,{force:true});
 report.cleaned=clean;await mkdir(join(root,'verification','online'),{recursive:true});await writeFile(join(root,'verification','online','load-report.json'),JSON.stringify(report,null,2));
}
if(!report.recommendedCap)process.exitCode=1;
