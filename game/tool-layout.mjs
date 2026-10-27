import {installPixelSidebar} from './tool-sidebar.mjs';
import {installToolChrome} from './tool-chrome.mjs';
import {installPreferences} from './preferences.mjs';
export function installNativeLayout(){
 const style=document.createElement('style');
 style.textContent=`
 @font-face{font-family:'Ambatopia Gothic';src:url('/fonts/ambatopia-bold.ttf') format('truetype');font-weight:700;font-display:swap}
 @font-face{font-family:'Century Gothic';src:url('/fonts/ambatopia-bold.ttf') format('truetype');font-weight:700;font-display:swap}
 body,button,input,select,textarea,#gs-nav a,#g2,#g2-rail,#g2-dock,#panel,#gs-menu,.player-bubble,.peer-name{font-family:'Ambatopia Gothic','Century Gothic',Arial,sans-serif!important;font-weight:700!important;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
 button{touch-action:manipulation;transition:filter .12s,translate .12s}button:active{translate:0 2px}
 @keyframes amb-unfold{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(0)}}
 #gs-ex:not([hidden]),.pop:not([hidden]){animation:amb-unfold .2s ease-out}
 html.amb-online #gs-exb,html.amb-online #gs-keys,html.amb-online #gs-chatb{display:none!important}
 html.amb-online #stage{overflow:hidden}
 html.amb-online #stage{touch-action:none;overscroll-behavior:none}
 html.amb-online body>.pad{display:none!important}
 html.amb-online #gs-menu{position:fixed;inset:96px 8px auto auto!important;max-height:calc(100dvh - 180px);max-width:calc(100vw - 16px);overflow-y:auto;border-radius:8px}
 html.amb-online #gs-menu button{min-height:44px;font-size:15px}
 @media(min-width:901px) and (pointer:fine){html.amb-online.amb-clothes-closed #panel,html.amb-online.amb-clothes-closed #g2-rail,html.amb-online.amb-clothes-closed #g2-dock{display:none!important}}
 @media(min-width:901px) and (pointer:fine){html.amb-online.amb-clothes-closed #stage{left:0!important;right:0!important;top:48px!important;bottom:0!important;width:auto!important;max-width:none!important;height:auto!important}}
 @media(max-width:900px),(pointer:coarse){
  html.amb-online #panel{display:none!important}
  html.amb-online.amb-clothes-open #panel{display:flex!important;position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:calc(58px + env(safe-area-inset-bottom))!important;width:100%!important;max-width:none!important;height:min(60dvh,480px)!important;max-height:calc(100dvh - 160px)!important;z-index:30!important;animation:amb-unfold .2s ease-out}
  html.amb-online #g2-rail{overflow-x:auto;flex-shrink:0;overscroll-behavior:contain}
  html.amb-online #g2-rail button{min-width:64px;min-height:48px;font-size:13px!important;flex-shrink:0}
  html.amb-online #panel input{font-size:16px!important;min-height:44px}
  html.amb-online #g2-dock{overflow-x:auto;flex-shrink:0}
  html.amb-online #gs-bar{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
  html.amb-online #gs-bar a{min-height:44px;display:flex;align-items:center}
  html.amb-online #gs-copy,html.amb-online #gs-show,html.amb-online #g2-emob{display:none!important}
  html.amb-online .zoom{top:106px!important;right:8px!important}
  html.amb-online .zoom button{min-width:44px;min-height:44px}
  html.amb-online #stage{left:0!important;right:0!important;top:48px!important;bottom:0!important;width:auto!important;max-width:none!important;height:auto!important;background:#59cfe2}
  html.amb-online:not(.amb-clothes-open) #g2-rail,html.amb-online:not(.amb-clothes-open) #g2-dock{display:none!important}
  html.amb-online #g2-sc{min-height:0;overscroll-behavior:contain;touch-action:pan-y}
  html.amb-online.amb-clothes-open #pop-clothes.gs-on{flex:1 1 0!important;min-height:0;height:auto!important;display:flex;flex-direction:column}
  html.amb-online.amb-clothes-open #pop-clothes #g2{flex:1;min-height:0;height:auto!important}
  html.amb-online.amb-clothes-open #pop-clothes #g2-sc{flex:1;min-height:0;height:auto!important}
  html.amb-online #g2-win button{min-height:48px;font-size:12px!important;touch-action:manipulation}
  html.amb-online #g2-dock button{min-width:44px;min-height:44px}
 }
 @media(prefers-reduced-motion:reduce){button{transition:none!important}#gs-ex,.pop,#panel{animation:none!important}}
 #g2-rail.amb-pixel-rail{padding:8px!important;background:#172e43!important;scrollbar-width:thin;scrollbar-color:#60869b #172e43}
 #g2-rail.amb-pixel-rail .g2-rg{margin:0 0 10px!important;padding:5px!important;background:#213e52;border:2px solid #416477;border-radius:5px;box-shadow:inset 0 2px #64839555,0 3px #102637}
 #g2-rail.amb-pixel-rail .g2-rgl{display:block;padding:7px 4px 9px!important;color:#a9d8e5!important;font-size:11px!important;letter-spacing:1.2px;text-transform:uppercase}
 #g2-rail.amb-pixel-rail .g2-rgi{display:flex;flex-direction:column;gap:4px}
 #g2-rail.amb-pixel-rail .g2-re{position:relative;display:flex;align-items:center;gap:6px!important;min-height:40px;padding:6px 4px!important;margin:0!important;width:100%;border:1px solid transparent!important;border-radius:3px!important;background:#294b60!important;color:#e0f0f4!important;box-shadow:inset 0 1px #ffffff09;text-shadow:none!important;transition:background .12s,translate .12s}
 #g2-rail.amb-pixel-rail .g2-re>svg{width:22px!important;height:22px!important;flex:none;padding:2px;fill:#8dd9e5!important;stroke:none!important;filter:drop-shadow(1px 2px #102637)}
 #g2-rail.amb-pixel-rail .g2-re>svg *{fill:inherit;stroke:none!important;shape-rendering:crispEdges}
 #g2-rail.amb-pixel-rail .g2-re[data-e^="l:"]>svg{fill:#b1d9a4!important}
 #g2-rail.amb-pixel-rail .g2-re[data-e^="n:"]>svg{fill:#d9b4e8!important}
 #g2-rail.amb-pixel-rail .g2-re>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px!important;flex:1}
 #g2-rail.amb-pixel-rail .g2-re>em{font-size:10px!important;font-style:normal;color:#b9d8e3!important;min-width:19px;text-align:right}
 #g2-rail.amb-pixel-rail .g2-re:hover{background:#365f72!important;border-color:#7eafc0!important}
 #g2-rail.amb-pixel-rail .g2-re[aria-current="true"]{background:#4e5947!important;color:#fff2a6!important;border-color:#f1cd59!important;box-shadow:inset 3px 0 #f1cd59}
 #g2-rail.amb-pixel-rail .g2-re[aria-current="true"]>svg{fill:#ffe58b!important}
 #g2-rail.amb-pixel-rail .g2-re:focus-visible{outline:2px solid #fff2a6;outline-offset:2px}
 @media(max-width:900px),(pointer:coarse){
  #g2-rail.amb-pixel-rail{gap:8px!important;padding:8px!important;scroll-padding-inline:8px}
  #g2-rail.amb-pixel-rail .g2-rg{flex:none;margin:0!important;padding:5px!important;min-width:0}
  #g2-rail.amb-pixel-rail .g2-rgl{font-size:10px!important;padding:2px 4px 6px!important}
  #g2-rail.amb-pixel-rail .g2-rgi{flex-direction:row;gap:8px}
  #g2-rail.amb-pixel-rail .g2-re{width:auto;min-width:68px;min-height:48px;flex-direction:column;justify-content:center;gap:3px!important;padding:6px!important}
  #g2-rail.amb-pixel-rail .g2-re>span{font-size:12px!important;flex:none}
  #g2-rail.amb-pixel-rail .g2-re>em{position:absolute;right:2px;top:2px;font-size:9px!important;background:#172e43;padding:1px 2px;border-radius:2px}
 }
 `;document.head.append(style);
 installPixelSidebar();
 installToolChrome();installPreferences();
 for(const icon of document.querySelectorAll('link[rel~="icon"]'))icon.remove();const icon=document.createElement('link');icon.rel='icon';icon.href='/brand/ambatopia-logo.png';document.head.append(icon);
 const brand=()=>{const node=document.querySelector('#gs-bar .gs-brand');if(!node)return false;node.replaceChildren(Object.assign(document.createElement('img'),{src:'/brand/ambatopia-logo.png',alt:'',width:28,height:28}),document.createTextNode('Ambatopia'));document.title='Ambatopia · '+(location.pathname.includes('/edit/')?'Edit World':'Simulator');return true;};
 if(!brand()){const observer=new MutationObserver(()=>{if(brand())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),90000);}
 if(new URLSearchParams(location.search).has('online'))document.documentElement.classList.add('amb-online');
 if(document.documentElement.classList.contains('amb-online')){
  let queued=false;
  const panelFlow=()=>{queued=false;if(!matchMedia('(max-width:900px),(pointer:coarse)').matches)return;const panel=document.getElementById('panel'),dock=document.getElementById('g2-dock'),rail=document.getElementById('g2-rail'),content=document.getElementById('pop-clothes');if(!panel||!dock||!rail||!content)return;if(dock.parentElement!==panel)panel.prepend(dock);if(rail.parentElement!==panel)panel.insertBefore(rail,content);};
  const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(panelFlow);}};
  new MutationObserver(schedule).observe(document.body,{childList:true});window.addEventListener('resize',schedule);schedule();
 }
}
