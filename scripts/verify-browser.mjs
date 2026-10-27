import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const browser=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const cli=join(process.env.APPDATA || '', 'npm/node_modules/rea-agents/scripts/rea.mjs');
if(!browser || !existsSync(cli)) throw Error('Browser QA requires installed REA and Chrome/Edge; set BROWSER_PATH if needed.');
const origin=process.env.QA_ORIGIN || 'http://localhost:4174';
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)) throw Error('QA_ORIGIN must be loopback HTTP');
const out=join(root,'verification');
await mkdir(out,{recursive:true});
const css=selector=>({kind:'css',selector});
const role=(role,name)=>({kind:'role',role,name});
const wait=(id,locator)=>({step_id:id,action:'wait_for',locator,state:'visible',timeout_ms:45000});
const click=(id,locator)=>({step_id:id,action:'click',locator,timeout_ms:15000});
const fill=(id,selector,value)=>({step_id:id,action:'fill',locator:css(selector),value:{source:'literal',value},timeout_ms:15000});
const settle={step_id:'render',action:'wait_for_timeout',duration_ms:3000};
const cases={
  set:[wait('items-ready',role('button','All 4083')),click('dismiss',role('button','Close')),fill('search','#g2-q','Top Hat'),wait('result',css('button[title="Top Hat (Hat)"]')),click('equip',css('button[title="Top Hat (Hat)"]')),settle],
  world:[wait('world-ready',role('checkbox','Invincible (lava, spikes...)')),click('dismiss',role('button','Close')),click('preset',role('button','Mars Blast')),settle],
  edit:[wait('tiles-ready',css('#slots button:first-child')),fill('name','#wname','OFFLINEQA'),settle],
};
async function run(name,actions) {
  const scenario={browser:{mode:'launch',executable_path:browser,headless:true},start_url:{url:origin+'/'+name+'/'},environment:{viewport:{width:1280,height:720,device_scale_factor:1},timezone:'Asia/Bangkok'},actions,capture:{at_end:['url','dom','screenshot'],events:['console','page-errors','network']}};
  const scenarioPath=join(out,name+'.scenario.json');
  await writeFile(scenarioPath,JSON.stringify(scenario,null,2));
  const output=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,'capture-browser-scenario',scenarioPath,'--format','json'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const chunks=[];let stderr='';let size=0;
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>32*1024*1024){child.kill();reject(Error('REA output exceeded 32 MiB'));}else chunks.push(chunk);});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
    child.on('error',reject);
    child.on('exit',code=>{if(code!==0)reject(Error(`REA ${name} exited ${code}: ${stderr}`));else resolve(Buffer.concat(chunks).toString());});
  });
  const evidence=JSON.parse(output);
  await writeFile(join(out,name+'.evidence.json'),JSON.stringify(evidence));
  if(evidence.error)throw Error(`${name}: ${evidence.message || evidence.error}`);
  const result=evidence.normalized_result;
  const last=result.steps.at(-1);
  const image=last.artifacts.screenshot.value;
  if(image?.data_base64) await writeFile(join(out,name+'.png'),Buffer.from(image.data_base64,'base64'));
  const events=result.events.items;
  const failures=events.filter(e=>e.status>=400 || e.kind==='request-failed' || (e.kind==='console' && e.level==='error') || e.kind==='page-error');
  const failedSteps=result.steps.filter(step=>step.status!=='completed');
  const finalUrl=last.after_url.url;
  const ok=!failedSteps.length && !failures.length && finalUrl.startsWith(origin+'/'+name+'/') && image?.bytes>10000;
  const report={page:name,passed:ok,url:finalUrl,steps:result.steps.map(s=>({id:s.step_id,status:s.status,error:s.error})),failures,screenshotBytes:image?.bytes,evidenceId:evidence.evidence_id};
  await writeFile(join(out,name+'.report.json'),JSON.stringify(report,null,2));
  console.log(`${name}: ${ok?'PASS':'FAIL'}, ${result.steps.length} steps, ${failures.length} network/console failures, screenshot ${image?.bytes || 0} bytes`);
  return report;
}
const results=await Promise.allSettled(Object.entries(cases).map(([name,actions])=>run(name,actions)));
let failed=false;
for(const result of results) {if(result.status==='rejected'){failed=true;console.error(result.reason.message);}else if(!result.value.passed)failed=true;}
await writeFile(join(out,'summary.json'),JSON.stringify(results.map(r=>r.status==='fulfilled'?r.value:{passed:false,error:r.reason.message}),null,2));
if(failed)process.exitCode=1;
