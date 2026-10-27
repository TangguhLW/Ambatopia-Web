import {browserSession} from './session.mjs';
import {createGameApi} from './api.mjs';
import {renderMenu} from './screens/menu.mjs';
import {renderAuth} from './screens/auth.mjs';
import {renderLoading} from './screens/loading.mjs';
import {renderWorlds} from './screens/worlds.mjs';
import {renderPlay} from './screens/play.mjs';
import {renderDeveloper} from './screens/developer.mjs';
import {installAudio} from './audio.mjs';
import {createMenuScene} from './menu-scene.mjs';
import {browserEnginePool} from './engine/pool.mjs';
import {installPreferences} from './preferences.mjs';

const root=document.querySelector('#app'),session=browserSession(),api=createGameApi(session);
installPreferences();const audio=installAudio(),scene=createMenuScene(document.querySelector('.landscape'));
const enginePool=browserEnginePool();
let screen,screenName='menu',navigation=0,entering;
const ctx={session,api,enginePool,navigate,start,enterWorld,logout:async()=>{await session.signOut();navigate('menu');}};
const renders={menu:renderMenu,auth:renderAuth,loading:renderLoading,worlds:renderWorlds,play:renderPlay,developer:renderDeveloper};
function navigate(name,params={}) {
 navigation++;screen?.dispose();screenName=name;document.body.classList.toggle('playing',name==='play');
 if(name==='worlds')enginePool.prepare(session.profile?.id);
 document.body.dataset.screen=name;audio.screen(name);scene.screen(name);
 screen=renders[name](root,ctx,params);root.focus({preventScroll:true});
 document.querySelector('#account-label').textContent=session.profile?session.profile.grow_id:'Welcome to Ambatopia';
 return screen;
}
async function start() {
 const loading=navigate('loading'),ticket=navigation;
 try{
  const token=await session.getAccessToken();if(ticket!==navigation)return;
  if(!token){navigate('auth');return;}loading.step(0);
  const [,initial]=await Promise.all([api.rpc('game_me'),api.rpc('game_worlds_list',{p_query:'',p_cursor:'',p_limit:30}),api.rpc('game_touch')]);if(ticket!==navigation)return;loading.step(1);loading.step(2);
  const target=new URL(location.href).searchParams.get('return');
  if(/^\/(set|world|edit)\/$/.test(target||'')){location.replace(target);return;}
  history.replaceState(null,'','/');navigate('worlds',{initial});
 }catch(error){if(ticket===navigation)loading.error(error);}
}
async function enterWorld(id) {
 if(entering)return entering;const ticket=navigation;
 entering=(async()=>{try{const state=await api.rpc('game_join',{p_world:id});if(ticket!==navigation){await api.rpc('game_leave',{p_world:id});return;}navigate('play',{state});}finally{entering=null;}})();return entering;
}
session.subscribe(profile=>{if(enginePool.owner&&enginePool.owner!==profile?.id)enginePool.clear();document.querySelector('#account-label').textContent=profile?.grow_id||'Welcome to Ambatopia';if(!profile&&['play','worlds','developer'].includes(screenName))navigate('auth');});
const params=new URL(location.href).searchParams;
if(params.get('setup')==='thaney')navigate('auth',{bootstrap:true});
else if(params.has('login'))start();else navigate('menu');
setInterval(()=>{if(session.profile&&!document.hidden)api.rpc('game_touch').catch(()=>{});},20000);
