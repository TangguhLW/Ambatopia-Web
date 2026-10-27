import {h,button,panel,statusNode,busy} from '../dom.mjs';
import {normalizeWorldName} from '../contract.mjs';
export function renderWorlds(root,ctx,{initial=[]}={}) {
 let disposed=false,searchVersion=0;const status=statusNode(),grid=h('div',{class:'world-grid'}),query=h('input',{name:'world',placeholder:'World name',maxlength:24,autocomplete:'off','aria-label':'Search or enter world name'});
 query.id='world-name';const form=h('form',{class:'world-entry',id:'world-entry'},h('label',{for:'world-name'},'World Name:'),query);
 const enter=h('button',{type:'submit',form:'world-entry',class:'primary fit'},'Enter World');
 async function refresh(){const version=++searchVersion;status.textContent='Finding worlds…';const data=await ctx.api.rpc('game_worlds_list',{p_query:query.value,p_cursor:'',p_limit:30});if(!disposed&&version===searchVersion){draw(data);status.textContent=data.length?'Choose a world or create your own.':'No matching world. Create it to start building.';}return data;}
 form.addEventListener('submit',event=>{event.preventDefault();busy(enter,async()=>{
  const name=normalizeWorldName(query.value),id=await ctx.api.rpc('game_create_world',{p_name:name,p_request_id:crypto.randomUUID()});
  await ctx.enterWorld(id);
 },status);});
 const search=button('Search',()=>busy(search,refresh,status));
 const random=button('Random World',()=>busy(random,async()=>{const worlds=await ctx.api.rpc('game_worlds_list',{p_query:'',p_cursor:'',p_limit:30});if(!worlds.length){status.textContent='No worlds yet. Create the first one.';return;}await ctx.enterWorld(worlds[Math.floor(Math.random()*worlds.length)].id);},status));
 const tools=h('div',{class:'tools'},h('a',{href:'/set/'},'Set designer'),h('a',{href:'/edit/'},'Edit World'),h('a',{href:'/world/'},'Simulator'));
 const view=panel('Choose a world',h('p',{class:'muted'},'Welcome, '+ctx.session.profile.grow_id+'. Your worlds save automatically.'),form,h('p',{class:'hint'},'Enter a world name to visit it. An unused name creates a new world. Locks protect building, so you can still visit a locked world.'),h('div',{class:'row'},search,random),status,grid,tools,
 h('div',{class:'back-row world-entry-actions'},button('Back',()=>ctx.navigate('menu'),'quiet'),...(ctx.session.profile.role==='superadmin'?[button('Developer',()=>ctx.navigate('developer'))]:[]),enter));
 view.classList.add('wide','world-menu');root.replaceChildren(view);
 function draw(worlds){grid.replaceChildren();for(const world of worlds){const label=world.name+' ('+(world.player_count||0)+')',card=button(label,()=>busy(card,()=>ctx.enterWorld(world.id),status),'world-card');card.title=world.owner_id?'Locked · visit freely; building requires access':'Open world';card.setAttribute('aria-label',label+' · '+(world.owner_id?'Locked':'Open world'));grid.append(card);}if(!worlds.length)grid.append(h('p',{class:'muted'},'A new world starts with you.'));}
 draw(initial);status.textContent=initial.length?'Choose a world or create your own.':'Enter a name and create the first world.';
 const timer=setInterval(()=>refresh().catch(()=>{}),20000);
 return {dispose(){disposed=true;clearInterval(timer);}};
}
