import {createClient} from '@supabase/supabase-js';
import config from '../cloud/config.json';
import {browserSession} from './session.mjs';
export function createGameApi(session=browserSession()) {
 const client=createClient(config.url,config.publishableKey,{
  accessToken:()=>session.getAccessToken(),
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(20000),...(init.signal?[init.signal]:[])])})}
 });
 async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data;}
 return {client,rpc,session};
}
