import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {adaptBundle} from '../compatibility.mjs';
import {adaptHtml} from '../mirror.mjs';

async function snapshot(path) {
  const key=createHash('sha256').update('https://growtopiasimulator.com'+path).digest('hex');
  const body=await readFile(new URL('../public/'+key,import.meta.url));
  return {body,sha256:createHash('sha256').update(body).digest('hex')};
}
test('pinned Set/World and editor snapshots remain valid JavaScript after local adaptations',async()=>{
  for(const path of ['/set/app.js?v=a9aaa33d67','/world/app.js?v=a9aaa33d67','/edit/wp.app.js?v=839b8985f8']) {
    const source=await snapshot(path);
    const local=adaptBundle(path,source);
    assert.doesNotThrow(()=>new vm.Script(local.toString(),{filename:path}));
    assert.notDeepEqual(local,source.body);
    if(path.includes('wp.app')) assert.ok(local.includes('n=function(){return 0;}'));
    else {assert.ok(local.includes('_0x1ad61d=()=>-1'));assert.ok(local.includes('_0xca6897=()=>{}'));}
  }
});
test('real page bootstrap uses static styles and preserves original page copy',async()=>{
  const source=await snapshot('/set/');
  const html=adaptHtml(source.body.toString());
  assert.ok(!html.includes('document.write('));
  assert.ok(html.includes('window.GS=1;window.GS2=1;'));
  assert.ok(html.includes('Orange dot = the worn picture is not built yet'));
  assert.ok(!html.includes('cloudflareinsights'));
});
