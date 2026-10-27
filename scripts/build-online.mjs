import {readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {build} from 'esbuild';
import {stripDiscordHtml} from '../game/remove-discord.mjs';

export async function buildOnline(root,out) {
 await rm(join(out,'cloud.js'),{force:true});
 const pages={};
 for(const page of ['set','world','edit']){
  const path=join(out,page,'index.html');
  pages[page]=stripDiscordHtml((await readFile(path,'utf8')).replace(/<script defer src="\/cloud\.js"><\/script>/g,'').replace(/<script src="((?:wp\.)?app\.js[^"<>]*)"><\/script>/,(_m,url)=>`<script type="application/json" data-game-src="${url}"></script>`).replace('</body>','<script type="module" src="/tool.js"></script></body>'));
  // No alternate static index may bypass the authenticated HTML route.
  await writeFile(path,'<!doctype html><meta http-equiv="refresh" content="0;url=/?login=1"><a href="/?login=1">Login to open tools</a>');
 }
 await writeFile(join(out,'index.html'),await readFile(join(root,'game','index.html')));
 await writeFile(join(out,'game.css'),await readFile(join(root,'game','ui.css')));
 await copyFile(join(root,'game','sky-theme.css'),join(out,'theme.css'));
 for(const [source,destination] of [['ambatopia-bold.ttf','fonts/ambatopia-bold.ttf'],['ambatopia-logo.png','brand/ambatopia-logo.png'],['head-open.png','brand/head-open.png'],['head-closed.png','brand/head-closed.png'],['amba-body.png','brand/amba-body.png'],['amba-expression.png','brand/amba-expression.png'],['theme.mp3','audio/theme.mp3'],['choir.mp3','audio/choir.mp3'],['click.wav','audio/click.wav'],['tile_removed.wav','set/atlas/sfx/tile_removed.wav']]){await mkdir(dirname(join(out,destination)),{recursive:true});await copyFile(join(root,'game','assets',source),join(out,destination));}
 await mkdir(join(out,'api'),{recursive:true});
 await build({entryPoints:[join(root,'game','app.mjs')],outfile:join(out,'game.js'),bundle:true,minify:true,format:'iife',platform:'browser',target:'es2022'});
 await build({entryPoints:[join(root,'cloud','client.mjs')],outfile:join(out,'tool.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022'});
 await build({entryPoints:[join(root,'api','account.mjs')],outfile:join(out,'api','account.mjs'),bundle:true,minify:true,platform:'node',format:'esm',target:'node24'});
 await build({entryPoints:[join(root,'api','asset.mjs')],outfile:join(out,'api','asset.mjs'),bundle:true,minify:true,platform:'node',format:'esm',target:'node24'});
 await build({entryPoints:[join(root,'api','tool.mjs')],outfile:join(out,'api','tool.mjs'),bundle:true,minify:true,platform:'node',format:'esm',target:'node24',define:{TOOL_PAGES:JSON.stringify(pages)}});
 await writeFile(join(out,'package.json'),JSON.stringify({private:true,type:'module',engines:{node:'24.x'}}));
 const csp="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https://pfxgouprvgvtfcnqmqsh.supabase.co wss://pfxgouprvgvtfcnqmqsh.supabase.co; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
 return {version:2,regions:['hnd1'],functions:{'api/*.mjs':{maxDuration:30}},routes:[
  {src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'same-origin'},continue:true},
  {src:'/(set|world|edit)(?:/|/index.html)?',dest:'/api/tool?page=$1',headers:{'Content-Security-Policy':csp.replace("'wasm-unsafe-eval'","'unsafe-eval'")}},
  {src:'/cdn-cgi/trace',dest:'/local-trace.txt'},
  {handle:'filesystem'},
  {src:'/(set|world|edit)/atlas/(.*)',dest:'/api/asset?path=/$1/atlas/$2'},
  {src:'/edit/r/(.*)',dest:'/api/asset?path=/edit/r/$1'}
 ]};
}
