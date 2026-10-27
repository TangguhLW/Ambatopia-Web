import {h,panel,button,statusNode} from '../dom.mjs';
export function renderLoading(root,ctx) {
 const status=statusNode(),list=h('ol',{class:'loading-list'});const nodes=['Authenticate account','Load profile and creative inventory','Find shared worlds'].map(text=>h('li',{},text));list.append(...nodes);
 const retry=button('Try again',()=>ctx.start(),'primary');retry.hidden=true;
 root.replaceChildren(panel('Entering Ambatopia…',list,status,retry,button('Main Menu',()=>ctx.navigate('menu'),'quiet')));
 return {step(index){nodes[index].classList.add('done');nodes[index].textContent='✓ '+nodes[index].textContent;},error(error){status.textContent=error.message;status.classList.add('error');retry.hidden=false;},dispose(){}};
}
