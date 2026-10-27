import {handleAccount,createAccountDependencies} from '../game/account-server.mjs';

export default async function handler(req,res) {
  const allowed=[process.env.APP_ORIGIN,'https://ambatopia.vercel.app','https://growtopia-clone.vercel.app','https://growtopia-clone-thang-94e1.vercel.app',...[process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host=>'https://'+host)];
  const origin=req.headers.origin;
  if(!allowed.includes(origin)){res.statusCode=403;res.end('Origin rejected');return;}
  try {
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.statusCode=413;res.end();return;}chunks.push(chunk);}
    const request=new Request(origin+'/api/account',{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
    const response=await handleAccount(request,createAccountDependencies(process.env,origin));
    res.statusCode=response.status;
    for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
    res.end(await response.text());
  }catch{res.statusCode=503;res.setHeader('cache-control','no-store');res.end(JSON.stringify({code:'ACCOUNT_UNAVAILABLE',message:'Account service temporarily unavailable.'}));}
}
