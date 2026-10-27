import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnginePool} from '../game/engine/pool.mjs';

function fixture(){let created=0,removed=0;const frames=[];return {frames,get created(){return created;},get removed(){return removed;},pool:createEnginePool({create(){created++;const frame={remove(){removed++;}};frames.push(frame);return frame;},park(frame){frame.parked=true;},pause(frame){frame.paused=true;},resume(frame){frame.paused=false;}})};}
test('one authenticated account reuses its prepared iframe across world visits',()=>{
 const f=fixture();f.pool.prepare('qa-one');assert.equal(f.created,1);
 const first=f.pool.acquire('qa-one');assert.equal(first,f.frames[0]);assert.equal(first.paused,false);
 f.pool.release(first);assert.equal(first.paused,true);
 assert.equal(f.pool.acquire('qa-one'),first);assert.equal(f.created,1);
});
test('changing account and logout discard the previous engine and late releases cannot resurrect it',()=>{
 const f=fixture(),first=f.pool.acquire('qa-one');f.pool.prepare('qa-two');assert.equal(f.removed,1);
 f.pool.release(first);assert.equal(f.pool.acquire('qa-two'),f.frames[1]);
 f.pool.clear();assert.equal(f.removed,2);f.pool.prepare(null);assert.equal(f.created,2);
});
test('a failed or unavailable engine is discarded so the next visit can retry',()=>{
 const f=fixture(),first=f.pool.acquire('qa-one');f.pool.discard(first);
 assert.notEqual(f.pool.acquire('qa-one'),first);assert.equal(f.created,2);
});
