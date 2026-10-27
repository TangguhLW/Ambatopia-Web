import http from 'node:http';
import {Readable} from 'node:stream';
import {fetchPublicAsset} from '../game/asset-server.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {validatePath} from '../mirror.mjs';

const root=fileURLToPath(new URL('../deploy/',import.meta.url)).replace(/[\\/]$/,'');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain'};
export function createPreviewServer(){return http.createServer(async(req,res)=>{
  if(!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end();return;}
  try{
    validatePath(req.url);let path=decodeURIComponent(req.url.split('?')[0]);
    if(path==='/api/account'){
      const {handleAccount,createAccountDependencies}=await import('../game/account-server.mjs');
      const origin='http://'+req.headers.host;
      const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>4096){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      let deps;try{deps=createAccountDependencies(process.env,origin);}catch{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({code:'ACCOUNT_CONFIGURATION_REQUIRED',message:'Account backend is not configured on this local preview yet.'}));return;}
      let body=Buffer.concat(chunks);
      if(process.env.ALLOW_LOCAL_BOOTSTRAP==='1'&&req.headers.origin===origin&&req.method==='POST'){
        const data=JSON.parse(body.toString());
        if(data.action==='bootstrap'&&data.growId==='Thaney'){data.bootstrapToken=process.env.THANEY_BOOTSTRAP_TOKEN;body=Buffer.from(JSON.stringify(data));}
      }
      const request=new Request(origin+path,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})});
      const response=await handleAccount(request,deps);res.statusCode=response.status;
      for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
      res.setHeader('set-cookie',response.headers.getSetCookie());res.end(await response.text());return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const tool=path.match(/^\/(set|world|edit)(?:\/|\/index.html)?$/);
    if(tool){const {default:handler}=await import('../deploy/api/tool.mjs');req.url='/api/tool?page='+tool[1];await handler(req,res);return;}
    if(path.startsWith('/api/')||path.startsWith('/.')){res.writeHead(404);res.end();return;}
    if(path==='/cdn-cgi/trace')path='/local-trace.txt';if(path.endsWith('/'))path+='index.html';
    const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('Invalid path');
    const bytes=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','content-length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{
    try{const response=await fetchPublicAsset(req.url);res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD'){await response.body?.cancel();res.end();}else if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();}
    catch{res.writeHead(404);res.end('Not present in deployment snapshot');}
  }
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PORT||4175);
 createPreviewServer().listen(port,'127.0.0.1',()=>console.log(`Game preview: http://localhost:${port}/`));
}
