export function h(tag,attrs={},...children) {
 const el=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(key.startsWith('on'))el.addEventListener(key.slice(2).toLowerCase(),value);
  else if(key==='class')el.className=value;
  else if(value===true)el.setAttribute(key,'');
  else if(value!==false&&value!=null)el.setAttribute(key,String(value));
 }
 for(const child of children.flat(Infinity))if(child!=null)el.append(child instanceof Node?child:document.createTextNode(String(child)));
 return el;
}
export const button=(text,onClick,className='')=>h('button',{type:'button',onClick,class:className},text);
export function panel(title,...children){return h('section',{class:'panel'},h('h1',{},title),...children);}
export function statusNode(){return h('p',{class:'status',role:'status','aria-live':'polite'});}
export async function busy(button,job,status){
 button.disabled=true;try{return await job();}catch(error){status.textContent=error.message;status.classList.add('error');}finally{button.disabled=false;}
}
export function dateText(value){return value?new Date(value).toLocaleString(): '—';}
