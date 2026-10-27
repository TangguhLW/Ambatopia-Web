import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createTerrain} from '../game/world-format.mjs';

async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',auth.uid())$$;`);
 return db;
}
const player='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003';
async function seeded() {
 const db=await database();
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(directory)).filter(f=>/^\d.*\.sql$/.test(f)).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
 await db.exec(`insert into auth.users values('${player}'),('${other}'),('${admin}');`);
 for(const [id,name] of [[player,'PlayerOne'],[other,'PlayerTwo'],[admin,'Thaney']]){
  await db.query('select game_register($1,$2,$3,$4)',[id,name,id+'@internal.invalid',id===admin]);
  if((await db.query("select to_regclass('public.game_sessions') as name")).rows[0].name)await db.query('select game_activate_session($1,$1)',[id]);
 }
 return db;
}
async function actor(db,id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}

async function joinAtFixture(db,world){
 await db.query('select game_join($1)',[world]);await db.exec('reset role');
 await db.query('update game_memberships set x=4,y=22 where user_id=auth.uid()');await db.exec('set role authenticated');
}
test('direct lock placement emits one canonical announcement and cannot trap a player',async()=>{
 const db=await seeded();try{
  await actor(db,player);const id=(await db.query("select game_create_world('DIRECTLOCK',gen_random_uuid()) as id")).rows[0].id;
  await joinAtFixture(db,id);
  await assert.rejects(db.query("select game_place_lock($1,4,22,'world',0,gen_random_uuid())",[id]),/PLAYER_IN_TILE/);
  const request='90000000-0000-4000-8000-000000000001';
  const placed=(await db.query("select game_place_lock($1,5,22,'world',0,$2) as value",[id,request])).rows[0].value;
  assert.equal(placed.owner_id,player);assert.equal(placed.owner_name,'PlayerOne');assert.equal(placed.kind,'world');assert.equal(placed.x,5);
  assert.deepEqual((await db.query("select game_place_lock($1,5,22,'world',0,$2) as value",[id,request])).rows[0].value,placed);
  const sync=(await db.query('select game_sync_motion($1,0) as value',[id])).rows[0].value;
  assert.equal(sync.events.filter(e=>e.kind==='lock').length,1);assert.equal(sync.events.find(e=>e.kind==='lock').payload.owner_name,'PlayerOne');
 }finally{await db.close();}
});

test('punch lock removal RPC remains owner-only even for players granted building access',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query("select game_create_world('PUNCHLOCK',gen_random_uuid()) as id")).rows[0].id;await joinAtFixture(db,world);
  const lock=(await db.query("select game_place_lock($1,5,22,'diamond',0,gen_random_uuid()) as value",[world])).rows[0].value;
  await db.query("select game_grant($1,'PlayerTwo',true)",[lock.lock_id]);
  await actor(db,other);await joinAtFixture(db,world);
  await assert.rejects(db.query('select game_remove_lock($1,1,gen_random_uuid())',[lock.lock_id]),/OWNER_REQUIRED/);
  await actor(db,player);const request='90000000-0000-4000-8000-000000000009';
  const removed=(await db.query('select game_remove_lock($1,1,$2) as value',[lock.lock_id,request])).rows[0].value;assert.equal(removed.version,2);
  assert.deepEqual((await db.query('select game_remove_lock($1,1,$2) as value',[lock.lock_id,request])).rows[0].value,removed);
  const state=(await db.query('select game_state($1) as value',[world])).rows[0].value;assert.equal(state.snapshot.foreground[2205],0);assert.equal(state.world.owner_id,null);assert.equal((await db.query('select game_locks_list($1) as value',[world])).rows[0].value.length,0);
 }finally{await db.close();}
});

