import assert from 'node:assert/strict';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('cloud/config.json',root)));
const make=()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
const a=make(),b=make(),publicClient=make();
const unwrap=result=>{if(result.error)throw result.error;return result.data;};
let userA,userB,object;const checks=[];
try{
  userA=unwrap(await a.auth.signInAnonymously()).user;userB=unwrap(await b.auth.signInAnonymously()).user;
  assert.notEqual(userA.id,userB.id);checks.push('Two distinct guest users authenticate');
  unwrap(await a.from('app_snapshots').upsert({user_id:userA.id,payload:{version:1,storage:{world:'SUPABASE-ISOLATION-QA'}}}));
  assert.equal(unwrap(await a.from('app_snapshots').select('payload').eq('user_id',userA.id).single()).payload.storage.world,'SUPABASE-ISOLATION-QA');
  checks.push('Owner can save and read snapshot');
  assert.equal(unwrap(await b.from('app_snapshots').select('payload').eq('user_id',userA.id).maybeSingle()),null);
  assert.ok((await b.from('app_snapshots').upsert({user_id:userA.id,payload:{version:1,storage:{world:'WRONG-USER'}}})).error);
  assert.ok((await publicClient.from('app_snapshots').select('user_id')).error);
  checks.push('Other users and unsigned requests cannot read or overwrite snapshot');
  const png=await readFile(new URL('verification/fixtures/quadrants.png',root));object=userA.id+'/'+randomUUID()+'.png';
  unwrap(await a.storage.from('simulator-user-files').upload(object,png,{contentType:'image/png'}));
  const download=unwrap(await a.storage.from('simulator-user-files').download(object));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);
  assert.ok((await b.storage.from('simulator-user-files').download(object)).error);
  checks.push('Private file roundtrip preserves bytes and refuses another user');
  const expected=(await readdir(new URL('.cache/',root))).filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).length;
  const inventory=await publicClient.from('asset_manifest').select('path',{count:'exact',head:true});unwrap(inventory);assert.equal(inventory.count,expected);
  checks.push(`Public asset inventory contains ${expected} records`);
  await writeFile(new URL('verification/supabase.report.json',root),JSON.stringify({checkedAt:new Date().toISOString(),project:'pfxgouprvgvtfcnqmqsh',passed:true,checks},null,2));
  for(const check of checks)console.log('PASS: '+check);
}finally{
  if(object){const result=await a.storage.from('simulator-user-files').remove([object]);if(result.error)console.error('QA file cleanup failed: '+result.error.message);}
  if(userA){const result=await a.from('app_snapshots').delete().eq('user_id',userA.id);if(result.error)console.error('QA snapshot cleanup failed: '+result.error.message);}
  await a.auth.signOut();await b.auth.signOut();
}
