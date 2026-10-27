export function chatSnap(open,delta){return delta>28?true:delta< -28?false:open;}
export function bindChatSheet(chat){
 const handle=chat.querySelector('summary');let drag=null,suppress=false,reset;
 const down=event=>{if(event.button!==0)return;clearTimeout(reset);suppress=false;drag={id:event.pointerId,y:event.clientY,open:chat.open,height:chat.getBoundingClientRect().height};handle.setPointerCapture(event.pointerId);};
 const move=event=>{if(!drag||event.pointerId!==drag.id)return;const delta=event.clientY-drag.y;if(Math.abs(delta)<6)return;event.preventDefault();suppress=true;chat.classList.add('is-dragging');chat.open=true;chat.style.setProperty('--chat-height',Math.min(innerHeight*.55,Math.max(110,(drag.open?drag.height:110)+delta))+'px');};
 const end=event=>{if(!drag||event.pointerId!==drag.id)return;chat.open=event.type==='pointercancel'?drag.open:chatSnap(drag.open,event.clientY-drag.y);chat.classList.remove('is-dragging');if(chat.open&&parseFloat(chat.style.getPropertyValue('--chat-height'))<180)chat.style.setProperty('--chat-height','250px');drag=null;clearTimeout(reset);reset=setTimeout(()=>{suppress=false;},200);};
 const click=event=>{if(suppress){event.preventDefault();suppress=false;}};
 const key=event=>{if(event.key==='Escape'){chat.open=false;handle.focus();}};
 handle.addEventListener('pointerdown',down);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('click',click);chat.addEventListener('keydown',key);
 return ()=>{clearTimeout(reset);handle.removeEventListener('pointerdown',down);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.removeEventListener('click',click);chat.removeEventListener('keydown',key);};
}