test('32 ordinary players can join one world, with membership and capacity still enforced',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query("select game_create_world('CAPACITYQA',gen_random_uuid()) as id")).rows[0].id;
  await db.query('select game_join($1)',[world]);
  for(let i=0;i<32;i++){
   await db.exec('reset role');const id='00000000-0000-4000-9000-'+String(i).padStart(12,'0');
   await db.query('insert into auth.users values($1)',[id]);await db.query('select game_register($1,$2,$3,false)',[id,'Capacity'+i,id+'@qa.invalid']);await db.query('select game_activate_session($1,$1)',[id]);await actor(db,id);
   if(i<31)await db.query('select game_join($1)',[world]);else await assert.rejects(db.query('select game_join($1)',[world]),/WORLD_FULL/);
  }
  await actor(db,player);const roster=(await db.query('select game_roster($1) as value',[world])).rows[0].value;assert.equal(roster.players.length,32);assert.equal(roster.snapshot,undefined);
  await actor(db,other);await assert.rejects(db.query('select game_roster($1)',[world]),/WORLD_ACCESS_DENIED/);
 }finally{await db.close();}
});

test('batched motion uses authenticated state, ordered event deltas and rejects stale movement',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query("select game_create_world('FRAMEQA',gen_random_uuid()) as id")).rows[0].id;
  const state=(await db.query('select game_join($1) as value',[world])).rows[0].value,{x,y}=state.players[0];
  const baseline=(await db.query('select game_sync_motion($1) as value',[world])).rows[0].value;
  const moved=(await db.query("select game_sync_motion($1,$2,$3,$4,'right','walk',1) as value",[world,baseline.cursor,x+.1,y])).rows[0].value;
  assert.equal(moved.accepted,true);assert.equal(moved.players[0].sequence,1);assert.deepEqual(moved.events,[]);
  const stale=(await db.query("select game_sync_motion($1,$2,$3,$4,'right','idle',1) as value",[world,baseline.cursor,x+.3,y])).rows[0].value;assert.equal(stale.accepted,false);assert.equal(stale.players[0].x,x+.1);
  await db.query("select game_chat($1,'frame test',gen_random_uuid())",[world]);
  const delta=(await db.query('select game_sync_motion($1,$2) as value',[world,baseline.cursor])).rows[0].value;
  assert.equal(delta.events.length,1);assert.equal(delta.events[0].kind,'chat');assert.equal(delta.events[0].stream_sequence,baseline.cursor+1);
  assert.deepEqual((await db.query('select game_sync_motion($1,$2) as value',[world,delta.cursor])).rows[0].value.events,[]);
  await db.exec('reset role');await db.query("insert into game_events(world_id,kind,payload) select $1,'punch',jsonb_build_object('n',n) from generate_series(1,129)n",[world]);await actor(db,player);
  const page=(await db.query('select game_sync_motion($1,$2) as value',[world,delta.cursor])).rows[0].value;
  assert.equal(page.events.length,128);assert.ok(page.cursor<page.head);
  const next=(await db.query('select game_sync_motion($1,$2) as value',[world,page.cursor])).rows[0].value;assert.equal(next.events.length,1);assert.equal(next.cursor,next.head);
  await actor(db,other);await assert.rejects(db.query('select game_sync_motion($1)',[world]),/WORLD_ACCESS_DENIED/);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int as n from game_events where kind='move'")).rows[0].n,0);
 }finally{await db.close();}
});

test('native terrain agrees across JS and SQL, with a White Door and bedrock foundation',async()=>{
 const db=await seeded();try{
  assert.deepEqual((await db.query("select game_generate_world('NATIVEWORLD') as value")).rows[0].value,createTerrain('NATIVEWORLD'));
  await actor(db,player);const id=(await db.query("select game_create_world('NATIVEWORLD',gen_random_uuid()) as id")).rows[0].id;
  const joined=(await db.query('select game_join($1) as value',[id])).rows[0].value,s=joined.snapshot,p=joined.players.find(p=>p.user_id===player);
  assert.equal(s.foreground[s.spawn.y*100+s.spawn.x],15);assert.equal(s.foreground[(s.spawn.y+1)*100+s.spawn.x],3);
  assert.equal(p.x,s.spawn.x+6/32);assert.equal(p.y,s.spawn.y+2/32);
  const same=(await db.query("select game_create_world('nativeworld',gen_random_uuid()) as id")).rows[0].id;assert.equal(same,id);
 }finally{await db.close();}
});

