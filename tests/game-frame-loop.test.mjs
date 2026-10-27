import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLoop} from '../game/engine/frame-loop.mjs';
test('prewarmed engine schedules no animation work until acquired, and pause/resume never duplicates callbacks',()=>{
 let next=0,ran=0;const pending=new Map(),loop=createFrameLoop(fn=>{pending.set(++next,fn);return next;},id=>pending.delete(id));
 loop.request(()=>ran++);assert.equal(pending.size,0);loop.resume();loop.resume();assert.equal(pending.size,1);
 loop.pause();assert.equal(pending.size,0);loop.resume();assert.equal(pending.size,1);
 const [id,fn]=[...pending][0];pending.delete(id);fn(100);assert.equal(ran,1);
 loop.pause();loop.resume();assert.equal(pending.size,0);
});
test('cancelled animation callbacks cannot return when a parked engine resumes',()=>{
 let next=0;const pending=new Map(),loop=createFrameLoop(fn=>{pending.set(++next,fn);return next;},id=>pending.delete(id));
 const cancelled=loop.request(()=>assert.fail('cancelled frame ran'));loop.cancel(cancelled);loop.resume();assert.equal(pending.size,0);
 const active=loop.request(()=>{});assert.equal(pending.size,1);loop.cancel(active);assert.equal(pending.size,0);
});
