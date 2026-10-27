const excluded=key=>/^(?:sb-|supabase[.:_-]|gt[_-]|growtopia-cloud:|growtopia-online:)/i.test(key);
export function validateSnapshot(snapshot) {
  if(snapshot?.version!==1 || !snapshot.storage || Array.isArray(snapshot.storage) || typeof snapshot.storage!=='object')throw Error('Unsupported cloud snapshot');
  for(const [key,value] of Object.entries(snapshot.storage)) {
    if(excluded(key)||typeof value!=='string')throw Error('Snapshot contains invalid or reserved data');
  }
  if(new TextEncoder().encode(JSON.stringify(snapshot)).length>10*1024*1024)throw Error('Snapshot exceeds 10 MB');
  return snapshot;
}
export function collectSnapshot(storage) {
  const entries=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key!==null&&!excluded(key))entries.push([key,storage.getItem(key)]);}
  return validateSnapshot({version:1,storage:Object.fromEntries(entries)});
}
export function restoreSnapshot(storage,snapshot) {
  validateSnapshot(snapshot);
  const before=collectSnapshot(storage);
  storage.setItem('growtopia-cloud:restore-backup',JSON.stringify(before));
  const replace=data=>{
    for(const key of Object.keys(collectSnapshot(storage).storage))storage.removeItem(key);
    for(const [key,value] of Object.entries(data.storage))storage.setItem(key,value);
  };
  try{replace(snapshot);}catch(error){replace(before);throw error;}
}
