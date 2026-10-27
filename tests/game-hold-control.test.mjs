import test from 'node:test';
import assert from 'node:assert/strict';
import {bindHoldControl} from '../game/engine/hold-control.mjs';

class Control extends EventTarget{dataset={};setPointerCapture(){};}
const send=(target,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);target.dispatchEvent(event);};
test('two fingers can move and punch independently; releasing movement does not stop a held punch',()=>{
 const blur=new EventTarget(),left=new Control(),punch=new Control(),events=[];
 const offLeft=bindHoldControl(left,value=>events.push(['left',value]),blur);
 const offPunch=bindHoldControl(punch,value=>events.push(['punch',value]),blur);
 send(left,'pointerdown',{pointerId:1,button:0});send(punch,'pointerdown',{pointerId:2,button:0});
 send(left,'pointerup',{pointerId:1});assert.equal(punch.dataset.held,'true');
 send(punch,'pointercancel',{pointerId:2});assert.deepEqual(events,[['left',true],['punch',true],['left',false],['punch',false]]);
 offLeft();offPunch();
});
test('lost capture, blur and disposal release input; keyboard repeat cannot duplicate a held action',()=>{
 const blur=new EventTarget(),button=new Control(),events=[],off=bindHoldControl(button,value=>events.push(value),blur);
 send(button,'pointerdown',{pointerId:3,button:0});send(button,'lostpointercapture',{pointerId:3});
 send(button,'keydown',{code:'Space'});send(button,'keydown',{code:'Space',repeat:true});send(blur,'blur');
 send(button,'pointerdown',{pointerId:4,button:0});off();
 assert.deepEqual(events,[true,false,true,false,true,false]);assert.equal(button.dataset.held,'false');
 send(button,'pointerdown',{pointerId:5,button:0});assert.equal(events.length,6);
});
