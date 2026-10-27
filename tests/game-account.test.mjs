import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAccount} from '../game/account-server.mjs';

const origin='https://game.example';
const post=(data,headers={})=>new Request(origin+'/api/account',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(data)});
test('accounts reject CSRF, extra role, reserved name and oversized body before provisioning',async()=>{
  let calls=0;const deps={origin,rate:async()=>{calls++;return true;}};
  for(const req of [post({action:'signup',growId:'Player1',password:'test-password',role:'superadmin'}),post({action:'signup',growId:'Thaney',password:'test-password'}),post({action:'login',growId:'Player1',password:'test-password'},{origin:'https://evil.example'}),post({action:'login',growId:'a'.repeat(5000)})]){
    const res=await handleAccount(req,deps);assert.ok(res.status>=400&&res.status<500);
  }
  assert.equal(calls,0);
});
test('signup sets HttpOnly cookies and does not expose refresh token',async()=>{
  const session={access_token:'ACCESS',refresh_token:'PRIVATE-REFRESH',expires_at:99999};
  const deps={origin,rate:async()=>true,signup:async(growId)=>({profile:{id:'id',grow_id:growId,role:'player'},session})};
  const res=await handleAccount(post({action:'signup',growId:'Player1',password:'test-password'}),deps);
  assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/HttpOnly/);assert.match(res.headers.get('set-cookie'),/Secure/);
  assert.match(res.headers.get('cache-control'),/no-store/);
  const text=await res.text();assert.ok(!text.includes('PRIVATE-REFRESH'));assert.equal(JSON.parse(text).accessToken,'ACCESS');
});
test('login failure is generic and rate limited; logout expires both cookies',async()=>{
  for(const error of ['User not found','Password invalid']){
    const res=await handleAccount(post({action:'login',growId:'Player1',password:'test-password'}),{origin,rate:async()=>true,login:async()=>{throw Error(error);}});
    assert.equal(res.status,401);assert.equal((await res.json()).code,'INVALID_CREDENTIALS');
  }
  const limited=await handleAccount(post({action:'login',growId:'Player1',password:'test-password'}),{origin,rate:async()=>false});assert.equal(limited.status,429);
  const logout=await handleAccount(post({action:'logout'}),{origin,logout:async()=>{}});
  assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
