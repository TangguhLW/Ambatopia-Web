import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrack,avatarFrame} from '../game/engine/motion.mjs';
test('remote movement interpolates packets, ignores stale replies and bounds prediction during a stalled network',()=>{
 const track=createMotionTrack({x:5,y:23,sequence:1,animation:'walk',facing:'right'},0);
 track.push({x:7,y:23,sequence:2,animation:'walk',facing:'right'},200);
 assert.equal(track.sample(200).x,6);
 track.push({x:4,y:23,sequence:1,animation:'walk',facing:'left'},250);
 assert.equal(track.sample(250).facing,'right');assert.equal(track.sample(250).x,6.5);
 assert.ok(track.sample(500).x<=8.2);assert.equal(track.sample(1400).animation,'idle');
});
test('idle updates stop prediction, and respawn-sized jumps snap without sliding across the world',()=>{
 const track=createMotionTrack({x:5,y:23,sequence:1,animation:'walk',facing:'right'},0);
 track.push({x:7,y:23,sequence:2,animation:'idle',facing:'right'},200);
 assert.equal(track.sample(600).x,7);
 track.push({x:60,y:23,sequence:3,animation:'idle',facing:'right'},700);
 assert.equal(track.sample(700).x,60);
});
test('motion samples cannot overwrite newer clothing or identity metadata',()=>{
 const track=createMotionTrack({x:5,y:23,sequence:1,animation:'idle',facing:'right',appearance:{outfit:[48]},grow_id:'Player'},0);
 assert.equal('appearance' in track.sample(100),false);assert.equal('grow_id' in track.sample(100),false);
});
test('avatar frames vary while walking and punching but share keys across usernames and positions',()=>{
 const player={appearance:{outfit:[48]},animation:'walk',facing:'left',x:1,grow_id:'First'};
 assert.notEqual(avatarFrame(player,0).key,avatarFrame(player,100).key);
 assert.equal(avatarFrame(player,0).key,avatarFrame({...player,x:50,grow_id:'Second'},400).key);
 assert.notEqual(avatarFrame(player,100,50).key,avatarFrame(player,100).key);
 assert.notEqual(avatarFrame(player,100).key,avatarFrame({...player,appearance:{outfit:[49]}},100).key);
});
