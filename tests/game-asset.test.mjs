import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicAsset} from '../game/asset-server.mjs';
test('public asset fallback never forwards browser cookies or credentials upstream',async()=>{
 let seen;
 const response=await fetchPublicAsset('/world/atlas/example.png?v=123',async(url,init)=>{seen={url,init};return new Response('PNG',{headers:{'content-type':'image/png','set-cookie':'UPSTREAM=NO'}});});
 assert.equal(seen.url,'https://growtopiasimulator.com/world/atlas/example.png?v=123');
 assert.ok(!new Headers(seen.init.headers).has('cookie'));assert.equal(seen.init.redirect,'manual');assert.equal(response.headers.get('set-cookie'),null);
 for(const path of ['https://evil.example/a','/api/account','/edit/r/../secret','/world/atlas/%2e%2e/secret'])await assert.rejects(fetchPublicAsset(path,()=>{throw Error('should not fetch');}));
});
