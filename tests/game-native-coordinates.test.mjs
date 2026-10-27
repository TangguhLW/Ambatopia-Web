import test from 'node:test';
import assert from 'node:assert/strict';
import {tileAt,avatarBox,isGameUiTarget} from '../game/engine/native-coordinates.mjs';

test('game keyboard input excludes toolbar buttons, chat handles and form fields',()=>{
 assert.equal(isGameUiTarget({tagName:'INPUT'}),true);
 assert.equal(isGameUiTarget({tagName:'svg',closest:()=>({tagName:'BUTTON'})}),true);
 assert.equal(isGameUiTarget({tagName:'SUMMARY',closest:()=>({tagName:'SUMMARY'})}),true);
 assert.equal(isGameUiTarget({tagName:'CANVAS',closest:()=>null}),false);
 assert.equal(isGameUiTarget(null),false);
});
test('chat positioning works before optional native geometry metadata is ready',()=>{
 const box=avatarBox({x:5,y:22},{ox:0,oy:0,k:1},undefined,1);assert.equal(box.x,170);assert.equal(box.width,280);
});
test('native ox/oy camera maps stage-relative clicks and remote avatars at both DPRs',()=>{
 for(const dpr of [1,2]){
  const view={ox:320,oy:640,k:2*dpr};
  assert.deepEqual(tileAt({x:248,y:176},view,{left:152,top:48},dpr),{x:11,y:22});
  const box=avatarBox({x:11,y:22},view,{CW:280,CH:224,OX:156,OY:172},dpr);
  assert.deepEqual(box,{left:-228,top:-156,width:560,height:448,x:84,y:188,zoom:2});
 }
});
