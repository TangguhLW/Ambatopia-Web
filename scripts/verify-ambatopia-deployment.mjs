import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin='https://ambatopia.vercel.app',digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const paths=['/','/game.js','/game.css','/tool.js','/set/app.js?v=a9aaa33d67','/brand/ambatopia-logo.png','/brand/head-open.png','/brand/head-closed.png','/brand/amba-body.png','/audio/theme.mp3','/audio/click.wav','/set/atlas/particles.png','/set/atlas/sfx/punch.wav','/set/atlas/sfx/tile_created.wav','/set/atlas/sfx/tile_removed.wav'];
paths.push('/fonts/ambatopia-bold.ttf');
paths.push('/audio/choir.mp3');
paths.push('/brand/amba-expression.png');
paths.push('/theme.css');
for(const name of ['left_arrow','right_arrow','jump_icon','punch_icon'])paths.push('/set/atlas/ui/'+name+'.png');
const checks=await Promise.allSettled(paths.map(async path=>{
 const file=path==='/'?'index.html':path.slice(1).split('?')[0],expected=await readFile(new URL('../deploy/'+file,import.meta.url));
 const large=expected.length>1048576;
 const response=await fetch(origin+path,{method:large?'HEAD':'GET',redirect:'manual',signal:AbortSignal.timeout(45000)});
 assert.equal(response.status,200,path);
 let bytes;
 if(large){
  const ranges=Array.from({length:Math.ceil(expected.length/262144)},(_,i)=>[i*262144,Math.min(expected.length-1,(i+1)*262144-1)]),chunks=[];
  for(let i=0;i<ranges.length;i+=4)chunks.push(...await Promise.all(ranges.slice(i,i+4).map(async([start,end])=>{
   const part=await fetch(origin+path,{headers:{range:`bytes=${start}-${end}`,'accept-encoding':'identity'},redirect:'manual',signal:AbortSignal.timeout(45000)});
   assert.equal(part.status,206,path);assert.equal(part.headers.get('content-range'),`bytes ${start}-${end}/${expected.length}`);
   const chunk=Buffer.from(await part.arrayBuffer());assert.equal(chunk.length,end-start+1);return chunk;
  })));
  bytes=Buffer.concat(chunks);
 }else bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(digest(bytes),digest(expected),'Deployed content differs: '+path);
 console.log('MATCH '+path);return {path,status:response.status,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:digest(bytes),verification:large?'complete HTTP ranges':'complete response'};
}));
const report={checkedAt:new Date().toISOString(),origin,deployment:process.argv[2]||null,passed:false,assets:[],failures:[]};
for(let i=0;i<checks.length;i++){const result=checks[i];if(result.status==='fulfilled')report.assets.push(result.value);else report.failures.push({path:paths[i],message:result.reason.message});}
for(const path of ['/set/','/world/','/edit/']){
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,303,path);assert.match(response.headers.get('location'),/login=1/);
 await response.body?.cancel();
}
report.unauthenticatedToolGate=true;report.passed=!report.failures.length;
await writeFile(new URL('../verification/ambatopia/deployment-report.json',import.meta.url),JSON.stringify(report,null,2));
assert.ok(report.passed,JSON.stringify(report.failures));
console.log(`PASS: ${paths.length} public resources match the local build byte for byte; all three tool pages require account login.`);
