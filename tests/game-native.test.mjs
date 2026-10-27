import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {adaptBundle} from '../compatibility.mjs';
import {nativeHook} from '../game/engine/native-hook.mjs';
test('shared avatar names can change without queuing a duplicate character render',()=>{
 let renders=0;const scope={window:{GW:{}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0x54c8b8:()=>{renders++;}};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);scope.window.AmbatopiaNative.name('PlayerTwo',false);assert.equal(renders,0);assert.equal(scope._0x2c5d85.name,'PlayerTwo');
 scope.window.AmbatopiaNative.name('PlayerThree');assert.equal(renders,1);
});
test('switching worlds clears previous native tile labels, chat and punch particles',()=>{
 const messages={msgs:['old-world'],key:'cached',ver:2},tiles=new Map([[1,{text:'EXIT'}]]),particles=[{}];
 let cleared=0;const canvas={get width(){return 400;},set width(value){assert.equal(value,400);cleared++;}};
 const scope={window:{GW:{},document:{getElementById:id=>id==='chatc'?canvas:null}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0x22bafa:messages,_0x167506:tiles,_0x3a6ec6:particles};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);scope.window.AmbatopiaNative.resetWorldEffects();
 assert.equal(tiles.size,0);assert.equal(particles.length,0);assert.equal(messages.msgs.length,0);assert.equal(messages.key,'');assert.equal(messages.ver,3);assert.equal(cleared,1);
});
test('native tile labels use the resized world canvas without repeated invalidation',()=>{
 const messages={W:676,H:802,key:'old',ver:2},canvas={width:1254,height:882};
 const scope={window:{GW:{},document:{getElementById:()=>canvas}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0x22bafa:messages};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);scope.window.AmbatopiaNative.syncOverlay();
 assert.equal(messages.W,1254);assert.equal(messages.H,882);assert.equal(messages.key,'');assert.equal(messages.ver,3);
 scope.window.AmbatopiaNative.syncOverlay();assert.equal(messages.ver,3);
});

test('native punch uses the recovered target transform and native arm animation entrypoint',()=>{
 let punched=0,tp;const scope={window:{GW:{tp:(...args)=>{tp=args;}},GSLOOK:{}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0xfb53aa:null,_0x2904b4:{px:1600,gy:800},_0x2c85fc:()=>{punched++;return true;}};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);scope.window.AmbatopiaNative.punch({x:52,y:23});
 assert.equal(punched,1);assert.deepEqual(JSON.parse(JSON.stringify(scope._0xfb53aa)),{x:64,y:-16});
 scope.window.AmbatopiaNative.position({x:5+6/32,y:23+2/32});assert.deepEqual(tp,[5,23]);
});
test('remote poses drive the native walk distance and render at one logical pixel per pixel',()=>{
 let renderScale,walk;const scope={window:{GW:{},GSLOOK:{}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0x48774c:4,_0x4a54e4:0,_0x269da7:false,_0xa0d8bb:()=>{renderScale=scope._0x48774c;walk=scope._0x7254f0.wd;}};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);
 scope.window.AmbatopiaNative.renderAvatar({}, {animation:'walk',facing:'left',phase:2,time:100});
 assert.equal(renderScale,1);assert.equal(walk,2);assert.ok(scope._0x7254f0.walk>0);assert.equal(scope._0x7254f0.face,-1);
});

test('restoring a native outfit applies all fields before one renderer rebuild',()=>{
 let rebuilds=0;const character={worn:{},skin:3},item={id:48,slot:0};
 const scope={window:{GW:{},GSLOOK:{get:()=>''}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:character,_0x1759a8:[],_0x4036e1:new Map([[48,item]]),_0x38a70e:()=>{rebuilds++;},_0x54c8b8:()=>{}};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);
 scope.window.AmbatopiaNative.wear({outfit:[48,0,0,0,0,0,0,0,0,0],skin:[240,190,140],hc:'#12abef',ec:'',lc:''});
 assert.equal(rebuilds,1);assert.equal(character.worn[0],item);assert.deepEqual(Array.from(character.hc),[18,171,239]);assert.equal(character.ec,null);
});

test('remote avatars use the original full-colour renderer instead of its white effect mask',()=>{
 let mask;const scope={window:{GW:{},GSLOOK:{}},_0x7254f0:{},_0x2082e1:{},_0x2c5d85:{},_0xa0d8bb:(_ctx,value)=>{mask=value;}};
 vm.runInNewContext(nativeHook.replace(/,$/,';'),scope);scope.window.AmbatopiaNative.renderAvatar({});assert.equal(mask,false);
});

test('native integration exposes the real simulator renderer without replacing its bundle',async()=>{
 const cache=new URL('../.cache/',import.meta.url);
 let meta,key;for(const file of await readdir(cache)){if(!/^[a-f0-9]{64}\.json$/.test(file))continue;const m=JSON.parse(await readFile(new URL(file,cache),'utf8'));if(new URL(m.sourceUrl).pathname==='/set/app.js'){meta=m;key=file.slice(0,-5);break;}}
 assert.ok(meta);const body=await readFile(new URL('../public/'+key,import.meta.url));
 const code=adaptBundle('/set/app.js',{body,sha256:createHash('sha256').update(body).digest('hex')}).toString();
 assert.ok(code.includes(',window.AmbatopiaNative='),'native adapter must be inserted at the verified assignment boundary');
 assert.ok(/renderAvatar.*_0xa0d8bb/s.test(code),'adapter must call the original avatar renderer');
 assert.match(code,/_0x7254f0/);assert.doesNotThrow(()=>new vm.Script(code));
});
