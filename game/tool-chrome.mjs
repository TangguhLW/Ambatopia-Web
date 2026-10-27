import {iconButton} from './ui-icons.mjs';
export function installToolChrome(){
 const style=document.createElement('style');style.textContent=`
 #gs-copy,#g2-m-copy{display:none!important}
 #gs-bar{background:#17272f!important;border-bottom:2px solid #48606a!important;box-shadow:none!important}
 #gs-nav{gap:3px!important;padding:3px!important;border-radius:3px!important;background:#0e1c23!important}
 #gs-nav a{border:0!important;border-radius:2px!important;background:transparent!important;color:#a7bec6!important;padding:8px 12px!important;box-shadow:none!important;font-size:12px!important;text-shadow:none!important}
 #gs-nav a.on,#gs-nav a[aria-current=page]{background:#83d9bd!important;color:#102f2c!important}
 #gs-bar .gs-ib{background:#253d46!important;color:#dcebea!important;border:1px solid #4a6570!important;border-radius:3px!important;box-shadow:none!important}
 #gs-lang{width:44px!important;min-width:44px!important;padding:8px!important}
 #gs-lang svg{width:27px!important;height:18px!important;display:block;stroke:none!important}
 #panel{background:#1b2c35!important;border-color:#48606a!important}
 #g2{background:#1b2c35!important}
 #g2-title{color:#b8eadb!important;font-size:14px!important;letter-spacing:.5px}
 #g2-q{background:#10212a!important;border:1px solid #587681!important;border-radius:3px!important;color:#e2f0f2!important;box-shadow:none!important}
 #g2 .g2-it{background:#263d46!important;border:1px solid #49616c!important;border-radius:3px!important;box-shadow:inset 0 2px #67818a33!important}
 #g2 .g2-it>button:first-child{background:transparent!important;border:0!important;border-radius:2px!important;box-shadow:none!important;color:#e1eeed!important}
 #g2 .g2-it.on,#g2 .g2-it:has(.g2-w[aria-pressed=true]){border-color:#8fe3c4!important;background:#2a514c!important;box-shadow:inset 0 -3px #8fe3c4!important}
 #g2 .g2-it:hover{border-color:#a8d0d2!important}
 #g2 .g2-n{color:#dce7e8!important;font-size:11px!important}
 #g2 .g2-it em{color:#9db8bd!important;font-size:9px!important}
 #g2 .g2-star{color:#90c6b8!important}
 #g2-dock{background:#16282f!important;border:0!important;border-top:1px solid #48606a!important;box-shadow:none!important;border-radius:0!important;padding:8px!important;gap:7px!important}
 #g2-slots{gap:5px!important}
 #g2-slots>div{background:#243c44!important;border:1px solid #49636b!important;border-radius:3px!important;box-shadow:none!important}
 #g2-slots>div:has(button){border-color:#83d9bd!important}
 #g2-slots .g2-sb{background:transparent!important;border:0!important;border-radius:2px!important;box-shadow:none!important}
 #g2-acts button{background:#304b53!important;border:1px solid #49636b!important;border-radius:3px!important;color:#cce5e1!important;box-shadow:none!important}
 #gs-menu,.g2-pop{background:#172e36!important;border:1px solid #68858b!important;border-radius:5px!important;box-shadow:0 6px 0 #0c1d2580!important}
 #gs-menu button{border-radius:2px!important;box-shadow:none!important}
 #gs-exb,#g2-emob,.zoom button{background:#29464f!important;border:1px solid #597b82!important;border-radius:3px!important;box-shadow:none!important;color:#d8ece8!important;text-shadow:none!important}
 html[data-item-names=false] #g2 .g2-n{visibility:hidden}
 html[data-compact-items=true] #g2 .g2-it{border-color:transparent!important;box-shadow:none!important;background:#20343e!important}
 html[data-compact-items=true] #g2 .g2-it.on{border-color:#8fe3c4!important}
 html[data-save-status=false] #account-save-status{display:none!important}
 @media(max-width:900px),(pointer:coarse){#gs-nav a{padding:6px 8px!important;font-size:11px!important}#gs-bar .gs-brand{font-size:13px!important}#gs-bar .gs-brand img{width:22px!important;height:22px!important}#g2-dock{padding:6px!important}#gs-lang{display:flex!important;align-items:center;justify-content:center}}
 `;document.head.append(style);
 const theme=document.createElement('link');theme.rel='stylesheet';theme.href='/theme.css';document.head.append(theme);
 const decorated=new WeakSet();
 function controls(){
  const nodes=[[document.getElementById('g2-emob'),'emote','Emotes'],[document.getElementById('gs-exb'),'export','Export image or video'],...[...document.querySelectorAll('.zoom button')].map((node,i)=>[node,i?'minus':'plus',i?'Zoom out':'Zoom in'])];
  for(const [node,name,label] of nodes){if(!node)continue;const paint=()=>{if(!node.querySelector('svg[data-control-icon]')){iconButton(node,name,label);node.querySelector('svg').dataset.controlIcon=name;}};paint();if(!decorated.has(node)){decorated.add(node);new MutationObserver(paint).observe(node,{childList:true});}}
  return nodes.filter(([node])=>node).length>=4;
 }
 if(!controls()){const observer=new MutationObserver(()=>{if(controls())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),90000);}
 const uk='<rect width="30" height="20" fill="#244777"/><path d="M0 0l30 20m0-20L0 20" stroke="#fff" stroke-width="5"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="7"/><path d="M15 0v20M0 10h30" stroke="#d94752" stroke-width="4"/>',id='<path fill="#e24848" d="M0 0h30v10H0z"/><path fill="#fff" d="M0 10h30v10H0z"/>';
 let watching=false;
 function update(){
  const bar=document.getElementById('gs-bar');if(!bar)return false;
  const lang=bar.querySelector('#gs-lang');
  if(lang){const label=lang.getAttribute('aria-label')||'',text=lang.textContent.trim(),indonesian=document.documentElement.lang==='id'||text.startsWith('ID')||(/Indonesian.*English/.test(label)),key=indonesian?'id':'en';
   if(lang.dataset.flag!==key||!lang.querySelector('svg')){lang.dataset.flag=key;lang.innerHTML='<svg viewBox="0 0 30 20" aria-hidden="true">'+(indonesian?id:uk)+'</svg>';lang.title=indonesian?'Bahasa Indonesia · Switch to English':'English · Ganti ke Bahasa Indonesia';}
  }
  if(!watching){watching=true;new MutationObserver(update).observe(bar,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label']});}
  return true;
 }
 if(!update()){const observer=new MutationObserver(()=>{if(update())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),90000);}
}
