export function stripDiscordHtml(html) {
 return html.replace(/<a\b(?=[^>]*(?:id=["']siteDc["']|href=["'][^"']*discord(?:\.gg|\.com)))[\s\S]*?<\/a\s*>/gi,'');
}
export function installDiscordGuard(doc=document,win=window) {
 const prohibited=value=>/discord(?:\.gg|\.com|app\.com)/i.test(String(value));
 const clean=()=>{
  for(const node of doc.querySelectorAll('a[href],#siteDc,[title],[aria-label]')){
   if(prohibited(node.getAttribute('href'))||/discord/i.test((node.title||'')+' '+(node.getAttribute('aria-label')||''))||node.id==='siteDc')node.remove();
  }
  for(const node of doc.querySelectorAll('button,a'))if(/discord/i.test(node.textContent)&&node.textContent.length<100)node.remove();
 };
 const open=win.open.bind(win);win.open=(url,...args)=>prohibited(url)?null:open(url,...args);
 doc.addEventListener('click',event=>{const link=event.target.closest?.('a');if(link&&prohibited(link.href)){event.preventDefault();event.stopImmediatePropagation();}},true);
 clean();const observer=new MutationObserver(clean);observer.observe(doc.documentElement,{childList:true,subtree:true});
}
