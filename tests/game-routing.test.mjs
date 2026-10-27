import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeTool,safeReturnPath} from '../game/tool-server.mjs';
test('tool HTML requires a verified player, never just a cookie or local flag',async()=>{
 const req=new Request('https://game.example/set/',{headers:{cookie:'gt_access=FORGED'}});
 assert.equal((await authorizeTool(req,async()=>{throw Error('invalid');})).status,303);
 assert.equal((await authorizeTool(new Request('https://game.example/edit/'),async()=>({id:'id'}))).status,303);
 assert.equal(await authorizeTool(req,async token=>token==='FORGED'?{id:'real'}:null),null);
 for(const path of ['https://evil.example','//evil.example','/api/account','/set/../other'])assert.equal(safeReturnPath(path),'/');
 assert.equal(safeReturnPath('/edit/'),'/edit/');
});
