import test from 'node:test';
import assert from 'node:assert/strict';
import {stripDiscordHtml} from '../game/remove-discord.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {adaptBundle} from '../compatibility.mjs';
test('served HTML drops Discord navigation including nested logo SVG',()=>{
 const result=stripDiscordHtml('<nav><a href="/set/">Set</a><a id="siteDc" href="https://discord.gg/abc"><svg><path d="x"/></svg><span>Discord</span></a></nav>');
 assert.ok(!/discord|siteDc/i.test(result));assert.match(result,/Set/);
});
test('pinned Editor removes Discord initialization before the missing element can crash bootstrap',async()=>{
 const key=createHash('sha256').update('https://growtopiasimulator.com/edit/wp.app.js?v=839b8985f8').digest('hex');
 const body=await readFile(new URL('../public/'+key,import.meta.url));
 const code=adaptBundle('/edit/wp.app.js',{body,sha256:createHash('sha256').update(body).digest('hex')}).toString();
 assert.ok(!code.includes("_0x3fecc5(_0x5437a2(0x5b20,'8cih')+'Dc')"));
 assert.doesNotThrow(()=>new vm.Script(code));
});
