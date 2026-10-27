import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventBuffer,connectWorld} from '../game/realtime.mjs';
test('snapshot version filters old tile events, duplicates and detects missing versions',()=>{
 const seen=[],buffer=createEventBuffer(event=>seen.push(event));
 buffer.push({id:'old',kind:'edit',version:1});buffer.push({id:'new',kind:'edit',version:2});
 buffer.ready(1);assert.deepEqual(seen.map(e=>e.id),['new']);
 buffer.push({id:'new',kind:'edit',version:2});assert.equal(seen.length,1);
 buffer.push({id:'chat',kind:'chat'});buffer.push({id:'gap',kind:'edit',version:4});
 assert.equal(seen.at(-1).kind,'resync');
});
test('motion requests never overlap and a response from before resync cannot replace the new snapshot',async()=>{
 const original=globalThis.document;globalThis.document=new EventTarget();globalThis.document.hidden=false;
 let resolveMove,requests=0;const events=[];
 const api={rpc:async(name,args)=>{
  if(name==='game_sync_motion'){if(args.p_after!==undefined){requests++;return new Promise(resolve=>{resolveMove=resolve;});}return {cursor:0};}
  if(name==='game_state')return {world:{version:1},players:[],snapshot:{}};
  return [];
 }};let connection;
 try{connection=await connectWorld(api,'world',{onEvent:e=>events.push(e),onState(){},onConnection(){},onError:e=>{throw e;}});
  const pending=connection.move({p_sequence:1});await connection.move({p_sequence:2});assert.equal(requests,1);
  await connection.resync();resolveMove({players:[{sequence:1}],events:[],cursor:1,head:1,version:1});await pending;
  assert.equal(events.length,0);
  const next=connection.move({p_sequence:3});assert.equal(requests,2);resolveMove({players:[{sequence:3}],events:[],cursor:2,head:2,version:1});await next;
  assert.equal(events[0].payload.players[0].sequence,3);
 }finally{connection?.dispose();globalThis.document=original;}
});
