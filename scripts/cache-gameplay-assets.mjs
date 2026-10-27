import {createMirror} from '../mirror.mjs';
import {fileURLToPath} from 'node:url';
const mirror=createMirror({root:fileURLToPath(new URL('..',import.meta.url))});
for(const path of ['/set/atlas/particles.png','/set/atlas/sfx/punch.wav','/set/atlas/sfx/tile_created.wav']){
 const asset=await mirror.get(path);console.log(path+' '+asset.bytes+' bytes');
}
