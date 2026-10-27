import {renderAbout} from '../about.mjs';
import {h,button,panel} from '../dom.mjs';
import {renderOptions} from '../options.mjs';
import {animateMenuMascot} from '../menu-mascot.mjs';
export function renderMenu(root,ctx) {
 const head=h('span',{class:'talking-o','aria-hidden':'true'},h('img',{src:'/brand/head-closed.png',alt:'',width:1280,height:1280}),h('img',{src:'/brand/head-open.png',alt:'',width:1280,height:1280}));
 const part=className=>h('img',{class:className,src:'/brand/amba-body.png',alt:'',width:1280,height:1280});
 const expression=className=>h('img',{class:className,src:'/brand/amba-expression.png',alt:'',width:1280,height:1280});
 const mascot=h('div',{class:'menu-mascot','aria-hidden':'true'},h('div',{class:'mascot-bubble'},'AMBATUCKAAM'),h('div',{class:'mascot-facing'},h('div',{class:'mascot-rig'},part('mascot-leg leg-left'),part('mascot-leg leg-right'),part('mascot-torso'),expression('mascot-eyelids'),expression('mascot-kiss'),h('div',{class:'pixel-water'},...Array.from({length:7},(_,i)=>h('i',{style:'--i:'+i}))))));
 const view=h('section',{class:'entry-menu','aria-label':'Ambatopia main menu'},h('div',{class:'menu-ground','aria-hidden':'true'}),mascot,h('div',{class:'entry-brand'},h('h1',{'aria-label':'Ambatopia'},'Ambat',head,'pia')),
  h('div',{class:'entry-buttons'},button('Play Online',()=>ctx.start(),'primary'),button('Options',()=>options()),button('About',()=>about())),h('p',{class:'hint beta-note'},'Creative online · Beta'));
 if(ctx.session.profile)view.append(h('p',{class:'hint'},'Signed in as '+ctx.session.profile.grow_id),button('Log out',()=>ctx.logout(),'quiet'));
 root.replaceChildren(view);
 const stopMascot=animateMenuMascot(mascot);
 function options(){stopMascot();renderOptions(root,ctx);}
 function about(){stopMascot();renderAbout(root,ctx);}
 return {dispose:stopMascot};
}
