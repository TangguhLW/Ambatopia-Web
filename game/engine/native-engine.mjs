import {exportEditorWorld,SIMULATOR_IDS} from '../editor-format.mjs';
import {tileAt,avatarBox,isEditingTarget,isGameUiTarget} from './native-coordinates.mjs';
import {safePosition} from './safe-position.mjs';
import {bubbleDuration} from '../interactions.mjs';
import {bindHoldControl} from './hold-control.mjs';
import {avatarFrame} from './motion.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createNativeEngine(iframe,{worldName,profile,position,onTile,onChat,onDoor,onExitWorld,onRespawn,onMenuAction,onClothesChange,onReady,onError,getMode=()=> 'punch'}){
 let native,win,snapshot,players=[],disposed=false,loaded=false,god=false,avatarRealm,avatarNative,avatarScratch,avatarBusy=false,avatarKey='',peerCursor=0;
 const peers=new Map(),frames=new Map(),listeners=[],bubbles=new Map();let actionTimer,actionPointer;
 const layer=document.createElement('div');layer.className='remote-avatar-layer';
 const initial={...position};
 async function ready(frame,alive=()=>true){
   const started=Date.now();while(!disposed&&alive()&&Date.now()-started<90000){
   let w;try{w=frame.contentWindow;}catch{}
   const message=w?.document?.getElementById('account-save-status')?.textContent||'';
   if(/Simulator could not load|LOGIN_REQUIRED|SESSION_REVOKED|ACCOUNT_BANNED/.test(message))throw Error(message);
   if(w?.plannerReady&&w.AmbatopiaNative&&w.GW?.host&&w.GSAPI)return w;
   await wait(100);
  }if(disposed||!alive())return null;throw Error('The original simulator did not finish loading. Please retry.');
 }
 function applyWorld(){
  if(!native||!snapshot)return;
  if(!loaded){const spawn=safePosition(snapshot,snapshot.spawn),start=safePosition(snapshot,initial),world=exportEditorWorld(snapshot,worldName);world.spawn=[spawn.x,spawn.y];native.resetWorldEffects?.();win.GW.load(world);native.revive();win.GW.on=true;native.position(start);loaded=true;}
  else{win.GW.W.fg.set(snapshot.foreground.map(id=>SIMULATOR_IDS[id]));win.GW.W.bg.set(snapshot.background.map(id=>SIMULATOR_IDS[id]));win.GW.redraw();}
 }
 function listen(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
 function bindInput(){
  const stop=()=>{clearInterval(actionTimer);actionTimer=null;};listeners.push(stop);
  const facingTile=()=>({x:Math.max(0,Math.min(99,Math.floor(win.GW.P.x/32)+(native.act.face<0?-1:1))),y:Math.max(0,Math.min(58,Math.floor(win.GW.P.y/32)))});
  const fist=()=>{const act=()=>onTile({...facingTile(),action:'punch'});stop();act();actionTimer=setInterval(act,260);};
  native.fist=fist;native.stopFist=stop;
  const actKey=(event,pressed)=>{
   if(['Space','Enter'].includes(event.code)&&event.target.closest?.('.game-control'))return;
   if(pressed&&isGameUiTarget(event.target))return;
   if(event.code==='KeyF'||event.code==='KeyX'){if(pressed&&isEditingTarget(event.target))return;if(pressed&&!event.repeat)fist();else if(!pressed)stop();event.preventDefault();event.stopImmediatePropagation();return;}
   if(pressed&&isEditingTarget(event.target))return;
   const key={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyF:'punch'}[event.code];
   if(key){native.input[key]=pressed;event.preventDefault();event.stopImmediatePropagation();}
  };
  listen(window,'keydown',event=>actKey(event,true));listen(window,'keyup',event=>actKey(event,false));
  for(const type of ['keydown','keyup'])listen(win,type,event=>{if(['KeyA','KeyD','ArrowLeft','ArrowRight','Space','KeyF','KeyX','ArrowUp','KeyW'].includes(event.code))actKey(event,type==='keydown');},true);
  listen(window,'blur',()=>Object.assign(native.input,{left:false,right:false,jump:false,punch:false}));
  const focus=event=>{if(isGameUiTarget(event.target)){stop();Object.assign(native.input,{left:false,right:false,jump:false,punch:false});}};listen(window,'focusin',focus);listen(win,'focusin',focus);
  listen(window,'blur',stop);listen(win,'blur',stop);
  listen(win,'keydown',event=>{if(event.code==='Enter'&&!isGameUiTarget(event.target)){event.preventDefault();event.stopImmediatePropagation();onChat?.();}},true);
  listen(win.document.getElementById('gs-chatb'),'click',event=>{event.preventDefault();event.stopImmediatePropagation();onChat?.();},true);
  const pointer=event=>{
   if(win.document.getElementById('gs-menu')?.matches(':popover-open'))return;
   if(event.button!==0||event.target.closest?.('button,a,input,textarea,select,[role="button"],[role="checkbox"],#panel,#g2-rail,#g2-dock,#gs-bar,#gs-ex,.amb-online-ui'))return;
   const view=win.GW.view;if(!view||!loaded)return;const ratio=win.devicePixelRatio||1;
   const rect=win.document.getElementById('wt').getBoundingClientRect();
   const tile=tileAt({x:event.clientX,y:event.clientY},view,rect,ratio);
   if(tile.x<0||tile.x>=100||tile.y<0||tile.y>=59)return;
   event.preventDefault();event.stopImmediatePropagation();stop();actionPointer=event.pointerId;onTile(tile);if(getMode()==='punch')actionTimer=setInterval(()=>onTile({...tile,action:'punch'}),260);
  };
  listen(win,'pointerdown',pointer,true);
  for(const type of ['touchstart','touchmove'])listen(win,type,event=>{if(event.target.closest?.('#stage')){event.preventDefault();event.stopImmediatePropagation();}},{capture:true,passive:false});
  const releaseCanvas=event=>{if(event.pointerId===actionPointer){actionPointer=null;stop();}};
  for(const type of ['pointerup','pointercancel']){listen(win,type,releaseCanvas,true);listen(window,type,releaseCanvas,true);}
  // Every world mutation goes through the signed server RPC; native physics/rendering stays intact.
  for(const key of ['set','place','hit','use','emit','emitBg','fetchWorld','goWorld','exitWorld','newWorld']){const original=win.GW[key];win.GW[key]=()=>false;listeners.push(()=>{win.GW[key]=original;});}
  const protectName=()=>{const input=win.document.getElementById('pname');if(input){input.readOnly=true;input.value=profile.grow_id;input.setAttribute('aria-label','Grow ID (permanent)');}};protectName();
  listen(win.document,'input',event=>{if(event.target.id==='pname'){event.stopImmediatePropagation();protectName();native.name(profile.grow_id);}},true);
  const close=win.document.querySelector('button[aria-label="Close"]');close?.click();
  const hide=win.document.getElementById('gs-hide'),grab=win.document.getElementById('gs-grab');
  if(hide)listen(hide,'click',event=>{event.preventDefault();event.stopImmediatePropagation();const html=win.document.documentElement;html.classList.remove('amb-clothes-open');html.classList.add('amb-clothes-closed');iframe.parentElement.classList.remove('native-clothes');onClothesChange?.(false);win.dispatchEvent(new Event('resize'));},true);
  if(grab)listen(grab,'click',event=>{if(!win.matchMedia('(max-width:900px),(pointer:coarse)').matches)return;event.preventDefault();event.stopImmediatePropagation();const tall=win.document.documentElement.classList.toggle('amb-panel-tall');grab.setAttribute('aria-expanded',String(tall));},true);
  const menu=win.document.getElementById('gs-menu');
  if(menu){const exit=win.document.createElement('button');exit.id='amb-exit-world';exit.textContent='Exit World';menu.prepend(exit);listeners.push(()=>{menu.hidePopover?.();exit.remove();});listen(exit,'click',()=>{menu.hidePopover?.();onExitWorld?.();});
   listen(menu,'toggle',event=>iframe.parentElement.classList.toggle('native-menu-open',event.newState==='open'));
   for(const label of ['PNG / Video','Save Editor JSON','Import Editor JSON']){const item=win.document.createElement('button');item.textContent=label;menu.append(item);listeners.push(()=>item.remove());listen(item,'click',()=>{menu.hidePopover?.();onMenuAction?.(label);});}
   const respawn=win.document.getElementById('gs-m-die');if(respawn)listen(respawn,'click',event=>{event.preventDefault();event.stopImmediatePropagation();menu.hidePopover?.();onRespawn?.();},true);
  }
  for(const anchor of win.document.querySelectorAll('a[href]'))if(/^\/(set|world|edit)\//.test(new URL(anchor.href).pathname)){anchor.target='_blank';anchor.rel='noopener';}
 }
 const loading=ready(iframe).then(w=>{
  if(disposed)return;win=w;native=w.AmbatopiaNative;native.name(profile.grow_id);applyWorld();bindInput();
  const style=w.document.createElement('style');style.textContent='.remote-avatar-layer{position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden}.peer-avatar{position:absolute;image-rendering:pixelated}.peer-name{position:absolute;text-align:center;font-family:Arial;text-shadow:-1px -1px #000,1px -1px #000,-1px 1px #000,1px 1px #000;pointer-events:none}.player-bubble{position:absolute;max-width:min(220px,70vw);padding:8px 12px;border:2px solid #45667a;border-radius:9px;background:#fffffff0;color:#142f42;font:14px/1.35 Arial;overflow-wrap:anywhere;white-space:pre-wrap;transform:translate(-50%,-100%);box-shadow:0 2px 0 #142f4266}.player-bubble:after{content:"";position:absolute;left:50%;top:100%;border:6px solid transparent;border-top-color:#fff}';w.document.head.append(style);listeners.push(()=>style.remove());
  const stage=w.document.getElementById('stage')||w.document.body;stage.append(layer);onReady?.(w);
  const modalPanels=['gs-ex','g2-emo'].map(id=>w.document.getElementById(id)).filter(Boolean);
  if(modalPanels.length){const sync=()=>iframe.parentElement?.classList.toggle('native-modal',modalPanels.some(panel=>!panel.hidden));const observer=new MutationObserver(sync);for(const panel of modalPanels)observer.observe(panel,{attributes:true,attributeFilter:['hidden']});listeners.push(()=>observer.disconnect());sync();}
 }).catch(error=>{if(!disposed)onError(error);});
 function ensurePeers(){
  if(!win)return;const active=new Set(players.map(p=>p.user_id));
  for(const [id,peer] of peers)if(!active.has(id)){peer.canvas.remove();peer.name.remove();peers.delete(id);}
  if(players.length&&!avatarRealm){
   avatarRealm=document.createElement('iframe');avatarRealm.className='avatar-realm';avatarRealm.tabIndex=-1;avatarRealm.setAttribute('aria-hidden','true');avatarRealm.src='/set/?avatar=1';iframe.parentElement.append(avatarRealm);
   ready(avatarRealm).then(pw=>{if(!pw||disposed)return;avatarNative=pw.AmbatopiaNative;avatarNative.prepareAvatar();avatarNative.name('',false);avatarScratch=pw.document.createElement('canvas');avatarScratch.width=280;avatarScratch.height=224;}).catch(error=>{if(!disposed)onError(error);});
  }
  for(const player of players){
   if(peers.has(player.user_id))continue;
   const canvas=win.document.createElement('canvas');canvas.className='peer-avatar';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',player.grow_id);layer.append(canvas);
   canvas.width=280;canvas.height=224;
   const name=win.document.createElement('span');name.className='peer-name';name.textContent=player.grow_id;name.style.transform='translate(-50%,-100%)';layer.append(name);
   peers.set(player.user_id,{canvas,name,key:'',lastPaint:0,punchAt:-1000});
  }
 }
 async function paintPeers(jobs){
  avatarBusy=true;
  try{for(const {player,peer,key,pose} of jobs){
   if(disposed||!peers.has(player.user_id))continue;
   const appearance=JSON.stringify(player.appearance||{});
   const changed=appearance!==avatarKey;
   if(changed){await avatarNative.wear({outfit:[],skin:[240,190,140],hc:'',ec:'',lc:'',...player.appearance});avatarKey=appearance;}
   await avatarNative.renderAvatar(avatarScratch.getContext('2d'),pose);
   if(disposed)return;
   const frame=win.document.createElement('canvas');frame.width=280;frame.height=224;frame.getContext('2d').drawImage(avatarScratch,0,0);frames.set(key,frame);if(frames.size>160)frames.delete(frames.keys().next().value);
   if(peer.desired===key||!peer.key)paintFrame(peer,frame,key);
  }}catch(error){if(!disposed)onError(error);}finally{avatarBusy=false;}
 }
 function paintFrame(peer,frame,key){const ctx=peer.canvas.getContext('2d');ctx.clearRect(0,0,280,224);ctx.imageSmoothingEnabled=false;ctx.drawImage(frame,0,0);peer.key=key;peer.lastPaint=performance.now();}
 function drawPeers(now){
  if(!native||!loaded||disposed)return;native.syncOverlay?.();ensurePeers();const view=win.GW.view;if(!view)return;
  for(const [id,bubble] of bubbles){if(now>bubble.until){bubble.node.remove();bubbles.delete(id);continue;}const p=id===profile.id?{x:win.GW.P.x/32,y:win.GW.P.y/32}:players.find(p=>p.user_id===id);if(!p){bubble.node.hidden=true;continue;}bubble.node.hidden=false;const box=avatarBox(p,view,native.geometry,win.devicePixelRatio||1),stage=layer.getBoundingClientRect(),width=bubble.node.offsetWidth;const x=Math.max(width/2+6,Math.min(stage.width-width/2-6,box.x));bubble.node.style.left=x+'px';bubble.node.style.top=Math.max(bubble.node.offsetHeight+8,box.y-52*view.k/(win.devicePixelRatio||1))+'px';}
  const jobs=[],stageBounds=layer.getBoundingClientRect();
  for(let i=0;i<players.length;i++){
   const player=players[(i+peerCursor)%players.length];
   const peer=peers.get(player.user_id);if(!peer)continue;
   const box=avatarBox(player,view,avatarNative?.geometry,win.devicePixelRatio||1);
   Object.assign(peer.canvas.style,{left:'0',top:'0',transform:'translate3d('+Math.round(box.left)+'px,'+Math.round(box.top)+'px,0)',width:box.width+'px',height:box.height+'px'});
   Object.assign(peer.name.style,{left:Math.round(box.x)+'px',top:Math.round(box.y-38*box.zoom)+'px',fontSize:Math.max(11,7*box.zoom)+'px'});
   const visible=box.x>-100&&box.x<stageBounds.width+100&&box.y>-100&&box.y<stageBounds.height+150;
   peer.canvas.hidden=peer.name.hidden=!visible;
   const {key,pose}=avatarFrame(player,now,peer.punchAt);peer.desired=key;
   if(!visible||peer.key===key)continue;
   if(frames.has(key)){paintFrame(peer,frames.get(key),key);continue;}
   if(!avatarNative||avatarBusy||jobs.length>=2)continue;
   jobs.push({player,peer,key,pose});
  }
  if(jobs.length){peerCursor=(peerCursor+2)%players.length;paintPeers(jobs);}
 }
 return {
  ready:loading,get native(){return native;},get window(){return win;},
  chat(message){let bubble=bubbles.get(message.user_id);if(!bubble){const node=document.createElement('div');node.className='player-bubble';node.setAttribute('role','status');layer.append(node);bubble={node};bubbles.set(message.user_id,bubble);}bubble.node.textContent=message.text;bubble.until=performance.now()+bubbleDuration(message.text);},
  punch(tile){return native?.punch(tile);},impact(tile,kind){native?.impact(tile,kind);},remotePunch(id,tile){if(id!==profile.id){const peer=peers.get(id);if(peer){peer.punchAt=performance.now();peer.lastPaint=0;}}},
  bindPunch(button){listeners.push(bindHoldControl(button,held=>{if(held)native?.fist?.();else native?.stopFist?.();}));},
  toggleClothes(){if(!win)return false;const touch=win.matchMedia('(max-width:900px),(pointer:coarse)').matches,html=win.document.documentElement;const open=touch?html.classList.toggle('amb-clothes-open'):!html.classList.toggle('amb-clothes-closed');iframe.parentElement.classList.toggle('native-clothes',open);win.dispatchEvent(new Event('resize'));return open;},
  setWorld(value,redraw=true){snapshot=value;if(redraw)applyWorld();},setPlayers(value){players=value.filter(p=>p.user_id!==profile.id);},setLocks(){},setPreview(){},
  applyTile(edits){for(const e of edits){const changed=snapshot[e.layer][e.y*100+e.x]!==e.id;snapshot[e.layer][e.y*100+e.x]=e.id;if(loaded){win.GW.W[e.layer==='foreground'?'fg':'bg'][e.y*100+e.x]=SIMULATOR_IDS[e.id];if(changed)native.impact(e,e.id?'place':'break');}}if(loaded)win.GW.redraw();},
  readPlayer(){if(!native||!loaded)return null;win.GSOPT.god=god;return {x:Math.max(0,Math.min(99,win.GW.P.x/32)),y:Math.max(0,Math.min(59,win.GW.P.y/32)),vx:native.act.vx/32,vy:-native.act.vy/32,facing:native.act.face<0?'left':'right',onGround:!native.act.air,dying:!!win.GW.dying};},
  setPosition(value){if(native&&loaded){native.revive();native.position(value);}else Object.assign(initial,value);},setGod(value){god=!!value;if(win)win.GSOPT.god=god;},
  atSpawn(){if(!loaded)return false;const p=win.GW.P,s=snapshot.spawn;return Math.abs(p.x/32-s.x-6/32)<.5&&Math.abs(p.y/32-s.y-2/32)<.5;},
  draw(_local){drawPeers(performance.now());},appearance(){return native?.appearance();},wear(value){native?.wear(value);},
  icon(id,canvas){if(!native)return;const item=win.GW.item(SIMULATOR_IDS[id]);if(!item)return;const cell=win.GW.iconCell(item);const image=new Image();image.src='/set/atlas/'+item.sheet+'.png';image.onload=()=>{const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,cell[0]*32,cell[1]*32,32,32,0,0,28,28);};},
  openExport(){win?.document.getElementById('gs-exb')?.click();},
  openEmotes(){win?.document.getElementById('g2-emob')?.click();},
  bind(button,field,value){const key=field==='axis'?(value<0?'left':'right'):field;listeners.push(bindHoldControl(button,held=>{if(native)native.input[key]=held;}));},
  dispose(){disposed=true;listeners.forEach(fn=>fn());if(native){Object.assign(native.input,{left:false,right:false,jump:false,punch:false});native.revive();win.GW.on=false;win.document.documentElement.classList.remove('amb-clothes-open');win.document.documentElement.classList.add('amb-clothes-closed');const panel=win.document.getElementById('gs-ex');if(panel)panel.hidden=true;}avatarRealm?.remove();for(const peer of peers.values()){peer.canvas.remove();peer.name.remove();}peers.clear();frames.clear();layer.remove();}
 };
}
