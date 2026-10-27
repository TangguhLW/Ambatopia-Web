import {gsap} from 'gsap';

export function animateMenuMascot(mascot){
 const rig=mascot.querySelector('.mascot-rig'),facing=mascot.querySelector('.mascot-facing');
 const jump=[rig,mascot.querySelector('.mascot-bubble')];
 const eyes=mascot.querySelector('.mascot-eyelids'),mouth=mascot.querySelector('.mascot-kiss');
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');let context;
 function animate(){
  context?.revert();mascot.classList.remove('is-walking');
  if(preference.matches||localStorage.getItem('growtopia-online:reduced-motion')==='1')return;
  const bounds=mascot.getBoundingClientRect(),distance=Math.max(0,document.documentElement.clientWidth-bounds.left-bounds.width-12);
  const duration=Math.max(3,distance/65),height=Math.min(65,bounds.width*.28);
  context=gsap.context(()=>{
   mascot.classList.add('is-walking');
   const blink=gsap.timeline({repeat:-1,repeatDelay:3.7});
   for(const time of [2.8,7.1,7.4,11.9])blink.set(eyes,{opacity:1},time).set(eyes,{opacity:0},time+.13);
   gsap.timeline({repeat:-1,delay:5.3,repeatDelay:7.6})
    .set(mouth,{opacity:1})
    .to(mouth,{scaleX:.96,scaleY:1.025,duration:.16,ease:'power1.inOut'})
    .to(mouth,{scaleX:1,scaleY:1,duration:.16,ease:'power1.inOut'})
    .to(mouth,{scaleX:.97,scaleY:1.02,duration:.16,ease:'power1.inOut'})
    .to(mouth,{scaleX:1,scaleY:1,duration:.16,ease:'power1.inOut'})
    .set(mouth,{opacity:0},'>.24');
   gsap.timeline({repeat:-1}).to(mascot,{x:distance,duration,ease:'none'}).to(facing,{scaleX:-1,duration:.16},'>.2').to(mascot,{x:0,duration,ease:'none'},'>.15').to(facing,{scaleX:1,duration:.16},'>.2');
   gsap.timeline({repeat:-1,delay:1.1,repeatDelay:2.6})
    .to(jump,{scaleY:.94,scaleX:1.03,duration:.12})
    .to(jump,{y:-height,scaleY:1.02,scaleX:.99,duration:.34,ease:'power2.out'})
    .to(jump,{y:0,scaleY:1,scaleX:1,duration:.38,ease:'power2.in'})
    .to(jump,{scaleY:.93,scaleX:1.04,duration:.09})
    .to(jump,{scaleY:1,scaleX:1,duration:.17,ease:'power1.out'});
  },mascot);
 }
 animate();window.addEventListener('resize',animate);window.addEventListener('ambatopia:motion',animate);preference.addEventListener('change',animate);
 return ()=>{context?.revert();mascot.classList.remove('is-walking');window.removeEventListener('resize',animate);window.removeEventListener('ambatopia:motion',animate);preference.removeEventListener('change',animate);};
}
