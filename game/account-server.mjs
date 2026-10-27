import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {normalizeGrowId} from './contract.mjs';

export const cookieNames={access:'gt_access',refresh:'gt_refresh'};
export function readCookies(request) {
  return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(v=>v.trim().split(/=(.*)/s).slice(0,2)).filter(v=>v.length===2));
}
function reply(status,data,cookies=[]) {
  const headers=new Headers({'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'});
  for(const cookie of cookies)headers.append('set-cookie',cookie);
  return new Response(JSON.stringify(data),{status,headers});
}
function sessionCookies(session,secure) {
  const tail=`; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
  return [`gt_access=${session?.access_token||''}; Path=/; Max-Age=${session?3600:0}${tail}`,
    `gt_refresh=${session?.refresh_token||''}; Path=/api/account; Max-Age=${session?2592000:0}${tail}`];
}
export async function handleAccount(request,deps) {
  const origin=new URL(request.url).origin, secure=origin.startsWith('https:');
  if(request.method!=='POST')return reply(405,{code:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('origin')!==deps.origin||origin!==deps.origin)return reply(403,{code:'ORIGIN_REJECTED'});
  try {
    if(Number(request.headers.get('content-length')||0)>4096)return reply(413,{code:'TOO_LARGE'});
    const body=await request.text();if(Buffer.byteLength(body)>4096)return reply(413,{code:'TOO_LARGE'});
    const data=JSON.parse(body);
    if(!data||Array.isArray(data)||Object.keys(data).some(k=>!['action','growId','password','bootstrapToken'].includes(k)))return reply(400,{code:'INVALID_INPUT'});
    const action=data.action,cookies=readCookies(request);
    if(action==='logout'){
      await deps.logout(cookies.gt_access);return reply(200,{ok:true},sessionCookies(null,secure));
    }
    if(action==='session'){
      if(!cookies.gt_refresh)return reply(401,{code:'LOGIN_REQUIRED'},sessionCookies(null,secure));
      try {const result=await deps.refresh(cookies.gt_refresh);return success(result,secure);}catch{return reply(401,{code:'LOGIN_REQUIRED'},sessionCookies(null,secure));}
    }
    if(!['login','signup','bootstrap'].includes(action))return reply(400,{code:'INVALID_ACTION'});
    const name=normalizeGrowId(data.growId);
    if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)return reply(400,{code:'INVALID_PASSWORD',message:'Password: use 10–128 characters.'});
    if(action==='signup'&&name.key==='thaney')return reply(400,{code:'NAME_RESERVED',message:'Grow ID reserved.'});
    if(action==='bootstrap'&&(name.key!=='thaney'||!deps.bootstrapAllowed?.(data.bootstrapToken)))return reply(403,{code:'BOOTSTRAP_DENIED'});
    if(!await deps.rate(action,name.key,request))return reply(429,{code:'RATE_LIMITED',message:'Too many attempts. Try again later.'});
    try {
      const result=action==='login'?await deps.login(name.key,data.password):await deps.signup(name.display,data.password,action==='bootstrap');
      return success(result,secure);
    } catch {
      return reply(action==='login'?401:409,{code:action==='login'?'INVALID_CREDENTIALS':'SIGNUP_FAILED',message:action==='login'?'Grow ID or password incorrect.':'Account could not be created. Choose another Grow ID or try again.'});
    }
  }catch{return reply(400,{code:'INVALID_INPUT',message:'Invalid account request.'});}
}
function success({profile,session},secure) {
  return reply(200,{profile,accessToken:session.access_token,expiresAt:session.expires_at},sessionCookies(session,secure));
}
function unwrap({data,error}){if(error)throw error;return data;}
export function createAccountDependencies(env,origin) {
  for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ACCOUNT_RATE_SALT'])if(!env[name])throw Error('ACCOUNT_CONFIGURATION_REQUIRED');
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
  const userClient=()=>createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
  async function activate(session){
    const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
    unwrap(await admin.rpc('game_activate_session',{p_user:claims.sub,p_session:claims.session_id}));
  }
  async function profileFor(session,recordLogin=false) {
    const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{...options,global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
    return unwrap(await client.rpc(recordLogin?'game_record_login':'game_me'));
  }
  return {
    origin,
    bootstrapAllowed(token){const expected=env.THANEY_BOOTSTRAP_TOKEN;if(!expected||typeof token!=='string')return false;const a=Buffer.from(token),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);},
    async rate(action,key,request){
      // Trust Vercel's overwritten network header, never a client-supplied forwarded-for chain.
      const source=request.headers.get('x-vercel-forwarded-for')||'local';
      const hash=value=>createHmac('sha256',env.ACCOUNT_RATE_SALT).update(value).digest('hex');
      const signup=action!=='login';
      const bySource=unwrap(await admin.rpc('game_rate',{p_bucket:action+':ip:'+hash(source),p_seconds:signup?3600:60,p_limit:signup?5:10}));
      const byName=unwrap(await admin.rpc('game_rate',{p_bucket:action+':name:'+hash(key),p_seconds:60,p_limit:10}));
      return bySource&&byName;
    },
    async signup(growId,password,isAdmin){
      const email=randomUUID()+'@account.growtopia.invalid';
      const created=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true}));
      try {
        unwrap(await admin.rpc('game_register',{p_id:created.user.id,p_grow_id:growId,p_email:email,p_admin:isAdmin}));
      }catch(error){await admin.auth.admin.deleteUser(created.user.id);throw error;}
      const {session}=unwrap(await userClient().auth.signInWithPassword({email,password}));
      await activate(session);
      return {session,profile:await profileFor(session,true)};
    },
    async login(key,password){
      const row=unwrap(await admin.from('game_account_identities').select('auth_email').eq('grow_key',key).maybeSingle());
      // Auth handles password verification, including invalid account lookups.
      const {session}=unwrap(await userClient().auth.signInWithPassword({email:row?.auth_email||'missing@account.growtopia.invalid',password}));
      await activate(session);
      return {session,profile:await profileFor(session,true)};
    },
    async refresh(refresh_token){const {session}=unwrap(await userClient().auth.refreshSession({refresh_token}));return {session,profile:await profileFor(session)};},
    async logout(access){if(access){const {data}=await admin.auth.getUser(access);if(data.user)unwrap(await admin.rpc('game_revoke_sessions',{p_user:data.user.id}));await admin.auth.admin.signOut(access,'global');}}
  };
}
