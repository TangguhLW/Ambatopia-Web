import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const dir=new URL('../verification/',import.meta.url);
const outputs=[];
for(const [name,width,height] of [['growtopia-player-stand-photo.png',248,232],['mediaqa.png',3200,1920]]) {
  const data=await readFile(new URL(name,dir));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),width);assert.equal(data.readUInt32BE(20),height);
  const idat=[];let ended=false;
  for(let i=8;i<data.length;) {
    const length=data.readUInt32BE(i),type=data.toString('ascii',i+4,i+8);
    assert.ok(i+length+12<=data.length,'Truncated PNG chunk');
    if(type==='IDAT')idat.push(data.subarray(i+8,i+8+length));
    if(type==='IEND')ended=true;
    i+=length+12;
  }
  assert.ok(ended && idat.length);
  const channels={2:3,6:4}[data[25]];assert.ok(channels);assert.equal(data[24],8);
  assert.equal(inflateSync(Buffer.concat(idat)).length,height*(1+width*channels));
  outputs.push({name,bytes:data.length,width,height,sha256:createHash('sha256').update(data).digest('hex')});
}
const video=await readFile(new URL('growtopia-player-walk-video.mp4',dir));
const types=[];
for(let i=0;i<video.length;) {
  const size=video.readUInt32BE(i),type=video.toString('ascii',i+4,i+8);
  assert.ok(size>=8 && i+size<=video.length,'Truncated MP4 box');types.push(type);i+=size;
}
for(const type of ['ftyp','moov','mdat'])assert.ok(types.includes(type),`Missing MP4 ${type}`);
outputs.push({name:'growtopia-player-walk-video.mp4',bytes:video.length,boxes:types,sha256:createHash('sha256').update(video).digest('hex')});
const world=JSON.parse(await readFile(new URL('mediaqa.json',dir)));
assert.equal(world.name,'MEDIAQA');assert.equal(world.fg.length,6000);assert.equal(world.bg.length,6000);
assert.equal(world.fg.filter(id=>id===10962).length,64);
assert.equal(Object.values(world.ex).filter(v=>v.type===80).length,64);
assert.equal(world.bg.filter(id=>id===420).length,5);
const report={checkedAt:new Date().toISOString(),passed:true,outputs,world:{name:world.name,artBlocks:64,pianoNotes:5},browserObservations:{video:{width:248,height:232,duration:3.0081,readyState:4,paused:false},consoleErrors:0,note:'Browser observations are recorded from the manual CUA session; this script independently checks exported file structure and saved world data.'}};
await writeFile(new URL('media.report.json',dir),JSON.stringify(report,null,2));
console.log('PASS: both PNG streams, MP4 container, 64 coloured Art blocks and five saved MIDI notes.');
