import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
process.loadEnvFile(join(root,'.env.online.local'));
const cli=join(process.env.APPDATA,'npm','node_modules','vercel','dist','vc.js');
const privateValues=['SUPABASE_SERVICE_ROLE_KEY','ACCOUNT_RATE_SALT','THANEY_BOOTSTRAP_TOKEN'].map(key=>process.env[key]).filter(Boolean);
const redact=value=>privateValues.reduce((text,secret)=>text.replaceAll(secret,'[REDACTED]'),value);
for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ACCOUNT_RATE_SALT','THANEY_BOOTSTRAP_TOKEN','APP_ORIGIN']){
 const value=name==='APP_ORIGIN'?'https://growtopia-clone.vercel.app':process.env[name];if(!value)throw Error('Missing '+name);
 const args=['env','add',name,'production,preview','--type',privateValues.includes(value)?'secret':'config','--yes','--force','--project','growtopia-clone','--scope','thang-94e1','--global-config',join(root,'.vercel-thang')];
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';
  child.stdout.on('data',chunk=>{output=(output+chunk).slice(-6000);});child.stderr.on('data',chunk=>{output=(output+chunk).slice(-6000);});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(redact(output))));child.stdin.end(value+'\n');
 });
 console.log(name+': configured (value hidden)');
}
