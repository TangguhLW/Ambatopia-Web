import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root='C:/Users/user/AppData/Local/Growtopia',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const selected=['Growtopia.exe','GameData/WorldRenderers/PlayerBaseProjectile.xml','GameData/TileRenderers/BreakableBlock.xml'];
const report={at:new Date().toISOString(),root,method:'Read-only compiled PE identification, selected configuration inspection and asset filename inventory; not native decompilation.',providerLimitation:'REA native analysis requires an unavailable configured Ghidra/Hopper/IDA provider.',files:[],inventory:{},mechanicStrings:[]};
for(const name of selected){const bytes=await readFile(join(root,name));report.files.push({path:name,bytes:bytes.length,sha256:hash(bytes)});if(name.endsWith('.exe'))report.mechanicStrings=[...new Set((bytes.toString('latin1').match(/[ -~]{6,180}/g)||[]).filter(s=>/^(?:audio\/)?(?:tile_created|tile_removed|punch(?:_miss|_locked|_organic)?|door_open|door_shut)\.(?:wav|ogg)$|^White Door$|^Main Door$/.test(s)))];}
async function inventory(path){let count=0;for(const item of await readdir(path,{withFileTypes:true})){if(item.isSymbolicLink())continue;count+=item.isDirectory()?await inventory(join(path,item.name)):1;}return count;}
for(const folder of ['GameData','game','audio','Shaders','interface'])report.inventory[folder]=await inventory(join(root,folder));
report.relatedAudio=(await readdir(join(root,'audio'))).filter(name=>/^(punch|tile_|wood_break|door_|teleport)/.test(name));
await writeFile(new URL('../verification/ambatopia/native-installation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({inventory:report.inventory,selectedFiles:report.files.length,relatedAudio:report.relatedAudio}));
