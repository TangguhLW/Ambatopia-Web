import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {createMirror,ORIGIN} from '../mirror.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mirror=createMirror({root});
const seen=new Set(); const queue=['/set/','/world/','/edit/']; const inventory=[];
function references(text,base) {
  const refs=[];
  for (const match of text.matchAll(/(?:\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^\s"')]+)["']?\s*\))/g)) {
    const ref=match[1] || match[2];
    if (/^(?:data:|#|mailto:|javascript:)/i.test(ref)) continue;
    const url=new URL(ref,new URL(base,ORIGIN));
    if (url.origin===ORIGIN && url.pathname!=='/' && !['/set/','/world/','/edit/'].includes(url.pathname)) refs.push(url.pathname+url.search);
  }
  return refs;
}
while(queue.length) {
  const batch=queue.splice(0,6).filter(path => {if(seen.has(path)) return false;seen.add(path);return true;});
  await Promise.all(batch.map(async path => {
    try {
      const asset=await mirror.get(path);
      inventory.push({path,sourceUrl:asset.sourceUrl,sha256:asset.sha256,bytes:asset.bytes});
      if (/text\/html|text\/css/.test(asset.contentType)) queue.push(...references(asset.body.toString(),path));
    } catch(error) { inventory.push({path,error:error.message}); }
  }));
}
await writeFile(resolve(root,'.cache','acquisition.json'),JSON.stringify(inventory,null,2));
console.log(`Acquisition: ${inventory.filter(x=>!x.error).length} files, ${inventory.filter(x=>x.error).length} failures. Dynamic assets are cached when requested.`);
