import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../game/session.mjs';
test('parallel refresh shares one request and tokens remain in memory',async()=>{
 let calls=0;const messages=[];
 const s=createSession({request:async()=>{calls++;return {accessToken:'ACCESS',expiresAt:Date.now()/1000+1000,profile:{grow_id:'PlayerOne'}};},broadcast:v=>messages.push(v)});
 assert.deepEqual(await Promise.all([s.getAccessToken(),s.getAccessToken()]),['ACCESS','ACCESS']);assert.equal(calls,1);
 assert.ok(messages.every(v=>!JSON.stringify(v).includes('ACCESS')));
});
test('a pending refresh cannot undo logout',async()=>{
 let release;const s=createSession({request:async action=>action==='logout'?{}:await new Promise(r=>release=r)});
 const pending=s.getAccessToken();await new Promise(r=>setImmediate(r));await s.signOut();
 release({accessToken:'OLD',expiresAt:Date.now()/1000+1000,profile:{grow_id:'PlayerOne'}});
 assert.equal(await pending,null);assert.equal(s.profile,null);
});
test('login and logout serialize cookie responses through the refresh lock',async()=>{
 const events=[];let tail=Promise.resolve();
 const lock=job=>{const next=tail.then(job);tail=next.catch(()=>{});return next;};
 let release;const s=createSession({lock,request:async action=>{events.push(action);if(action==='session')await new Promise(r=>release=r);return {accessToken:'TOKEN',expiresAt:0,profile:{grow_id:'PlayerOne'}};}});
 const refreshing=s.getAccessToken();await new Promise(r=>setImmediate(r));
 const login=s.authenticate('login',{});await new Promise(r=>setImmediate(r));
 assert.deepEqual(events,['session']);release();await Promise.all([refreshing,login]);
 await s.signOut();assert.deepEqual(events,['session','login','logout']);
});
