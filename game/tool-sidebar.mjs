const shapes={
 'c:-1':'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 'c:0':'M6 4h12v11h4v5H2v-5h4z',
 'c:7':'M5 3h13v3h3v12h-4v-8h-3V7h-4v4H7v10H3V6h2z',
 'c:4':'M2 7h8v3h4V7h8v9h-8v-4h-4v4H2z',
 'c:1':'M7 3h3v3h4V3h3l6 5-4 5-2-2v10H7V11l-2 2-4-5z',
 'c:2':'M5 3h14v18h-6v-9h-2v9H5z',
 'c:3':'M4 3h7v12h10v6H3V9h1z',
 'c:5':'M7 2h4v7h2V4h3v6h3v3h3v6h-3v3H7v-3H4v-7H2V8h3v4h2z',
 'c:6':'M2 4h5v3h3v3h4V7h3V4h5v10h-3v4h-5v3h-4v-3H5v-4H2z',
 'c:8':'M4 3h5v3h6V3h5v18H4zM9 10v6h6v-6z',
 'c:9':'M10 2h4v5h5v3h3v4h-3v3h-5v5h-4v-5H5v-3H2v-4h3V7h5z',
 'l:skin':'M7 3h10v3h3v12h-3v3H7v-3H4V6h3z',
 'l:hair':'M10 2h4v5h3v4h3v7h-3v4H7v-4H4v-7h3V7h3z',
 'l:eyes':'M7 5h10v3h4v3h2v3h-2v3h-4v3H7v-3H3v-3H1v-3h2V8h4zM10 9v7h4V9z',
 'l:fx':'M6 2h3v5h5V2h3v5h5v3h-5v5h5v3h-5v5h-3v-5H9v5H6v-5H1v-3h5v-5H1V7h5z',
 'n:name':'M2 5h13v3h4v3h3v3h-3v3h-4v3H2zM6 10v5h4v-5z',
 'n:titles':'M2 5h4v4h3V3h6v6h3V5h4v14H2z',
 'n:guild':'M4 2h16v14h-3v3h-3v3h-4v-3H7v-3H4z',
 'n:flag':'M3 2h3v2h15v10H6v8H3z',
 'n:wrench':'M14 2h7v4h-4v4h4v4h-7l-9 9-4-4 9-9V6h4z'
};
export function installPixelSidebar(){
 let railObserver;
 function decorate(){
  const rail=document.getElementById('g2-rail');if(!rail)return false;
  rail.classList.add('amb-pixel-rail');
  for(const button of rail.querySelectorAll('button[data-e]')){
   const svg=button.querySelector('svg'),key=button.dataset.e;
   if(!svg||svg.dataset.ambPixel===key||!shapes[key])continue;
   svg.dataset.ambPixel=key;svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
   svg.innerHTML='<path fill-rule="evenodd" d="'+shapes[key]+'"/>';
  }
  if(!railObserver){railObserver=new MutationObserver(decorate);railObserver.observe(rail,{childList:true,subtree:true});}
  return true;
 }
 if(decorate())return;
 const observer=new MutationObserver(()=>{if(decorate())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
 setTimeout(()=>observer.disconnect(),90000);
}
