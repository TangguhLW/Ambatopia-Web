import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import config from '../cloud/config.json' with {type:'json'};
const root=fileURLToPath(new URL('..',import.meta.url)),origin=process.env.QA_ORIGIN||'http://localhost:4175';
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin))throw Error('Use isolated localhost preview for mutating QA');
const directory=join(root,'.cache'),credentialFile=join(directory,'online-qa.json');await mkdir(directory,{recursive:true});
let accounts;try{accounts=JSON.parse(await readFile(credentialFile,'utf8'));}catch{accounts=[0,1].map(()=>({growId:'QA'+randomBytes(5).toString('hex'),password:randomBytes(24).toString('base64url')}));}
const report={at:new Date().toISOString(),checks:[],passed:false};
function check(label,ok){assert.ok(ok,label);report.checks.push({label,passed:true});console.log('PASS '+label);}
async function account(action,user){const res=await fetch(origin+'/api/account',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action,...user})});const body=await res.json();if(res.status!==200)throw Error('Account '+action+' failed: '+res.status+' '+body.code);return body;}
const clients=[];
try{
 for(const user of accounts){
  const result=await account(user.created?'login':'signup',{growId:user.growId,password:user.password});user.created=true;user.id=result.profile.id;
  clients.push(createClient(config.url,config.publishableKey,{accessToken:async()=>result.accessToken,auth:{persistSession:false,autoRefreshToken:false}}));
  await writeFile(credentialFile,JSON.stringify(accounts));
 }
 check('two real Auth accounts provisioned with immutable Grow IDs',accounts[0].id!==accounts[1].id);
 const rpc=async(client,name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw Error(name+': '+error.message);return data;};
 const denied=await clients[0].from('game_profiles').update({grow_id:'ChangedName'}).eq('id',accounts[0].id);check('direct profile rename denied',!!denied.error);
 const elevated=await clients[0].rpc('game_admin_users');check('ordinary player cannot inspect developer data',!!elevated.error);
 let world=accounts[0].worldId;
 if(!world){world=await rpc(clients[0],'game_create_world',{p_name:'QA'+randomBytes(5).toString('hex'),p_request_id:randomUUID()});accounts[0].worldId=world;await writeFile(credentialFile,JSON.stringify(accounts));}
 for(const client of clients)await rpc(client,'game_join',{p_world:world});
 const state=await rpc(clients[0],'game_state',{p_world:world});check('two users join same persistent world',state.players.length===2);
 const request=randomUUID(),chatText='Online QA '+request;await rpc(clients[0],'game_chat',{p_world:world,p_text:chatText,p_request_id:request});await rpc(clients[0],'game_chat',{p_world:world,p_text:'Online QA message',p_request_id:request});
 const messages=await rpc(clients[1],'game_chat_history',{p_world:world});check('chat identity and idempotency',messages.filter(m=>m.user_id===accounts[0].id&&m.text===chatText).length===1&&messages.at(-1).grow_id===accounts[0].growId);
 const locks=await rpc(clients[0],'game_locks_list',{p_world:world});
 let lock=locks.find(l=>l.kind==='world');
 if(!lock){const result=await rpc(clients[0],'game_place_lock',{p_world:world,p_x:5,p_y:22,p_kind:'world',p_expected_version:state.world.version,p_request_id:randomUUID()});lock={id:result.lock_id};}
 const current=await rpc(clients[0],'game_state',{p_world:world});
 const attack=await clients[1].rpc('game_edit',{p_world:world,p_expected_version:current.world.version,p_edits:[{x:6,y:22,layer:'foreground',id:5}],p_request_id:randomUUID()});check('ungranted player cannot edit locked world',!!attack.error&&/LOCKED/.test(attack.error.message));
 await rpc(clients[0],'game_grant',{p_lock:lock.id,p_target_grow_id:accounts[1].growId,p_allow:true});
 const editId=randomUUID();const edit=await rpc(clients[1],'game_edit',{p_world:world,p_expected_version:current.world.version,p_edits:[{x:6,y:22,layer:'foreground',id:5}],p_request_id:editId});
 const repeat=await rpc(clients[1],'game_edit',{p_world:world,p_expected_version:current.world.version,p_edits:[{x:6,y:22,layer:'foreground',id:5}],p_request_id:editId});check('granted edit persists once',edit.version===repeat.version);
 const saved=await rpc(clients[0],'game_state',{p_world:world});check('shared saved tile read by another account',saved.snapshot.foreground[2206]===5);
 await rpc(clients[0],'game_grant',{p_lock:lock.id,p_target_grow_id:accounts[1].growId,p_allow:false});
 for(const client of clients)await rpc(client,'game_leave',{p_world:world});
 const missing=await clients[1].rpc('game_state',{p_world:world});check('leaving revokes world reads',!!missing.error);
 report.passed=true;
}finally{
 for(const client of clients)await client.removeAllChannels();
 await mkdir(join(root,'verification','online'),{recursive:true});await writeFile(join(root,'verification','online','api-report.json'),JSON.stringify(report,null,2));
}