test('respawn returns to the White Door and rejects delayed movement from before the respawn',async()=>{
 const db=await seeded();try{
  await actor(db,player);const id=(await db.query("select game_create_world('RESPAWNQA',gen_random_uuid()) as id")).rows[0].id;
  const joined=(await db.query('select game_join($1) as value',[id])).rows[0].value,s=joined.snapshot.spawn;
  const args=[id,100,'10000000-0000-4000-8000-000000000066'];
  const result=(await db.query('select game_respawn($1,$2,$3) as value',args)).rows[0].value;
  assert.equal(result.x,s.x+6/32);assert.equal(result.y,s.y+2/32);assert.equal(result.sequence,101);
  assert.deepEqual((await db.query('select game_respawn($1,$2,$3) as value',args)).rows[0].value,result);
  assert.equal((await db.query("select game_move($1,5,22,'right','walk',99) as value",[id])).rows[0].value,false);
  await actor(db,other);await assert.rejects(db.query('select game_respawn($1,0,gen_random_uuid())',[id]),/WORLD_ACCESS_DENIED/);
 }finally{await db.close();}
});

test('punches damage and break blocks once, never place blocks, and preserve the entrance',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query("select game_create_world('FISTQA',gen_random_uuid()) as id")).rows[0].id;
  const joined=(await db.query('select game_join($1) as value',[world])).rows[0].value,{x,y}=joined.snapshot.spawn;
  const req='10000000-0000-4000-8000-000000000077';
  const punch=async(request)=> (await db.query('select game_punch($1,$2,$3,0,$4) as value',[world,x+1,y+1,request])).rows[0].value;
  const a=await punch(req);assert.equal(a.remaining,2);assert.deepEqual(await punch(req),a);
  assert.equal((await punch('10000000-0000-4000-8000-000000000078')).remaining,1);
  const broken=await punch('10000000-0000-4000-8000-000000000079');assert.equal(broken.version,1);assert.equal(broken.edits[0].id,0);
  await assert.rejects(db.query('select game_punch($1,$2,$3,1,gen_random_uuid())',[world,x,y]),/UNBREAKABLE/);
  await assert.rejects(db.query('select game_edit($1,1,$2,gen_random_uuid())',[world,[{x,y:y+1,id:0,layer:'foreground'}]]),/UNBREAKABLE/);
  await assert.rejects(db.query('select game_edit($1,1,$2,gen_random_uuid())',[world,[{x:x+2,y:y+1,id:5,layer:'foreground'}]]),/TILE_OCCUPIED/);
  const state=(await db.query('select game_state($1) as value',[world])).rows[0].value;
  assert.equal(state.snapshot.foreground[(y+1)*100+x+1],0);assert.equal(state.snapshot.foreground[y*100+x],15);
 }finally{await db.close();}
});

test('world joins choose clear spawn tiles without changing locked world data',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query("select game_create_world('SAFEJOIN','10000000-0000-4000-8000-000000000009') as id")).rows[0].id;
  await db.exec('reset role');await db.query("update game_worlds set snapshot=jsonb_set(snapshot,'{foreground,2205}','10') where id=$1",[world]);
  await actor(db,player);const joined=(await db.query('select game_join($1) as value',[world])).rows[0].value;
  const p=joined.players.find(p=>p.user_id===player);assert.notDeepEqual([p.x,p.y],[5,22]);
  assert.equal(joined.snapshot.foreground[2205],10);assert.equal(joined.snapshot.foreground[Math.floor(p.y)*100+Math.floor(p.x)],15);
 }finally{await db.close();}
});

