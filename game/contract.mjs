export function normalizeGrowId(value) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(value))throw Error('Grow ID: use 3–20 letters, numbers or underscores.');
  return {display:value,key:value.toLowerCase()};
}
export function normalizeWorldName(value) {
  if(typeof value!=='string'||!/^[A-Za-z0-9]{1,24}$/.test(value))throw Error('World: use 1–24 letters or numbers.');
  return value.toUpperCase();
}
export const LIMITS=Object.freeze({width:100,height:60,chatLength:240,editBatch:64,heartbeatMs:20000,onlineTtlMs:60000});
