import test from 'node:test';import assert from 'node:assert/strict';
import {chatSnap,bindChatSheet} from '../game/chat-sheet.mjs';
test('chat sheet opens downward and closes upward while taps and small jitter preserve state',()=>{
 assert.equal(chatSnap(false,45),true);assert.equal(chatSnap(true,-45),false);assert.equal(chatSnap(false,7),false);assert.equal(chatSnap(true,-8),true);assert.equal(chatSnap(true,100),true);assert.equal(chatSnap(false,-100),false);
});
test('a previous drag timer cannot let the next drag toggle twice',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const previous=globalThis.innerHeight;globalThis.innerHeight=800;
 const handle=new EventTarget();handle.setPointerCapture=()=>{};
 const chat=new EventTarget();chat.open=false;chat.querySelector=()=>handle;chat.getBoundingClientRect=()=>({height:250});chat.classList={add(){},remove(){}};
 const properties=new Map();chat.style={setProperty:(key,value)=>properties.set(key,value),getPropertyValue:key=>properties.get(key)||''};
 const off=bindChatSheet(chat),send=(type,y)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,button:0,clientY:y});handle.dispatchEvent(event);return event;};
 try{
  send('pointerdown',100);send('pointermove',150);send('pointerup',150);assert.equal(send('click',150).defaultPrevented,true);
  t.mock.timers.tick(100);send('pointerdown',100);send('pointermove',50);
  t.mock.timers.tick(150);send('pointerup',50);
  assert.equal(chat.open,false);assert.equal(send('click',50).defaultPrevented,true);
 }finally{off();if(previous===undefined)delete globalThis.innerHeight;else globalThis.innerHeight=previous;}
});
