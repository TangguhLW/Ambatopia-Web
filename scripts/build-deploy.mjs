import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {adaptHtml,validatePath,ORIGIN} from '../mirror.mjs';
import {adaptBundle} from '../compatibility.mjs';
import {buildOnline} from './build-online.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const out=join(root,'deploy');
await mkdir(out,{recursive:true});
const written=new Map();
for(const key of await readdir(join(root,'.cache'))) {
  if(!/^[a-f0-9]{64}\.json$/.test(key))continue;
  const meta=JSON.parse(await readFile(join(root,'.cache',key),'utf8'));
  const url=new URL(meta.sourceUrl);
  if(url.origin!==ORIGIN)throw Error('Unexpected cache origin');
  validatePath(url.pathname);
  if(url.pathname==='/')continue;
  const original=await readFile(join(root,'public',key.slice(0,-5)));
  if(createHash('sha256').update(original).digest('hex')!==meta.sha256)throw Error('Cache digest mismatch: '+url.pathname);
const body=meta.contentType.includes('text/html')?Buffer.from(adaptHtml(original.toString('utf8'))):adaptBundle(url.pathname,{...meta,body:original});
  const name=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const destination=resolve(out,'.'+name);
  if(!destination.startsWith(out+sep))throw Error('Invalid output path');
  const hash=createHash('sha256').update(body).digest('hex');
  if(written.has(name)&&written.get(name)!==hash)throw Error('Conflicting query versions: '+name);
  written.set(name,hash);
  await mkdir(dirname(destination),{recursive:true});await writeFile(destination,body);
}
for(const page of ['set','world','edit'])if(!written.has('/'+page+'/index.html'))throw Error('Missing '+page+' page');
await writeFile(join(out,'local-trace.txt'),'loc=XX\n');
const config=await buildOnline(root,out);
await writeFile(join(out,'vercel.json'),JSON.stringify(config,null,2));
await writeFile(join(root,'verification','deploy-build.json'),JSON.stringify({builtAt:new Date().toISOString(),files:written.size,output:'deploy',routes:config.routes,assets:[...written].map(([path,sha256])=>({path,sha256}))},null,2));
console.log(`Built ${written.size} verified static files for Vercel in deploy/.`);
