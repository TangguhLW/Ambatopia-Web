export function createEventBuffer(apply) {
 let active=false,version=0;const queue=[],seen=new Set();
 function push(event){
  if(!active){queue.push(event);return;}if(seen.has(event.id))return;
  seen.add(event.id);if(seen.size>2000)seen.delete(seen.values().next().value);
  if(event.version!=null){if(event.version<=version)return;if(event.version>version+1){apply({kind:'resync'});return;}version=event.version;}
  apply(event);
 }
 return {push,ready(value){version=value;active=true;for(const event of queue.splice(0))push(event);},pause(){active=false;}};
}
export async function connectWorld(api,worldId,{onEvent,onState,onConnection,onError}) {
 let disposed=false,resyncing=false,cursor=0,lastSync=0,rosterPending=false,syncPending=false,generation=0;const buffer=createEventBuffer(onEvent);
 const resync=async()=>{
  if(disposed||resyncing)return;resyncing=true;generation++;buffer.pause();
  try{
   let state,locks,chat;try{const baseline=await api.rpc('game_sync_motion',{p_world:worldId});cursor=baseline.cursor;[state,locks,chat]=await Promise.all([api.rpc('game_state',{p_world:worldId}),api.rpc('game_locks_list',{p_world:worldId}),api.rpc('game_chat_history',{p_world:worldId})]);}catch(error){if(disposed)return;if(!/WORLD_ACCESS_DENIED/.test(error.message))throw error;state=await api.rpc('game_join',{p_world:worldId});const baseline=await api.rpc('game_sync_motion',{p_world:worldId});cursor=baseline.cursor;[locks,chat]=await Promise.all([api.rpc('game_locks_list',{p_world:worldId}),api.rpc('game_chat_history',{p_world:worldId})]);}
   if(!disposed){onState({...state,locks,chat});buffer.ready(state.world.version);onConnection('Online');}
  }catch(error){if(!disposed)onError(error);}finally{resyncing=false;}
 };
 await resync();
 const move=async(position={})=>{
  if(disposed||resyncing||syncPending)return;lastSync=Date.now();syncPending=true;const epoch=generation;
  try{const result=await api.rpc('game_sync_motion',{p_world:worldId,p_after:cursor,...position});
  if(disposed||epoch!==generation)return;onEvent({kind:'motion',payload:{players:result.players}});
  for(const event of result.events)buffer.push(event);cursor=Math.max(cursor,result.cursor);
  onEvent({kind:'stream-version',payload:{version:result.version,caughtUp:result.cursor>=result.head}});onConnection('Online');
  return result;}finally{syncPending=false;}
 };
 const heartbeat=setInterval(()=>{if(!document.hidden)api.rpc('game_heartbeat',{p_world:worldId}).catch(onError);},20000);
 const roster=async()=>{if(disposed||rosterPending||resyncing)return;rosterPending=true;try{const value=await api.rpc('game_roster',{p_world:worldId});if(!disposed)onEvent({kind:'roster',payload:value});}catch(error){if(!disposed)onError(error);}finally{rosterPending=false;}};
 const reconcile=setInterval(()=>{if(!document.hidden)roster();},5000);
 const fallback=setInterval(()=>{if(!document.hidden&&Date.now()-lastSync>500)move().catch(onError);},500);
 const visible=()=>{if(!document.hidden)resync();};document.addEventListener('visibilitychange',visible);
 return {resync,roster,move,dispose(){disposed=true;clearInterval(heartbeat);clearInterval(reconcile);clearInterval(fallback);document.removeEventListener('visibilitychange',visible);}};
}
