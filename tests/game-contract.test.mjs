import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGrowId,normalizeWorldName} from '../game/contract.mjs';
import {createTerrain,validateSnapshot} from '../game/world-format.mjs';

test('Grow IDs preserve display but compare case-insensitively and reject ambiguous input',()=>{
  assert.deepEqual(normalizeGrowId('Thaney'),{display:'Thaney',key:'thaney'});
  assert.equal(normalizeGrowId('THANEY').key,'thaney');
  for(const v of ['ab','a'.repeat(21),' abc','abc ','Thаney','ab-c','a<script>'])assert.throws(()=>normalizeGrowId(v));
});
test('world names normalize and reject unsafe or excessive input',()=>{
  assert.equal(normalizeWorldName('start'),'START');
  for(const v of ['',' space ','a'.repeat(25),'a/b','a_b'])assert.throws(()=>normalizeWorldName(v));
});
test('terrain is deterministic and canonical world validation is strict',()=>{
  const world=createTerrain('START');assert.deepEqual(world,createTerrain('START'));
  assert.equal(world.foreground.length,6000);assert.equal(world.background.length,6000);
  assert.deepEqual(validateSnapshot(world),world);
  for(const patch of [{width:99},{foreground:[]},{spawn:{x:-1,y:0}},{foreground:Array(6000).fill(999999)},{schema:2}]){
    assert.throws(()=>validateSnapshot({...world,...patch}));
  }
});
