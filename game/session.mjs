export function createSession({request,broadcast=()=>{},lock=job=>job()}) {
 let current=null,pending=null,generation=0;const listeners=new Set();
 const notify=()=>listeners.forEach(fn=>fn(current?.profile||null));
 function accept(result){current=result;notify();}
 return {
  get profile(){return current?.profile||null;},
  async getAccessToken(){
   if(current?.expiresAt>Date.now()/1000+60)return current.accessToken;
   if(!pending){const version=generation;pending=lock(async()=>{
    try{const result=await request('session');if(version!==generation)return null;accept(result);return result.accessToken;}
    catch{if(version===generation){current=null;notify();}return null;}
   }).finally(()=>{pending=null;});}
   return pending;
  },
  async authenticate(action,input){generation++;return lock(async()=>{const result=await request(action,input);accept(result);broadcast({type:'account-changed'});return result.profile;});},
  async signOut(){generation++;current=null;notify();broadcast({type:'signed-out'});await lock(()=>request('logout'));},
  receive(message){if(['signed-out','account-changed'].includes(message?.type)){generation++;current=null;notify();}},
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
 };
}
export async function accountRequest(action,input={}) {
 const response=await fetch('/api/account',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...input})});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||data.code||'Account unavailable'),{code:data.code});return data;
}
let singleton;
export function browserSession() {
 if(singleton)return singleton;
 const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('growtopia-account'):null;
 singleton=createSession({request:accountRequest,broadcast:value=>channel?.postMessage(value),lock:job=>navigator.locks?navigator.locks.request('growtopia-refresh',job):job()});
 if(channel)channel.onmessage=event=>singleton.receive(event.data);
 return singleton;
}
