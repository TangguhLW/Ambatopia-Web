import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../scripts/preview-deploy.mjs';
import {once} from 'node:events';
test('deployment serves real menu and redirects every unauthenticated tool HTML path',async()=>{
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const main=await fetch(origin);assert.equal(main.status,200);assert.match(await main.text(),/<title>Ambatopia<\/title>/);
  for(const path of ['/set/','/world/','/edit/','/set/index.html','/edit']){
   const result=await fetch(origin+path,{redirect:'manual'});assert.equal(result.status,303,path);assert.match(result.headers.get('location'),/login=1/);
  }
  const oldCloud=await fetch(origin+'/cloud.js');assert.equal(oldCloud.status,404);
  const staticAsset=await fetch(origin+'/world/atlas/player_head.png');assert.equal(staticAsset.status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
