import {h,button,statusNode,busy,dateText} from '../dom.mjs';
import {CATALOG,ITEMS} from '../catalog.mjs';
import {createNativeEngine} from '../engine/native-engine.mjs';
import {connectWorld} from '../realtime.mjs';
import {importEditorWorld,exportEditorWorld} from '../editor-format.mjs';
import {playerIntent,atWhiteDoor} from '../interactions.mjs';
import {createMotionTrack} from '../engine/motion.mjs';
import {iconButton,iconMarkup} from '../ui-icons.mjs';
import {bindChatSheet} from '../chat-sheet.mjs';

export function renderPlay(root,ctx,{state:initial}) {
 let state=initial,disposed=false,selected=0,mode='punch',connection,sequence=0,movePending=0,lastSent='',lastSubmit=0,frameId,previous=performance.now(),editing=false,syncSelf=false,appliedVersion=initial.world.version;
 const me=ctx.session.profile;let local={...initial.players.find(p=>p.user_id===me.id),user_id:me.id,grow_id:me.grow_id,role:me.role,appearance:me.appearance,god_mode:me.god_mode,vx:0,vy:0,onGround:false};
 local.x??=initial.snapshot.spawn.x;local.y??=initial.snapshot.spawn.y;
 const remote=new Map(),chatIds=new Set(),announcedLocks=new Set(),dialogs=new Set(),status=statusNode(),online=h('small',{},'Connecting…'),count=h('small',{}),iframe=ctx.enginePool?ctx.enginePool.acquire(me.id):h('iframe',{class:'native-simulator',title:'Ambatopia · original Set Designer engine',src:'/set/?online=1'});
 const loading=h('div',{class:'native-loading',role:'status'},'Loading the original Set Designer…');
 let appearanceKey='',appearancePending=false,lastAppearance=0,respawning=false,respawnSequence=-1,exiting=false;
 const renderer=createNativeEngine(iframe,{worldName:state.world.name,profile:me,position:local,getMode:()=>mode,onDoor(){if(atWhiteDoor(state.snapshot,local)){leaveWorld().catch(failure);return true;}return false;},onExitWorld:()=>leaveWorld().catch(failure),onRespawn:()=>doRespawn().catch(failure),onMenuAction:label=>({"PNG / Video":png,"Save Editor JSON":json,"Import Editor JSON":importButton}[label]?.click()),onClothesChange:open=>clothes.setAttribute('aria-expanded',String(open)),onTile:handleTile,onChat(){view.querySelector('.online-chat').open=true;chatInput.focus();},onError:failure,onReady(){loading.remove();syncClothesState();renderer.setGod(local.god_mode);if(me.appearance?.outfit)renderer.wear(me.appearance);for(const pick of hotbar.children)renderer.icon(Number(pick.dataset.item),pick.querySelector('canvas'));}});renderer.setWorld(state.snapshot);
 const log=h('div',{class:'chat-log',role:'log','aria-live':'polite','aria-label':'World chat'}),chatInput=h('input',{name:'chat',maxlength:240,placeholder:'Say something…','aria-label':'Chat message',autocomplete:'off'}),send=h('button',{type:'submit'},'Send');
 const chatForm=h('form',{},chatInput,send),chatStatus=statusNode();
 chatForm.addEventListener('submit',event=>{event.preventDefault();const text=chatInput.value.trim();if(!text)return;busy(send,async()=>{const id=await ctx.api.rpc('game_chat',{p_world:state.world.id,p_text:text,p_request_id:crypto.randomUUID()});if(disposed)return;appendChat({id,user_id:me.id,grow_id:me.grow_id,text,created_at:new Date().toISOString()},true);if(chatInput.value.trim()===text){chatInput.value='';view.querySelector('.online-chat').open=false;root.focus({preventScroll:true});}chatStatus.textContent='';},chatStatus);});
 const hotbar=h('div',{class:'hotbar',role:'toolbar','aria-label':'Creative inventory'});
 for(const item of CATALOG.filter(item=>item.id&&!item.unbreakable)){
  const pick=button('',()=>{selected=item.id;mode='build';drawSelection();if(matchMedia('(max-width:900px),(pointer:coarse)').matches)hotbar.hidden=true;});pick.title=item.name;pick.setAttribute('aria-label',item.name);
  const chip=h('canvas',{class:'item-chip',width:28,height:28,'aria-hidden':'true'});
  pick.dataset.lock=String(!!item.lock);
  pick.append(chip,item.name);pick.dataset.item=item.id;hotbar.append(pick);
 }
 const breakButton=button('Punch',()=>{mode='punch';selected=0;hotbar.hidden=true;drawSelection();}),wrench=button('Wrench / Locks',()=>showLocks());
 const png=button('PNG / Video',()=>renderer.openExport());
 const emotes=button('Emotes',()=>renderer.openEmotes());
 const json=button('Save Editor JSON',()=>download(new Blob([JSON.stringify(exportEditorWorld(state.snapshot,state.world.name))],{type:'application/json'}),state.world.name+'.json'));
 const importFile=h('input',{type:'file',accept:'.json,application/json',hidden:true,'aria-label':'Import Editor world JSON'});
 const importButton=button('Import Editor JSON',()=>importFile.click());
 importFile.addEventListener('change',()=>busy(importButton,async()=>{
  const file=importFile.files[0];if(!file)return;if(file.size>10485760)throw Error('World exceeds 10 MiB');
  const snapshot=importEditorWorld(await file.text());
  for(const lock of state.locks||[])snapshot.foreground[lock.y*100+lock.x]=CATALOG.find(item=>item.lock===lock.kind).id;
  const dialog=makeDialog('Publish imported world'),feedback=statusNode();
  dialog.append(h('p',{},'Replace the tiles in '+state.world.name+' with '+file.name+'? Existing ownership locks stay in place. Only the world owner or developer can publish.'),feedback);
  const confirm=button('Publish and save',()=>busy(confirm,async()=>{const result=await ctx.api.rpc('game_publish',{p_world:state.world.id,p_snapshot:snapshot,p_expected_version:state.world.version,p_request_id:crypto.randomUUID()});state.world.version=result.version;close(dialog);await connection?.resync();status.textContent='World published · '+dateText(result.saved_at);},feedback),'primary');dialog.append(confirm);dialog.showModal();importFile.value='';
 },status));
 async function leaveWorld(){if(exiting||disposed)return;exiting=true;try{await ctx.api.rpc('game_leave',{p_world:state.world.id});if(!disposed)ctx.start();}catch(error){exiting=false;throw error;}}
 for(const control of [png,json,importButton])control.classList.add('secondary-action');
 const exit=button('Exit World',()=>busy(exit,leaveWorld,status),'quiet');
 function showInventory(kind){if(view.classList.contains('native-clothes')){renderer.toggleClothes();clothes.setAttribute('aria-expanded','false');}hotbar.hidden=!hotbar.hidden&&hotbar.dataset.category===kind;hotbar.dataset.category=kind;for(const pick of hotbar.children)pick.hidden=(pick.dataset.lock==='true')!==(kind==='locks');inventory.setAttribute('aria-expanded',String(!hotbar.hidden&&kind==='blocks'));locks.setAttribute('aria-expanded',String(!hotbar.hidden&&kind==='locks'));}
 const clothes=button('Clothes',()=>{const open=renderer.toggleClothes();clothes.setAttribute('aria-expanded',String(open));hotbar.hidden=true;}),inventory=button('Blocks & Locks',()=>showInventory('blocks')),respawn=button('Respawn',()=>busy(respawn,doRespawn,status));
 const locks=button('',()=>showInventory('locks'));
 wrench.textContent='Wrench';wrench.setAttribute('aria-label','Wrench / Locks');
 const moreItems=h('div',{class:'world-more-items'},emotes,png,json,importButton,importFile,respawn,exit),more=h('details',{class:'world-more'},h('summary',{},'More'),moreItems),actions=h('div',{class:'online-actions','aria-label':'World tools'},clothes,inventory,locks,breakButton,wrench,more);hotbar.className='native-inventory';hotbar.hidden=true;
 for(const [node,name,label] of [[clothes,'clothes','Clothes'],[inventory,'block','Blocks'],[locks,'lock','Locks'],[breakButton,'punch','Punch'],[wrench,'wrench','Wrench / Locks'],[more.querySelector('summary'),'more','More tools']])iconButton(node,name,label);
 const syncInventory=()=>{inventory.setAttribute('aria-expanded',String(!hotbar.hidden&&hotbar.dataset.category==='blocks'));locks.setAttribute('aria-expanded',String(!hotbar.hidden&&hotbar.dataset.category==='locks'));};
 const inventoryObserver=new MutationObserver(syncInventory);inventoryObserver.observe(hotbar,{attributes:true,attributeFilter:['hidden','data-category']});syncInventory();
 for(const [node,name,label] of [[emotes,'emote','Emotes'],[png,'export','PNG / Video'],[json,'save','Save Editor JSON'],[importButton,'import','Import Editor JSON'],[respawn,'respawn','Respawn'],[exit,'exit','Exit World']]){iconButton(node,name,label);node.append(h('span',{},label));}
 iconButton(send,'send','Send message');
 moreItems.addEventListener('click',event=>{if(event.target.closest('button'))more.open=false;});
 if(me.role==='superadmin'){
  const god=button(local.god_mode?'God Mode: ON':'God Mode: OFF',()=>busy(god,async()=>{
   const enabled=!local.god_mode;await ctx.api.rpc('game_admin_action',{p_action:'god_mode',p_target:me.id,p_payload:{enabled},p_request_id:crypto.randomUUID()});local.god_mode=enabled;renderer.setGod(enabled);god.textContent=enabled?'God Mode: ON':'God Mode: OFF';status.textContent='Developer capability saved.';
  },status));moreItems.append(god,button('Developer',()=>{ctx.api.rpc('game_leave',{p_world:state.world.id}).catch(()=>{});ctx.navigate('developer');}));
 }
 const control=(label,icon)=>{const node=button('',()=>{});node.setAttribute('aria-label',label);node.append(h('img',{src:'/set/atlas/ui/'+icon+'.png',alt:'',draggable:'false','aria-hidden':'true'}));node.className='game-control '+icon;return node;};
 const left=control('Move left','left_arrow'),right=control('Move right','right_arrow'),jump=control('Jump','jump_icon'),fist=control('Punch facing block','punch_icon');
 fist.setAttribute('aria-label','Punch facing block');
 left.setAttribute('aria-label','Move left');right.setAttribute('aria-label','Move right');
 const controls=h('div',{class:'mobile-controls',role:'group','aria-label':'Movement and punch'},h('div',{},left,right),h('div',{},jump,fist));
 const view=ctx.enginePool?iframe.parentElement:h('section',{class:'native-play'},iframe);view.className='native-play'+(ctx.enginePool?' engine-runtime':'');
 view.append(h('div',{class:'online-hud'},h('div',{class:'online-topline'},h('strong',{},state.world.name),online,count,status),h('details',{class:'online-chat'},h('summary',{},'World chat'),log,chatForm,chatStatus)),hotbar,controls,actions,loading);
 const chat=view.querySelector('.online-chat'),handle=chat.querySelector('summary');handle.innerHTML=iconMarkup('chat')+'<span>World Chat</span><i aria-hidden="true"></i>';handle.title='Drag down to open · Drag up to close';const disposeChat=bindChatSheet(chat);
 if(ctx.enginePool)root.replaceChildren();else root.replaceChildren(view);status.textContent='Last saved · '+dateText(state.world.updated_at);drawSelection();
 function syncClothesState(){const w=renderer.window;if(!w)return;const open=w.getComputedStyle(w.document.getElementById('panel')).display!=='none';view.classList.toggle('native-clothes',open);clothes.setAttribute('aria-expanded',String(open));}
 window.addEventListener('resize',syncClothesState);
 renderer.bind(left,'axis',-1);renderer.bind(right,'axis',1);renderer.bind(jump,'jump',true);renderer.bindPunch(fist);
 function drawSelection(){for(const pick of hotbar.children)pick.setAttribute('aria-pressed',String(mode==='build'&&Number(pick.dataset.item)===selected));breakButton.setAttribute('aria-pressed',String(mode==='punch'));inventory.setAttribute('aria-pressed',String(mode==='build'&&!ITEMS.get(selected)?.lock));locks.setAttribute('aria-pressed',String(mode==='build'&&!!ITEMS.get(selected)?.lock));inventory.title='Blocks';locks.title='Locks';}
 function onState(value){
  state=value;renderer.setWorld(value.snapshot,value.world.version!==appliedVersion);appliedVersion=value.world.version;renderer.setLocks(value.locks||[]);
  const ids=new Set(value.players.map(p=>p.user_id));for(const id of remote.keys())if(!ids.has(id))remote.delete(id);
  for(const player of value.players){if(player.user_id===me.id){sequence=Math.max(sequence,Number(player.sequence)||0);if(syncSelf){Object.assign(local,player,{vx:0,vy:0});renderer.setPosition(local);syncSelf=false;}}else{const old=remote.get(player.user_id),track=old?.track??createMotionTrack(player,performance.now());track.push(player,performance.now());remote.set(player.user_id,{...player,...(old&&old.sequence>player.sequence?{x:old.x,y:old.y,sequence:old.sequence,facing:old.facing,animation:old.animation}:{}),track});}}
  for(const message of value.chat||[])appendChat(message);count.textContent=value.players.length+' online';
 }
 function appendChat(message,live=false){if(chatIds.has(message.id))return;chatIds.add(message.id);if(live)renderer.chat(message);log.append(h('p',{},h('strong',{},message.grow_id+': '),message.text));while(log.children.length>50)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
 function onEvent(event){
  if(event.kind==='motion'){let unknown=false;for(const move of event.payload.players||[]){if(move.user_id===me.id)continue;const p=remote.get(move.user_id);if(p&&move.sequence>p.sequence){p.track.push(move,performance.now());Object.assign(p,move);}else if(!p)unknown=true;}if(unknown)connection?.roster();}
  else if(event.kind==='stream-version'){if(event.payload.caughtUp&&event.payload.version>state.world.version)connection?.resync();}
  else if(event.kind==='roster'){if(event.payload.version!==state.world.version){connection?.resync();return;}onState({...state,players:event.payload.players,chat:[]});}
  else if(event.kind==='join'||event.kind==='leave'){connection?.roster();}
  else if(event.kind==='move'){const p=remote.get(event.payload.user_id);if(p&&event.payload.sequence>p.sequence)Object.assign(p,event.payload);}
  else if(event.kind==='chat')appendChat(event.payload,true);
  else if(event.kind==='lock'){applyLock(event.payload);connection?.resync();}
  else if(event.kind==='punch'){if(event.payload.user_id!==me.id){renderer.remotePunch(event.payload.user_id,event.payload);if(event.payload.item!==0&&event.payload.tile_id!==0&&!event.payload.edits?.length)renderer.impact(event.payload,'hit');}}
  else if(event.kind==='edit'){if(event.version>state.world.version){renderer.applyTile(event.payload.edits);state.world.version=event.version;appliedVersion=event.version;}status.textContent='Saved · '+dateText(event.created_at);}
  else if(event.kind==='appearance'){const p=event.payload.user_id===me.id?local:remote.get(event.payload.user_id);if(p)p.appearance=event.payload.appearance;}
  else connection?.resync();
 }
 function failure(error){if(disposed)return;status.textContent=error.message;status.classList.add('error');if(!renderer.native&&loading.isConnected)loading.replaceChildren(h('p',{},error.message),button('Try again',()=>ctx.enterWorld(state.world.id).catch(failure)),button('World menu',()=>ctx.api.rpc('game_leave',{p_world:state.world.id}).finally(()=>ctx.start())));if(/fetch|network|timeout|connection/i.test(error.message))online.textContent='Connection interrupted';if(/ACCOUNT_BANNED|SESSION_REVOKED|LOGIN_REQUIRED/.test(error.message)){connection?.dispose();ctx.session.signOut().catch(()=>{});}}
 async function doRespawn(){if(respawning||disposed)return;respawning=true;try{const result=await ctx.api.rpc('game_respawn',{p_world:state.world.id,p_sequence:sequence,p_request_id:crypto.randomUUID()});if(disposed)return;sequence=Math.max(sequence,result.sequence);respawnSequence=sequence;Object.assign(local,result,{vx:0,vy:0});renderer.setPosition(result);lastSent='';syncSelf=false;status.classList.remove('error');status.textContent='Respawned at the White Door';}finally{respawning=false;}}
 connectWorld(ctx.api,state.world.id,{onState,onEvent,onConnection:text=>{if(!disposed)online.textContent=text;},onError:failure}).then(value=>{if(disposed)value.dispose();else connection=value;}).catch(failure);
 async function handleTile(tile){
  if(disposed)return;if(tile.x<0||tile.x>=100||tile.y<0||tile.y>=59)return;
  const intent=playerIntent(state.snapshot,local,mode,selected,tile);if(intent.action==='exit'){leaveWorld().catch(failure);return;}
  if(intent.action==='punch'&&renderer.punch(tile)===false){status.textContent='Move closer to punch this tile.';return;}if(editing)return;
  editing=true;status.classList.remove('error');status.textContent=intent.action==='punch'?'Punching…':'Placing…';
  try{
   if(intent.action==='punch'){
    if(ITEMS.get(state.snapshot.foreground[tile.y*100+tile.x])?.lock){
     const knownLocks=await ctx.api.rpc('game_locks_list',{p_world:state.world.id}),lock=knownLocks.find(value=>value.x===tile.x&&value.y===tile.y);if(!lock){await connection?.resync();return;}
     const result=await ctx.api.rpc('game_remove_lock',{p_lock:lock.id,p_expected_version:state.world.version,p_request_id:crypto.randomUUID()});if(disposed)return;
     renderer.applyTile([{x:tile.x,y:tile.y,layer:'foreground',id:0}]);state.world.version=result.version;appliedVersion=result.version;state.locks=knownLocks.filter(value=>value.id!==lock.id);status.textContent='Lock broken · saved';connection?.resync();return;
    }
    const result=await ctx.api.rpc('game_punch',{p_world:state.world.id,p_x:tile.x,p_y:tile.y,p_expected_version:state.world.version,p_request_id:crypto.randomUUID()});if(disposed)return;
    renderer.applyTile(result.edits);state.world.version=result.version;appliedVersion=result.version;
    if(!result.edits.length&&result.tile_id)renderer.impact(tile,'hit');
    status.textContent=result.edits.length?'Block broken · saved':result.remaining?result.remaining+' hits remaining':'Punch';return;
   }
   const item=ITEMS.get(selected);
   if(item?.lock){const result=await ctx.api.rpc('game_place_lock',{p_world:state.world.id,p_x:tile.x,p_y:tile.y,p_kind:item.lock,p_expected_version:state.world.version,p_request_id:crypto.randomUUID()});if(disposed)return;applyLock(result);hotbar.hidden=true;await connection?.resync();return;}
   const edit={x:tile.x,y:tile.y,layer:item.layer,id:selected};
   const result=await ctx.api.rpc('game_edit',{p_world:state.world.id,p_expected_version:state.world.version,p_edits:[edit],p_request_id:crypto.randomUUID()});
   if(disposed)return;renderer.applyTile(result.edits);state.world.version=result.version;appliedVersion=result.version;status.textContent='Last saved · '+dateText(result.saved_at);
  }catch(error){const messages={UNBREAKABLE:'White Door and bedrock cannot be broken.',LOCK_TILE:'Only the lock owner or developer can break this lock.',OWNER_REQUIRED:'Only the lock owner or developer can break this lock.',LOCKED:'This area is locked.',PLAYER_IN_TILE:'A player is standing in that tile.',TILE_OCCUPIED:'Punch the existing block before placing another.'};failure(Error(messages[error.message]||error.message));if(/STALE_VERSION|WORLD_ACCESS_DENIED/.test(error.message))connection?.resync();}finally{editing=false;}
 }
 function applyLock(lock){
  if(lock.version>state.world.version){renderer.applyTile([{x:lock.x,y:lock.y,layer:'foreground',id:CATALOG.find(item=>item.lock===lock.kind).id}]);state.world.version=lock.version;appliedVersion=lock.version;}
  if(announcedLocks.has(lock.lock_id))return;announcedLocks.add(lock.lock_id);
  const text=(['world','diamond'].includes(lock.kind)?'This world':'This area')+' has been locked by '+lock.owner_name+'. Only the owner and players with access can build here.';
  appendChat({id:'lock:'+lock.lock_id,user_id:lock.owner_id,grow_id:'World',text,created_at:new Date().toISOString()},true);status.textContent='Lock placed · saved';
 }
 function makeDialog(title){const dialog=h('dialog',{'aria-label':title},h('h2',{},title));dialog.append(button('Close',()=>close(dialog),'quiet'));document.body.append(dialog);dialogs.add(dialog);dialog.addEventListener('close',()=>{renderer.setPreview([]);dialogs.delete(dialog);dialog.remove();});return dialog;}
 function close(dialog){renderer.setPreview([]);dialog.close();}
 async function showLocks(){await busy(wrench,async()=>{
  const locks=await ctx.api.rpc('game_locks_list',{p_world:state.world.id}),dialog=makeDialog('World locks');
  if(!locks.length)dialog.append(h('p',{},'This world has no locks yet. Select a lock in your inventory, then click an empty nearby tile.'));
  for(const lock of locks){
   const section=h('section',{},h('h3',{},lock.kind.toUpperCase()+' LOCK'),h('p',{},'Owner: '+lock.owner_name+' · '+lock.tiles.length+' protected tiles'),h('p',{class:'hint'},'Access: '+(lock.grants.map(g=>g.grow_id).join(', ')||'Owner only')));
   if(lock.owner_id===me.id||me.role==='superadmin'){
    const target=h('input',{'aria-label':'Grow ID for lock access',placeholder:'Grow ID',maxlength:20}),feedback=statusNode();
    const grant=button('Give access',()=>busy(grant,()=>ctx.api.rpc('game_grant',{p_lock:lock.id,p_target_grow_id:target.value,p_allow:true}).then(()=>{feedback.textContent='Access granted to '+target.value;}),feedback));
    const revoke=button('Remove access',()=>busy(revoke,()=>ctx.api.rpc('game_grant',{p_lock:lock.id,p_target_grow_id:target.value,p_allow:false}).then(()=>{feedback.textContent='Access removed.';}),feedback));
    let confirmed=false;const remove=button('Remove lock',()=>{if(!confirmed){confirmed=true;remove.textContent='Confirm remove lock';return;}busy(remove,async()=>{await ctx.api.rpc('game_remove_lock',{p_lock:lock.id,p_expected_version:state.world.version,p_request_id:crypto.randomUUID()});close(dialog);await connection?.resync();},feedback);},'danger');
    section.append(h('label',{},'Player access',target),h('div',{class:'row'},grant,revoke),feedback,remove);
   }dialog.append(section);
  }dialog.showModal();
 },status);}
 function frame(now){
  if(disposed)return;const dt=Math.min((now-previous)/1000,.04);previous=now;
  if(!document.hidden){const nativePlayer=renderer.readPlayer();if(nativePlayer)local={...local,...nativePlayer,user_id:me.id};
   const peers=[];for(const p of remote.values())peers.push({...p,...p.track.sample(now)});renderer.setPlayers(peers);renderer.draw(local);
   const animation=local.onGround?(local.vx?'walk':'idle'):'jump',signature=[local.x.toFixed(2),local.y.toFixed(2),local.facing,animation].join(',');
   if(nativePlayer&&connection&&!respawning&&!exiting&&movePending<1&&now-lastSubmit>=200 ){movePending++;lastSubmit=now;const changed=signature!==lastSent;lastSent=signature;const sentSequence=changed?++sequence:sequence;connection.move({p_x:+local.x.toFixed(2),p_y:+local.y.toFixed(2),p_facing:local.facing,p_animation:animation,p_sequence:changed?sentSequence:null}).then(()=>{}).catch(error=>{if(disposed||respawning||sentSequence<=respawnSequence)return;if(/MOVE_TOO_FAST/.test(error.message)&&renderer.atSpawn()){doRespawn().catch(failure);return;}failure(error);if(/MOVE_TOO_FAST|INVALID_POSITION/.test(error.message)){syncSelf=true;connection?.resync();}}).finally(()=>{movePending--;});}
   if(nativePlayer&&now-lastAppearance>1500&&!appearancePending){lastAppearance=now;const appearance=renderer.appearance(),key=JSON.stringify(appearance);if(appearance&&key!==appearanceKey){appearancePending=true;ctx.api.rpc('game_set_appearance',{p_appearance:appearance}).then(value=>{appearanceKey=key;local.appearance=value;}).catch(failure).finally(()=>{appearancePending=false;});}}
  }frameId=requestAnimationFrame(frame);
 }frameId=requestAnimationFrame(frame);
 return {dispose(){disposed=true;disposeChat();inventoryObserver.disconnect();window.removeEventListener('resize',syncClothesState);cancelAnimationFrame(frameId);connection?.dispose();renderer.dispose();for(const dialog of dialogs)dialog.close();if(ctx.enginePool){if(renderer.native)ctx.enginePool.release(iframe);else ctx.enginePool.discard(iframe);}}};
}
function download(blob,name){if(!blob)throw Error('PNG export unavailable');const url=URL.createObjectURL(blob),a=h('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
