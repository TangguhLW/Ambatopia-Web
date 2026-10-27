import {validateSnapshot} from './world-format.mjs';
// IDs verified against the original Editor's rendered Backpack catalog.
export const SIMULATOR_IDS=Object.freeze({0:0,1:2,2:16,3:8,4:10,5:100,6:548,7:116,8:14,9:102,10:242,11:1796,12:202,13:204,14:206,15:6,16:4});
const reverse=new Map(Object.entries(SIMULATOR_IDS).map(([online,original])=>[original,Number(online)]));
export function importEditorWorld(input) {
 if(typeof input==='string'){if(new TextEncoder().encode(input).length>10485760)throw Error('World exceeds 10 MiB');try{input=JSON.parse(input);}catch{throw Error('Invalid world JSON');}}
 if(input?.schema===1)return validateSnapshot(input);
 if(input?.w!==100||input?.h!==60)throw Error('Unsupported Editor dimensions');
 if((input.fl||[]).some(flag=>flag!==0)||Object.keys(input.ex||{}).length)throw Error('Unsupported Editor effects or special entities. Keep the original file; nothing was imported.');
 function layer(key){if(!Array.isArray(input[key])||input[key].length!==6000)throw Error('Unsupported Editor layer');const unknown=[...new Set(input[key].filter(id=>!reverse.has(id)))];if(unknown.length)throw Error('Unsupported Editor item IDs: '+unknown.slice(0,12).join(', '));return input[key].map(id=>reverse.get(id));}
 const foreground=layer('fg'),door=foreground.indexOf(15),spawn=door>=0?{x:door%100,y:Math.floor(door/100)}:{x:5,y:22};
 return validateSnapshot({schema:1,width:100,height:60,foreground,background:layer('bg'),spawn});
}
export function exportEditorWorld(snapshot,name) {
 snapshot=validateSnapshot(snapshot);
 return {name,w:100,h:60,weather_key:'sunny',weather:0,bpm:60,fg:snapshot.foreground.map(id=>SIMULATOR_IDS[id]),bg:snapshot.background.map(id=>SIMULATOR_IDS[id]),fl:Array(6000).fill(0),ex:{}};
}
