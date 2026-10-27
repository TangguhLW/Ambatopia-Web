import {createClient} from '@supabase/supabase-js';
import {authorizeTool} from '../game/tool-server.mjs';
import config from '../cloud/config.json' with {type:'json'};
// The build substitutes the three authenticated HTML documents into this function.
const pages=typeof TOOL_PAGES==='undefined'?{}:TOOL_PAGES;
export default async function handler(req,res) {
 if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
 const path=req.query?.page||new URL(req.url,'https://local.invalid').searchParams.get('page');
 if(!['set','world','edit'].includes(path)){res.statusCode=404;res.end();return;}
 const request=new Request('https://local.invalid/'+path+'/',{headers:req.headers});
 const denied=await authorizeTool(request,async access=>{
  const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+access}}});
  const {data,error}=await client.rpc('game_me');if(error)throw error;return data;
 });
 res.setHeader('cache-control','private, no-store');res.setHeader('x-content-type-options','nosniff');
 if(denied){res.statusCode=denied.status;res.setHeader('location',denied.headers.get('location'));res.end();return;}
 res.setHeader('content-type','text/html; charset=utf-8');res.end(pages[path]||'Tool unavailable');
}
