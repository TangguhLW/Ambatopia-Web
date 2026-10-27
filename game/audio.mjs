import {readPreferences,preferenceStorage} from './preferences.mjs';
export function createAudioController({AudioClass,storage}){
 const theme=new AudioClass('/audio/theme.mp3');theme.loop=true;theme.preload='auto';
 const choir=new AudioClass('/audio/choir.mp3');choir.loop=true;choir.preload='none';
 const clicks=Array.from({length:5},()=>new AudioClass('/audio/click.wav'));let next=0,unlocked=false,screen='menu',hidden=false;
 const volume=()=>{const value=Number(storage.getItem('growtopia-online:volume')??70);return Math.max(0,Math.min(1,(Number.isFinite(value)?value:70)/100));};
 function sync(){const active=screen==='worlds'?choir:theme;for(const track of [theme,choir]){track.volume=volume()*.5;if(readPreferences(storage).music&&track===active&&unlocked&&!['play','tool'].includes(screen)&&!hidden&&volume()>0){if(track.paused)track.play().catch(()=>{});}else track.pause();}}
 return {theme,choir,gesture(){unlocked=true;sync();},click(){if(!readPreferences(storage).clicks)return;const audio=clicks[next++%clicks.length];audio.volume=volume();audio.currentTime=0;audio.play().catch(()=>{});},screen(name){screen=name;sync();},visibility(value){hidden=value;sync();},volume:sync};
}
let controller;
export function installAudio({menuMusic=true}={}){
 if(controller)return controller;
 controller=createAudioController({AudioClass:Audio,storage:preferenceStorage()});
 controller.theme.hidden=true;controller.theme.dataset.menuMusic='';document.body.append(controller.theme);
 controller.choir.hidden=true;controller.choir.dataset.worldMenuMusic='';document.body.append(controller.choir);
 if(!menuMusic)controller.screen('tool');
 document.addEventListener('pointerdown',()=>controller.gesture(),{capture:true});
 document.addEventListener('click',event=>{if(event.target.closest?.('button,a,[role="button"],[role="checkbox"],input[type="checkbox"]')){controller.gesture();controller.click();}},true);
 document.addEventListener('visibilitychange',()=>controller.visibility(document.hidden));
 window.addEventListener('storage',()=>controller.volume());return controller;
}
export function playTone(){controller?.click();}
export function updateAudioVolume(){controller?.volume();}
