import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditingTarget} from '../game/engine/native-coordinates.mjs';
test('editing fields own their keystrokes',()=>{
 for(const tagName of ['INPUT','TEXTAREA','SELECT'])assert.equal(isEditingTarget({tagName}),true);
 assert.equal(isEditingTarget({tagName:'DIV',isContentEditable:true}),true);
 assert.equal(isEditingTarget({tagName:'CANVAS'}),false);
});
