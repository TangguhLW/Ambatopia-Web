import {h,button,panel,statusNode,busy,dateText} from '../dom.mjs';
export function renderDeveloper(root,ctx){
 if(ctx.session.profile?.role!=='superadmin'){root.replaceChildren(panel('Access denied',button('Main Menu',()=>ctx.navigate('menu'))));return {dispose(){}};}
 let offset=0,disposed=false;const status=statusNode(),query=h('input',{'aria-label':'Find player',placeholder:'Find Grow ID',maxlength:20}),body=h('tbody'),inspector=h('pre',{},'Select a player or world to inspect.'),worldInput=h('input',{'aria-label':'World name to inspect',placeholder:'World name',maxlength:24});
 const refresh=button('Find players',()=>busy(refresh,load,status),'primary');
 const worldInspect=button('Inspect world',()=>busy(worldInspect,async()=>{const worlds=await ctx.api.rpc('game_worlds_list',{p_query:worldInput.value,p_limit:30,p_cursor:''});const found=worlds.find(w=>w.name===worldInput.value.toUpperCase());if(!found)throw Error('World not found.');inspector.textContent=JSON.stringify(await ctx.api.rpc('game_admin_world',{p_world:found.id}),null,2);teleport.hidden=false;teleport.onclick=()=>busy(teleport,async()=>{await ctx.api.rpc('game_admin_action',{p_action:'teleport',p_target:found.id,p_payload:{},p_request_id:crypto.randomUUID()});await ctx.enterWorld(found.id);},status);},status));
 const teleport=button('Enter inspected world',()=>{});teleport.hidden=true;
 const table=h('table',{},h('thead',{},h('tr',{},...['Grow ID','Created','Last login','Last seen','Status','World','Actions'].map(text=>h('th',{},text)))),body);
 const view=panel('Developer · Thaney',h('p',{class:'hint'},'Server records only. Passwords and session tokens are never displayed.'),h('div',{class:'row'},query,refresh),status,h('div',{class:'table-scroll'},table),h('div',{class:'back-row'},button('Previous',()=>{offset=Math.max(0,offset-30);load().catch(error=>status.textContent=error.message);}),button('Next',()=>{offset+=30;load().catch(error=>status.textContent=error.message);})),h('h2',{},'Inspector'),h('div',{class:'row'},worldInput,worldInspect),teleport,inspector,button('World Menu',()=>ctx.start(),'quiet'));view.classList.add('wide');root.replaceChildren(view);
 async function load(){const users=await ctx.api.rpc('game_admin_users',{p_query:query.value,p_offset:offset,p_limit:30});if(disposed)return;body.replaceChildren();for(const user of users){
  const inspect=button('Inspect',()=>busy(inspect,async()=>{inspector.textContent=JSON.stringify(await ctx.api.rpc('game_admin_player',{p_user:user.id}),null,2);},status));
  const actions=h('div',{class:'row'},inspect);
  if(user.role!=='superadmin')for(const action of ['kick',user.banned?'unban':'ban']){
   const act=button(action,()=>{const dialog=h('dialog',{'aria-label':'Confirm '+action},h('h2',{},action+' '+user.grow_id+'?'),h('p',{},'This action is recorded in the developer audit log.'));const confirm=button('Confirm '+action,()=>busy(confirm,async()=>{await ctx.api.rpc('game_admin_action',{p_action:action,p_target:user.id,p_payload:{reason:'Developer moderation'},p_request_id:crypto.randomUUID()});dialog.close();await load();},status),'danger');dialog.append(confirm,button('Cancel',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();});actions.append(act);
  }
  body.append(h('tr',{},h('td',{},user.grow_id),h('td',{},dateText(user.created_at)),h('td',{},dateText(user.last_login_at)),h('td',{},dateText(user.last_seen_at)),h('td',{},user.banned?'Banned':user.online?'Online':'Offline'),h('td',{},user.world_name||'—'),h('td',{},actions)));
 }status.textContent=users.length+' accounts · page '+(Math.floor(offset/30)+1);}
 load().catch(error=>status.textContent=error.message);const timer=setInterval(()=>load().catch(()=>{}),20000);
 return {dispose(){disposed=true;clearInterval(timer);}};
}
