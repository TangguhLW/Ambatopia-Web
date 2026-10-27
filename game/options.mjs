import {h,button,panel} from './dom.mjs';
import {readPreferences,savePreference} from './preferences.mjs';
import {updateAudioVolume} from './audio.mjs';
export function renderOptions(root,ctx){
 const p=readPreferences(),settings=h('div',{class:'settings-grid'});
 function toggle(label,key){const input=h('input',{type:'checkbox'});input.checked=p[key];input.addEventListener('change',()=>{savePreference(key,input.checked);updateAudioVolume();});return h('label',{class:'setting-row'},h('span',{},label),input);}
 const volume=h('input',{type:'range',min:0,max:100,value:localStorage.getItem('growtopia-online:volume')??'70','aria-label':'Menu & button volume'}),output=h('output',{},volume.value+'%');volume.addEventListener('input',()=>{localStorage.setItem('growtopia-online:volume',volume.value);output.textContent=volume.value+'%';updateAudioVolume();});
 const motion=h('input',{type:'checkbox'});motion.checked=localStorage.getItem('growtopia-online:reduced-motion')==='1';motion.addEventListener('change',()=>{localStorage.setItem('growtopia-online:reduced-motion',motion.checked?'1':'0');window.dispatchEvent(new Event('ambatopia:motion'));});
 const size=h('select',{'aria-label':'Touch control size'},...['small','normal','large'].map(value=>h('option',{value},value)));size.value=p.controlSize;size.addEventListener('change',()=>savePreference('controlSize',size.value));
 settings.append(
  h('fieldset',{},h('legend',{},'Audio'),h('label',{},'Menu & button volume ',output,volume),toggle('Menu music','music'),toggle('Button sounds','clicks')),
  h('fieldset',{},h('legend',{},'Menu & motion'),h('label',{class:'setting-row'},h('span',{},'Reduce menu motion'),motion),toggle('Moving clouds','clouds'),toggle('Amba mascot','mascot')),
  h('fieldset',{},h('legend',{},'Inventory'),toggle('Show item names','itemNames'),toggle('Compact item borders','compactItems')),
  h('fieldset',{},h('legend',{},'Game interface'),toggle('Show autosave status','saveStatus'),h('label',{class:'setting-row'},'Touch control size',size))
 );
 const feedback=h('p',{class:'hint','role':'status'},'Preferences save on this device and apply to the simulator and online game.');
 const fullscreen=button('Toggle fullscreen',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{feedback.textContent='Fullscreen is not available in this browser.';}});
 const view=panel('Options',settings,h('div',{class:'settings-actions'},fullscreen,button('Reset preferences',()=>{for(const [key,value] of Object.entries({music:true,clicks:true,clouds:true,mascot:true,itemNames:true,compactItems:false,saveStatus:true,controlSize:'normal'}))savePreference(key,value);localStorage.setItem('growtopia-online:volume','70');localStorage.setItem('growtopia-online:reduced-motion','0');window.dispatchEvent(new Event('ambatopia:motion'));updateAudioVolume();renderOptions(root,ctx);}),button('Back',()=>ctx.navigate('menu'))),feedback);view.classList.add('options-panel');root.replaceChildren(view);
}
