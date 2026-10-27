import test from 'node:test';
import assert from 'node:assert/strict';
import {tileIntent,playerIntent,bubbleDuration,atWhiteDoor} from '../game/interactions.mjs';
test('fist and keyboard punch never place a previously selected block',()=>{
 assert.deepEqual(tileIntent('punch',1,{x:5,y:22}),{action:'punch',x:5,y:22});
 assert.deepEqual(tileIntent('build',1,{x:5,y:22,action:'punch'}),{action:'punch',x:5,y:22});
 assert.equal(tileIntent('build',1,{x:5,y:22}).action,'place');
});
test('chat bubbles expire according to readable message length within bounded limits',()=>{
 assert.ok(bubbleDuration('hello')<bubbleDuration('A longer sentence that takes more time to read.'));
 assert.equal(bubbleDuration(''),3500);assert.equal(bubbleDuration('a'.repeat(1000)),14000);
});
test('punch at the White Door exits regardless of facing or selected block, while building and nearby punches stay in-world',()=>{
 const snapshot={width:100,foreground:Array(6000).fill(0)};snapshot.foreground[2305]=15;
 const player={x:5+6/32,y:23+2/32};assert.equal(atWhiteDoor(snapshot,player),true);
 for(const x of [4,6])assert.equal(playerIntent(snapshot,player,'build',1,{x,y:23,action:'punch'}).action,'exit');
 assert.equal(playerIntent(snapshot,player,'punch',0,{x:6,y:23}).action,'exit');
 assert.equal(playerIntent(snapshot,player,'build',1,{x:6,y:23}).action,'place');
 assert.equal(playerIntent(snapshot,{x:7,y:23},'punch',0,{x:6,y:23}).action,'punch');
});
