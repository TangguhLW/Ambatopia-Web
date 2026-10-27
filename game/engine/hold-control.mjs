export function bindHoldControl(button,change,blurTarget=window){
 const pointers=new Set(),keys=new Set(),listeners=[];let held=false;
 const sync=()=>{const next=!!(pointers.size||keys.size);if(next===held)return;held=next;button.dataset.held=String(held);change(held);};
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
 const clear=()=>{pointers.clear();keys.clear();sync();};
 listen(button,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointers.add(event.pointerId);sync();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,event=>{pointers.delete(event.pointerId);sync();});
 for(const type of ['keydown','keyup'])listen(button,type,event=>{if(!['Space','Enter'].includes(event.code))return;event.preventDefault();if(type==='keydown')keys.add(event.code);else keys.delete(event.code);sync();});
 listen(button,'blur',clear);listen(blurTarget,'blur',clear);
 return ()=>{clear();listeners.forEach(off=>off());};
}
