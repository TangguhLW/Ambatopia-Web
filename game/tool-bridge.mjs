import {browserSession} from './session.mjs';
import {createGameApi} from './api.mjs';
import {createAutosave} from './autosave.mjs';
import {collectSnapshot,restoreSnapshot} from '../cloud/state.mjs';
import {installDiscordGuard} from './remove-discord.mjs';
import {installAudio} from './audio.mjs';
import {installNativeLayout} from './tool-layout.mjs';
import {createFrameLoop} from './engine/frame-loop.mjs';

const avatar=new URLSearchParams(location.search).has('avatar')&&window.parent!==window&&window.parent.location.origin===location.origin;
const online=new URLSearchParams(location.search).has('online')&&window.parent!==window&&window.parent.location.origin===location.origin;
if(avatar||online){
 if(avatar)window.requestAnimationFrame=()=>0;
 if(online&&new URLSearchParams(location.search).has('warm')){const loop=createFrameLoop(window.requestAnimationFrame.bind(window),window.cancelAnimationFrame.bind(window),window.frameElement.dataset.engineActive!=='1');window.AmbatopiaFrameLoop=loop;window.requestAnimationFrame=loop.request;window.cancelAnimationFrame=loop.cancel;}
 const entries=new Map();
 Object.defineProperty(window,'localStorage',{value:{getItem:key=>entries.get(String(key))??null,setItem:(key,value)=>entries.set(String(key),String(value)),removeItem:key=>entries.delete(String(key)),clear:()=>entries.clear(),key:index=>[...entries.keys()][index]??null,get length(){return entries.size;}}});
 if(online){installDiscordGuard();installAudio({menuMusic:false});installNativeLayout();}
 await loadEngine();
}else await accountTool();

async function loadEngine(){
 // The pinned upstream newsletter contains Discord promotion; Ambatopia has its own About screen.
 localStorage.setItem('gs_gazette','2026-10-14');
 const engine=document.querySelector('script[data-game-src]');if(!engine)throw Error('Simulator bootstrap missing');
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=engine.dataset.gameSrc;script.onload=resolve;script.onerror=()=>reject(Error('Simulator could not load. Reload to try again.'));document.body.append(script);});
}
async function accountTool(){
const session=browserSession(),api=createGameApi(session);
const banner=document.createElement('div');banner.id='account-save-status';banner.role='status';banner.textContent='Loading your saved data…';
banner.style.cssText='position:fixed;bottom:8px;right:8px;z-index:2147483647;background:#14354c;color:#f5e18b;border:1px solid #8ccee5;padding:8px 12px;border-radius:4px;font:12px Arial;max-width:calc(100vw - 16px)';document.body.append(banner);
installDiscordGuard();
installNativeLayout();
installAudio({menuMusic:false});document.title='Ambatopia · '+({set:'Set Designer',world:'Simulator',edit:'Edit World'}[location.pathname.split('/')[1]]||'Creative');
for(const icon of document.querySelectorAll('link[rel~="icon"]'))icon.remove();const favicon=document.createElement('link');favicon.rel='icon';favicon.href='/brand/ambatopia-logo.png';document.head.append(favicon);
let saver,active=true,timer;
session.subscribe(profile=>{if(!profile&&saver){active=false;saver.stop();clearInterval(timer);location.replace('/?login=1');}});
try {
 const access=await session.getAccessToken();if(!access)throw Error('LOGIN_REQUIRED');
 const profile=await api.rpc('game_me');
 const {data,error}=await api.client.from('app_snapshots').select('payload,updated_at').eq('user_id',profile.id).maybeSingle();if(error)throw error;
 const owner=localStorage.getItem('growtopia-online:active-player');
 if(data)restoreSnapshot(localStorage,data.payload);
 else if(owner!==profile.id)restoreSnapshot(localStorage,{version:1,storage:{}});
 localStorage.setItem('growtopia-online:active-player',profile.id);
 const label=profile.grow_id+' · ';
 saver=createAutosave({collect:()=>collectSnapshot(localStorage),persist:async payload=>{
  if(!active||session.profile?.id!==profile.id)throw Error('Account changed');
  const {error}=await api.client.from('app_snapshots').upsert({user_id:profile.id,payload,updated_at:new Date().toISOString()});if(error)throw error;
 },status:value=>{banner.textContent=label+(value.state==='saving'?'Saving…':value.state==='saved'?'Last saved '+new Date(value.at).toLocaleTimeString():value.message);}});
 await loadEngine();
 if(location.pathname!=='/edit/'){const started=Date.now();const nativeReady=setInterval(()=>{if(Date.now()-started>120000){clearInterval(nativeReady);return;}if(!window.AmbatopiaNative)return;clearInterval(nativeReady);window.AmbatopiaNative.name(profile.grow_id);if(profile.appearance?.outfit)window.AmbatopiaNative.wear(profile.appearance);},100);}
 const brand=()=>{const logo=document.querySelector('#gs-bar .gs-brand');if(!logo||logo.dataset.ambatopia)return;logo.dataset.ambatopia='1';logo.innerHTML='<img src="/brand/ambatopia-logo.png" alt="" width="28" height="28" style="border-radius:5px"><span>Ambatopia</span>';};
 brand();new MutationObserver(brand).observe(document.body,{childList:true,subtree:true});
 banner.textContent=label+'Autosave enabled';
 timer=setInterval(()=>saver.flush(),2000);setInterval(()=>{if(active&&!document.hidden)api.rpc('game_touch').catch(()=>{});},20000);window.addEventListener('pagehide',()=>{saver.flush();});
 // The simulator name is only a preview; online identity always comes from game_me.
 const protectName=()=>{for(const node of document.querySelectorAll('input'))if(profile.role!=='superadmin'&&(/(?:player.?name|char.?name|grow.?id)/i.test(node.id+' '+node.name)||node.id==='pname')){if(node.value!==profile.grow_id){node.value=profile.grow_id;node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}node.readOnly=true;node.setAttribute('aria-label','Grow ID (permanent)');}};
 protectName();new MutationObserver(protectName).observe(document.body,{childList:true,subtree:true});
}catch(error){banner.textContent=error.message;if(/LOGIN_REQUIRED|SESSION_REVOKED|ACCOUNT_BANNED/.test(error.message))location.replace('/?login=1');}
}
