import {createClient} from '@supabase/supabase-js';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url)),envPath=join(root,'.env.online.local');process.loadEnvFile(envPath);
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.from('game_profiles').select('grow_id,role').eq('role','superadmin');
if(error||data?.length!==1||data[0].grow_id!=='Thaney')throw Error('Verify the unique Thaney superadmin before disabling bootstrap.');
const cli=join(process.env.APPDATA,'npm','node_modules','vercel','dist','vc.js');
for(const target of ['production','preview'])await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[cli,'env','rm','THANEY_BOOTSTRAP_TOKEN',target,'--yes','--scope','thang-94e1','--cwd',join(root,'deploy'),'--global-config',join(root,'.vercel-thang')],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',chunk=>output=(output+chunk).slice(-3000));child.stderr.on('data',chunk=>output=(output+chunk).slice(-3000));child.on('error',reject);child.on('exit',code=>code===0||output.includes('"reason": "env_not_found"')?resolve():reject(Error('Bootstrap removal failed for '+target+': '+output)));
});
const env=(await readFile(envPath,'utf8')).split(/\r?\n/).filter(line=>!line.startsWith('THANEY_BOOTSTRAP_TOKEN=')&&!line.startsWith('ALLOW_LOCAL_BOOTSTRAP='));await writeFile(envPath,env.join('\n'));
console.log('Verified Thaney is the sole superadmin; remote and local bootstrap credentials removed.');
