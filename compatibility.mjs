import {createHash} from 'node:crypto';
import {nativeHook} from './game/engine/native-hook.mjs';

// Offsets refer to the UTF-16 text of the exact upstream snapshots, not byte offsets.
const snapshots={
  set:{hash:'df5dccb5180f4925688925850a66f8d5284b65ad00c0ffbcd402cf0449bc1767',patches:[
    {start:642240,end:642299,text:'"growtopiasimulator.com"',reason:'Use the original host identity for the public asset-pack decoder.'},
    {start:2154201,end:2168554,text:'()=>{}',reason:'Keep this local development copy on localhost instead of the upstream domain redirect.'},
    {start:4725502,end:4727162,text:'()=>-1',reason:'Return the original success sentinel (-1) for local browser QA; retain native canvas behavior.'},
    {start:4822790,end:4822790,text:nativeHook,reason:'Expose the verified native GW/GSAPI lifecycle and original avatar renderer for online integration.'},
  ]},
  edit:{hash:'f3cb6f872445580f18505556d445ae03b3c0be67f3c2869e24365e3e9c63939b',patches:[
    {start:445454,end:446995,text:'function(){return 0;}',reason:'Allow local automated browser QA; retain native canvas behavior.'},
    {start:715489,end:723934,text:'()=>{}',reason:'Keep this local development editor on localhost instead of the upstream domain redirect.'},
    {start:2873744,end:2873850,text:'void 0',reason:'Remove Discord link initialization before the deleted siteDc element is accessed.'},
  ]},
};

export function applyVerifiedPatches(bytes,hash,patches) {
  if(createHash('sha256').update(bytes).digest('hex')!==hash) throw Error('Upstream bundle hash changed; review compatibility patches before updating');
  const source=bytes.toString('utf8');
  const pieces=[];let end=0;
  for(const patch of [...patches].sort((a,b)=>a.start-b.start)) {
    if(patch.start<end || patch.end<patch.start || patch.end>source.length) throw Error('Invalid compatibility patch range');
    pieces.push(source.slice(end,patch.start),patch.text);end=patch.end;
  }
  pieces.push(source.slice(end));
  return Buffer.from(pieces.join(''));
}

const adapted=new Map();
export function adaptBundle(path,asset) {
  const pathname=path.split('?')[0];
  const snapshot=/^\/(?:set|world)\/app\.js$/.test(pathname)?snapshots.set:pathname==='/edit/wp.app.js'?snapshots.edit:null;
  if(!snapshot) return asset.body;
  if(!adapted.has(asset.sha256)) adapted.set(asset.sha256,applyVerifiedPatches(asset.body,snapshot.hash,snapshot.patches));
  return adapted.get(asset.sha256);
}