test('native outfits persist without accepting identity fields or malformed item IDs',async()=>{
 const db=await seeded();try{
  await actor(db,player);
  const appearance={outfit:[0,48,0,0,0,0,0,0,0,0],skin:[240,190,140],hc:'#ffffff',ec:'',lc:''};
  const saved=(await db.query('select game_set_appearance($1) as value',[appearance])).rows[0].value;
  assert.deepEqual(saved,appearance);
  assert.deepEqual((await db.query('select game_me() as value')).rows[0].value.appearance,appearance);
  for(const invalid of [{...appearance,role:'superadmin'},{outfit:['48']},{outfit:[-1]},{skin:[999,2,3]},{hc:'javascript:alert(1)'}])await assert.rejects(db.query('select game_set_appearance($1)',[invalid]),/INVALID_APPEARANCE/);
 }finally{await db.close();}
});

test('snapshot validation rejects null and missing spawn coordinates',async()=>{
 const db=await seeded();try{
  for(const spawn of [null,{}, {x:null,y:22},{x:5},{x:'5',y:22}]){
   await assert.rejects(db.query('select game_validate_snapshot($1)',[{...createTerrain(),spawn}]),/INVALID_SPAWN/);
  }
 }finally{await db.close();}
});
test('Postgres accounts enforce immutable identities and service-only provisioning',async()=>{
 const db=await database();
 try{
  await assert.rejects(db.exec(await readFile(new URL('sql/accounts.sql',import.meta.url),'utf8')),/profiles missing/);
  await db.exec(await readFile(new URL('../supabase/migrations/001_accounts.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('sql/accounts.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${player}'),('${other}'),('${admin}');`);
  await db.query('select game_register($1,$2,$3,false)',[player,'PlayerOne','one@internal.invalid']);
  await assert.rejects(db.query('select game_register($1,$2,$3,false)',[other,'PLAYERONE','two@internal.invalid']),/unique/);
  await assert.rejects(db.query('select game_register($1,$2,$3,false)',[other,'Thaney','two@internal.invalid']),/NAME_RESERVED/);
  await db.query('select game_register($1,$2,$3,true)',[admin,'Thaney','admin@internal.invalid']);
  await db.query('select game_activate_session($1,$1)',[player]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${player}',false);`);
  const {rows}=await db.query('select game_me() as profile');assert.equal(rows[0].profile.grow_id,'PlayerOne');
  await assert.rejects(db.exec(`update game_profiles set grow_id='Hacked' where id='${player}'`),/permission denied/);
  await assert.rejects(db.query('select game_register($1,$2,$3,true)',[other,'Thaney','two@internal.invalid']),/permission denied/);
 }finally{await db.close();}
});
test('logout session revocation blocks an otherwise valid access JWT',async()=>{
 const db=await seeded();try{
  await actor(db,player);await db.query('select game_me()');await db.exec('reset role');
  await db.query('select game_revoke_sessions($1)',[player]);
  await actor(db,player);await assert.rejects(db.query('select game_me()'),/SESSION_REVOKED/);
 }finally{await db.close();}
});
test('world join, movement identity, chat deduplication and expired membership are enforced',async()=>{
 const db=await seeded();
 try{
  await actor(db,player);
  const {rows}=await db.query('select game_create_world($1,$2) as id',['start','10000000-0000-4000-8000-000000000001']);const world=rows[0].id;
  const rpc=async(sql,args=[])=>db.query(sql,args);
  await assert.rejects(rpc('select game_state($1)',[world]),/WORLD_ACCESS_DENIED/);
  await joinAtFixture(db,world);
  await rpc('select game_move($1,6,22,\'right\',\'walk\',1)',[world]);
  await assert.rejects(rpc('select game_move($1,-1,22,\'right\',\'walk\',2)',[world]),/INVALID_POSITION/);
  const request='20000000-0000-4000-8000-000000000001';
  await rpc('select game_chat($1,$2,$3)',[world,'<script>plain text</script>',request]);
  await rpc('select game_chat($1,$2,$3)',[world,'<script>plain text</script>',request]);
  const chat=await rpc('select game_chat_history($1) as messages',[world]);assert.equal(chat.rows[0].messages.length,1);
  assert.equal(chat.rows[0].messages[0].grow_id,'PlayerOne');
  await actor(db,other);await assert.rejects(rpc('select game_chat_history($1)',[world]),/WORLD_ACCESS_DENIED/);
  await db.exec('reset role');await db.exec(`update game_memberships set seen_at=now()-interval '61 seconds'`);
  await actor(db,player);await assert.rejects(rpc('select game_state($1)',[world]),/WORLD_ACCESS_DENIED/);
 }finally{await db.close();}
});
test('locks cannot be bypassed by direct edits, duplicates or replacing the lock tile',async()=>{
 const db=await seeded();
 try{
  await actor(db,player);
  const world=(await db.query('select game_create_world($1,$2) as id',['LOCKQA','30000000-0000-4000-8000-000000000001'])).rows[0].id;
  await joinAtFixture(db,world);
  const lock=(await db.query('select game_place_lock($1,5,22,\'world\',0,$2) as result',[world,'30000000-0000-4000-8000-000000000002'])).rows[0].result;
  assert.equal(lock.version,1);
  await actor(db,other);await joinAtFixture(db,world);
  const edit=[{x:6,y:22,layer:'foreground',id:5}];
  await assert.rejects(db.query('select game_edit($1,1,$2,$3)',[world,JSON.stringify(edit),'30000000-0000-4000-8000-000000000003']),/LOCKED/);
  await assert.rejects(db.query('select game_place_lock($1,6,22,\'diamond\',1,$2)',[world,'30000000-0000-4000-8000-000000000004']),/LOCKED/);
  await actor(db,player);
  await assert.rejects(db.query('select game_edit($1,1,$2,$3)',[world,JSON.stringify([{x:5,y:22,layer:'foreground',id:0}]),'30000000-0000-4000-8000-000000000005']),/LOCK_TILE/);
  await db.query('select game_grant($1,$2,true)',[lock.lock_id,'PlayerTwo']);
  await actor(db,other);
  const request='30000000-0000-4000-8000-000000000006';
  const a=await db.query('select game_edit($1,1,$2,$3) as result',[world,JSON.stringify(edit),request]);
  const b=await db.query('select game_edit($1,1,$2,$3) as result',[world,JSON.stringify(edit),request]);
  assert.equal(a.rows[0].result.version,2);assert.deepEqual(a.rows,b.rows);
  await assert.rejects(db.query('select game_edit($1,1,$2,$3)',[world,JSON.stringify(edit),'30000000-0000-4000-8000-000000000007']),/STALE_VERSION/);
 }finally{await db.close();}
});
test('developer operations require actual admin UUID, audit once and revoke banned players',async()=>{
 const db=await seeded();try{
  await actor(db,player);await assert.rejects(db.query("select game_admin_users('',0,30)"),/ADMIN_REQUIRED/);
  await actor(db,admin);
  const users=(await db.query("select game_admin_users('',0,30) as users")).rows[0].users;
  assert.equal(users.length,3);assert.ok(!JSON.stringify(users).includes('auth_email'));
  const request='50000000-0000-4000-8000-000000000001';
  for(let i=0;i<2;i++)await db.query('select game_admin_action($1,$2,$3,$4)',['ban',player,JSON.stringify({reason:'QA'}),request]);
  await db.exec('reset role');assert.equal((await db.query("select count(*)::integer as n from game_admin_audit where action='ban'")).rows[0].n,1);
  await actor(db,player);await assert.rejects(db.query('select game_me()'),/ACCOUNT_BANNED/);
 }finally{await db.close();}
});
test('area protection bounds and concurrent-version claims cannot absorb another owner',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query('select game_create_world($1,$2) as id',['AREAQA','60000000-0000-4000-8000-000000000001'])).rows[0].id;await joinAtFixture(db,world);
  const preview=(await db.query("select game_preview_lock($1,5,22,'small') as tiles",[world])).rows[0].tiles;assert.equal(preview.length,10);assert.equal(new Set(preview).size,10);
  await db.query("select game_place_lock($1,5,22,'small',0,$2)",[world,'60000000-0000-4000-8000-000000000002']);
  await actor(db,other);await joinAtFixture(db,world);
  await assert.rejects(db.query("select game_place_lock($1,10,22,'world',1,$2)",[world,'60000000-0000-4000-8000-000000000003']),/FOREIGN_LOCK/);
  await actor(db,player);
  const races=await Promise.allSettled([db.query("select game_place_lock($1,10,22,'world',1,$2)",[world,'60000000-0000-4000-8000-000000000004']),db.query("select game_place_lock($1,9,22,'diamond',1,$2)",[world,'60000000-0000-4000-8000-000000000005'])]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.match(races.find(r=>r.status==='rejected').reason.message,/STALE_VERSION/);
 }finally{await db.close();}
});
test('server rejects null edit payload, and developer tracks menu presence without world membership',async()=>{
 const db=await seeded();try{
  await actor(db,player);await db.query('select game_touch()');
  const world=(await db.query('select game_create_world($1,$2) as id',['NULLQA','70000000-0000-4000-8000-000000000001'])).rows[0].id;await joinAtFixture(db,world);
  await assert.rejects(db.query('select game_edit($1,0,null,$2)',[world,'70000000-0000-4000-8000-000000000002']),/INVALID_EDITS/);
  await db.query('select game_leave($1)',[world]);await actor(db,admin);
  const users=(await db.query("select game_admin_users('PlayerOne',0,30) as users")).rows[0].users;assert.equal(users[0].online,true);
 }finally{await db.close();}
});
test('world publish requires ownership, preserves locks and rejects unknown tile IDs atomically',async()=>{
 const db=await seeded();try{
  await actor(db,player);const world=(await db.query('select game_create_world($1,$2) as id',['IMPORTQA','80000000-0000-4000-8000-000000000001'])).rows[0].id;await joinAtFixture(db,world);
  const snapshot=createTerrain('IMPORTQA');
  await assert.rejects(db.query('select game_publish($1,$2,0,$3)',[world,JSON.stringify(snapshot),'80000000-0000-4000-8000-000000000002']),/OWNER_REQUIRED/);
  await db.query("select game_place_lock($1,5,22,'world',0,$2)",[world,'80000000-0000-4000-8000-000000000003']);snapshot.foreground[2205]=10;
  const invalid=structuredClone(snapshot);invalid.foreground[5]=999999;
  await assert.rejects(db.query('select game_publish($1,$2,1,$3)',[world,JSON.stringify(invalid),'80000000-0000-4000-8000-000000000004']),/INVALID_ITEM/);
  const result=(await db.query('select game_publish($1,$2,1,$3) as result',[world,JSON.stringify(snapshot),'80000000-0000-4000-8000-000000000005'])).rows[0].result;assert.equal(result.version,2);
  await actor(db,admin);await joinAtFixture(db,world);
  await db.query('select game_edit($1,2,$2,$3)',[world,JSON.stringify([{x:6,y:22,layer:'foreground',id:5}]),'80000000-0000-4000-8000-000000000006']);
  await db.exec('reset role');assert.ok((await db.query("select count(*)::integer as n from game_admin_audit where action='game_worlds:UPDATE'")).rows[0].n>=1);
 }finally{await db.close();}
});
