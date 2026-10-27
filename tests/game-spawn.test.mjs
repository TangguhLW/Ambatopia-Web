import test from 'node:test';
import assert from 'node:assert/strict';
import {safePosition} from '../game/engine/safe-position.mjs';
import {createTerrain} from '../game/world-format.mjs';

test('spawn clears the entire native 20 by 30 pixel body, including an adjacent tile',()=>{
 const world=createTerrain();world.foreground[2205]=10;
 const safe=safePosition(world,{x:5,y:22});
 assert.notDeepEqual(safe,{x:5,y:22});
 assert.equal(world.foreground[Math.floor(safe.y)*100+Math.floor(safe.x)],0);
 world.foreground[2205]=0;world.foreground[2206]=5;
 assert.deepEqual(safePosition(world,{x:5.7,y:22}),{x:5,y:22});
 assert.deepEqual(safePosition(world,{x:4.1,y:22.02}),{x:4.1,y:22.02});
});
test('sealed world fails explicitly instead of repeatedly killing the player',()=>{
 const world=createTerrain();world.foreground.fill(1);
 assert.throws(()=>safePosition(world,world.spawn),/WORLD_HAS_NO_SAFE_SPAWN/);
});
