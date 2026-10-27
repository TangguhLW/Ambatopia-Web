import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import config from '../cloud/config.json' with {type:'json'};
const accounts=JSON.parse(await readFile(new URL('../.cache/online-qa.json',import.meta.url))),user=accounts[1],origin='http://localhost:4175';
const response=await fetch(origin+'/api/account',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',growId:user.growId,password:user.password})});
assert.equal(response.status,200);const auth=await response.json();
const client=createClient(config.url,config.publishableKey,{accessToken:async()=>auth.accessToken,auth:{persistSession:false,autoRefreshToken:false}});
const report={at:new Date().toISOString(),checks:[],passed:false};
const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw Error(name+': '+error.message);return data;};
const check=(label,ok)=>{assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);};
let world;
try{
 world=await rpc('game_create_world',{p_name:'QANATIVE1018',p_request_id:randomUUID()});
 await rpc('game_join',{p_world:world});let state=await rpc('game_state',{p_world:world});
 const door=state.snapshot.foreground.indexOf(15),x=door%100,y=Math.floor(door/100),self=state.players.find(p=>p.user_id===auth.profile.id);
 check('shared native terrain has White Door with bedrock below',door>=0&&state.snapshot.foreground[door+100]===3);
 check('join uses native six-pixel horizontal and two-pixel vertical offset',self.x===x+6/32&&self.y===y+2/32);
 const existing=await rpc('game_create_world',{p_name:'qanative1018',p_request_id:randomUUID()});check('entering an existing name preserves world identity',existing===world);
 check('two accounts share the world',state.players.length===2);
 const respawn=await rpc('game_respawn',{p_world:world,p_sequence:100,p_request_id:randomUUID()});
 check('server respawn returns the canonical White Door',respawn.x===self.x&&respawn.y===self.y&&respawn.sequence>100);
 const stale=await rpc('game_move',{p_world:world,p_x:self.x+1,p_y:self.y,p_facing:'right',p_animation:'walk',p_sequence:99});check('pre-respawn movement cannot overwrite respawn',stale===false);
 const tile={p_world:world,p_x:x+1,p_y:y+1,p_expected_version:state.world.version};
 // Restore only the designated QA dirt tile previously opened by the browser test.
 if(state.snapshot.foreground[(y+1)*100+x+1]===0){await rpc('game_edit',{p_world:world,p_expected_version:state.world.version,p_edits:[{x:x+1,y:y+1,layer:'foreground',id:1}],p_request_id:randomUUID()});state=await rpc('game_state',{p_world:world});tile.p_expected_version=state.world.version;}
 const request=randomUUID(),first=await rpc('game_punch',{...tile,p_request_id:request}),repeat=await rpc('game_punch',{...tile,p_request_id:request});
 check('punch damages without placing and duplicate hits count once',first.remaining===2&&repeat.remaining===2&&first.edits.length===0);
 await new Promise(resolve=>setTimeout(resolve,250));
 const second=await rpc('game_punch',{...tile,p_request_id:randomUUID()});
 await new Promise(resolve=>setTimeout(resolve,250));
 const third=await rpc('game_punch',{...tile,p_request_id:randomUUID()});
 check('three punches remove dirt exactly once',second.remaining===1&&third.remaining===0&&third.edits[0].id===0);
 await rpc('game_edit',{p_world:world,p_expected_version:third.version,p_edits:[{x:x+1,y:y+1,layer:'foreground',id:1}],p_request_id:randomUUID()});
 const saved=await rpc('game_state',{p_world:world});check('place restores the QA tile in persistent world data',saved.snapshot.foreground[(y+1)*100+x+1]===1);
 await rpc('game_chat',{p_world:world,p_text:'Native punch, White Door and shared world verified!',p_request_id:randomUUID()});
 console.log('READY: remote chat bubble and avatar available for browser verification');
 for(let i=0;i<5;i++){await new Promise(resolve=>setTimeout(resolve,4000));await rpc('game_heartbeat',{p_world:world});}
 report.passed=true;
}finally{
 if(world)await rpc('game_leave',{p_world:world});await client.removeAllChannels();
 await writeFile(new URL('../verification/ambatopia/gameplay-api-report.json',import.meta.url),JSON.stringify(report,null,2));
}
