import http from 'node:http';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createMirror, validatePath, adaptHtml} from './mirror.mjs';
import {adaptBundle} from './compatibility.mjs';

export function createLocalServer({mirror}) {
  return http.createServer(async (req,res) => {
    const reply = (status, body, headers={}) => {
      res.writeHead(status, {'content-type':'text/plain; charset=utf-8',...headers});
      res.end(req.method==='HEAD' ? undefined : body);
    };
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(req.headers.host || '')) return reply(403,'Local hosts only');
    if (!['GET','HEAD'].includes(req.method)) return reply(405,'GET and HEAD only',{allow:'GET, HEAD'});
    const site=req.headers['sec-fetch-site'];
    if (site==='cross-site') return reply(403,'Cross-site requests refused');
    try { validatePath(req.url); } catch { return reply(400,'Invalid resource path'); }
    if (req.url==='/') return reply(302,'Open /set/',{location:'/set/'});
    if (req.url==='/_local/status') return reply(200,JSON.stringify(mirror.stats || {}),{'content-type':'application/json'});
    if (req.url==='/cdn-cgi/trace') return reply(200,'loc=XX\n');
    try {
      const asset = await mirror.get(req.url);
      const html=asset.contentType.includes('text/html');
      const body=html ? Buffer.from(adaptHtml(asset.body.toString('utf8'))) : adaptBundle(req.url,asset);
      reply(200,body,{'content-type':asset.contentType,'content-length':body.length,'cache-control':'no-cache','x-content-type-options':'nosniff'});
    } catch (error) {
      console.error(`Failed ${req.url}: ${error.message}`);
      reply(502,`Local mirror could not load this public resource. Check your connection or cache.\n${error.message.slice(0,500)}`);
    }
  });
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=dirname(fileURLToPath(import.meta.url));
  const mirror=createMirror({root,offline:process.env.OFFLINE==='1'});
  const port=Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('Invalid PORT');
  const server=createLocalServer({mirror});
  server.listen(port,'127.0.0.1',() => console.log(`Growtopia local: http://127.0.0.1:${port}/set/\nWorld: http://127.0.0.1:${port}/world/\nEditor: http://127.0.0.1:${port}/edit/\nMode: ${process.env.OFFLINE==='1'?'offline':'cached public assets, online on cache miss'}`));
  server.on('error',error => {console.error(error.message);process.exitCode=1;});
}
