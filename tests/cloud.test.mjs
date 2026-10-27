import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSnapshot,restoreSnapshot,validateSnapshot} from '../cloud/state.mjs';

function storage(initial={}) {
  const map=new Map(Object.entries(initial));
  return {get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
test('cloud snapshots include app data while excluding auth sessions and restoration backups',()=>{
  const data=storage({world:'{"name":"QA"}',sets:'[]','sb-project-auth-token':'SECRET','growtopia-cloud:restore-backup':'OLD'});
  const snapshot=collectSnapshot(data);
  assert.deepEqual(snapshot.storage,{world:'{"name":"QA"}',sets:'[]'});
  assert.ok(!JSON.stringify(snapshot).includes('SECRET'));
  assert.throws(()=>validateSnapshot({version:1,storage:{'sb-project-auth-token':'injected'}}));
  assert.throws(()=>validateSnapshot({version:1,storage:{world:{}}}));
});
test('restore retains login, replaces app data, and keeps a recoverable local backup',()=>{
  const data=storage({world:'old',extra:'old','sb-project-auth-token':'TOKEN'});
  restoreSnapshot(data,{version:1,storage:{world:'new'}});
  assert.equal(data.getItem('world'),'new');assert.equal(data.getItem('extra'),null);
  assert.equal(data.getItem('sb-project-auth-token'),'TOKEN');
  assert.equal(JSON.parse(data.getItem('growtopia-cloud:restore-backup')).storage.world,'old');
});
test('invalid restore leaves browser data untouched',()=>{
  const data=storage({world:'old'});
  assert.throws(()=>restoreSnapshot(data,{version:99,storage:{world:'bad'}}));
  assert.equal(data.getItem('world'),'old');
});
