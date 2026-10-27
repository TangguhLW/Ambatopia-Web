import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrain} from '../game/world-format.mjs';
import {importEditorWorld,exportEditorWorld} from '../game/editor-format.mjs';
test('Editor adapter roundtrips explicit supported tiles and rejects unknown entities without data loss',()=>{
 const snapshot=createTerrain();for(let id=0;id<=14;id++)if(id!==8)snapshot.foreground[id]=id;
 const exported=exportEditorWorld(snapshot,'ROUNDTRIP');assert.equal(exported.name,'ROUNDTRIP');assert.equal(exported.fg[1],2);
 assert.deepEqual(importEditorWorld(exported),snapshot);
 assert.throws(()=>importEditorWorld({...exported,ex:{'1':{text:'not supported'}}}),/Unsupported/);
 assert.throws(()=>importEditorWorld({...exported,fg:exported.fg.map((id,i)=>i===50?999999:id)}),/Unsupported/);
 assert.throws(()=>importEditorWorld('{broken'),/JSON/);
 assert.throws(()=>importEditorWorld(' '.repeat(10485761)),/10 MiB/);
});
