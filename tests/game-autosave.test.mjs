import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutosave} from '../game/autosave.mjs';
test('autosave acknowledges only the version actually persisted and retries failures',async()=>{
 let value={world:'one'},fail=true;const statuses=[],written=[];
 const saver=createAutosave({collect:()=>value,persist:async data=>{if(fail)throw Error('offline');written.push(data);},status:s=>statuses.push(s)});
 await saver.flush();assert.equal(statuses.at(-1).state,'error');
 fail=false;await saver.flush();assert.deepEqual(written,[{world:'one'}]);assert.equal(statuses.at(-1).state,'saved');
 await saver.flush();assert.equal(written.length,1);
 value={world:'two'};await saver.flush();assert.equal(written.length,2);
});
