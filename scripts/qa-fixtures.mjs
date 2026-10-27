import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

const dir=new URL('../verification/fixtures/',import.meta.url);
await mkdir(dir,{recursive:true});
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const body=Buffer.concat([Buffer.from(type),data]);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(crc(body),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(8);header.writeUInt32BE(8,4);header[8]=8;header[9]=2;
const rows=Buffer.alloc(8*25);
for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=y*25+1+x*3;rows[i]=x<4?255:0;rows[i+1]=y<4?255:0;rows[i+2]=x>=4?255:0;}
await writeFile(new URL('quadrants.png',dir),Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
// Format 0, 480 ticks per quarter, 120 BPM; three ascending notes plus a chord.
const events=[0,255,81,3,7,161,32,0,192,0];
for(const note of [60,64,67])events.push(0,144,note,96,131,96,128,note,0);
events.push(0,144,60,96,0,144,64,96,131,96,128,60,0,0,128,64,0,0,255,47,0);
const track=Buffer.from(events),trackHeader=Buffer.alloc(8);trackHeader.write('MTrk');trackHeader.writeUInt32BE(track.length,4);
await writeFile(new URL('ascending-chord.mid',dir),Buffer.concat([Buffer.from('4d546864000000060000000101e0','hex'),trackHeader,track]));
console.log('Created 8×8 quadrant PNG and four-beat MIDI with five notes.');
