import {mkdir, readFile, writeFile, rename, appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const ORIGIN = 'https://growtopiasimulator.com';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validatePath(path) {
  if (!path.startsWith('/') || path.startsWith('//')) throw Error('Invalid path');
  let decoded = path.split('?')[0];
  for (let i=0; i<5; i++) {
    if (/[\\\x00-\x1f\x7f]/.test(decoded) || decoded.split('/').some(x => x === '..' || x === '.')) throw Error('Invalid path');
    const next = decodeURIComponent(decoded);
    if (next === decoded) return path;
    decoded = next;
  }
  throw Error('Excessive path encoding');
}

export function adaptHtml(html) {
  return html.replace(/<script\b[^>]*\bsrc=["']https:\/\/static\.cloudflareinsights\.com\/[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script>\/\* the Growtopia Simulator skin[\s\S]*?<\/script>/, '<script>window.GS=1;window.GS2=1;document.documentElement.className="gs v2";document.title="Growtopia Simulator";</script><link rel="stylesheet" href="gs_ui.css?v=b242a3e81c"><link rel="stylesheet" href="gs_ui2.css?v=061c01caf1">')
    .replace("&&/[?&]ui=gs(&|$)/.test(location.search)", '')
    .replace(/((?:href|src|action)\s*=\s*["'])https:\/\/growtopiasimulator\.com\//gi, '$1/');
}

export function createMirror({root, origin = ORIGIN, fetchImpl = fetch, offline = false}) {
  if (origin !== ORIGIN) throw Error('Unsupported upstream origin');
  const inflight = new Map();
  const stats = {cacheHits:0, fetched:0, failures:0, active:0};
  const init = Promise.all([mkdir(join(root,'public'),{recursive:true}), mkdir(join(root,'.cache'),{recursive:true})]);
  const pending = []; let running=0;
  async function slot(job) {
    if (running >= 8) await new Promise(resolve => pending.push(resolve));
    running++;
    try { return await job(); } finally { running--; pending.shift()?.(); }
  }
  async function acquire(path) {
    await init;
    validatePath(path);
    const url = new URL(path, origin);
    if (url.origin !== origin) throw Error('Invalid origin');
    const sourceUrl = url.href;
    const key = digest(sourceUrl);
    const bodyPath = join(root,'public',key);
    const metaPath = join(root,'.cache',`${key}.json`);
    try {
      const meta = JSON.parse(await readFile(metaPath,'utf8'));
      const body = await readFile(bodyPath);
      if (meta.sourceUrl !== sourceUrl || meta.sha256 !== digest(body)) throw Error('Invalid cache entry');
      stats.cacheHits++;
      return {...meta,body};
    } catch (error) {
      if (offline) throw Error(`Not cached for offline use: ${path}`);
    }
    return slot(async () => {
      stats.active++;
      try {
        let current = url;
        let response;
        for (let redirects=0; redirects<6; redirects++) {
          response = await fetchImpl(current.href, {
            redirect:'manual', signal:AbortSignal.timeout(60000),
            headers:{'user-agent':'GrowtopiaLocal/1.0 (local development mirror)',accept:'*/*'},
          });
          if (![301,302,303,307,308].includes(response.status)) break;
          const destination = new URL(response.headers.get('location'),current);
          if (destination.origin !== origin) throw Error('Cross-origin redirect refused');
          current = destination;
          if (redirects === 5) throw Error('Too many redirects');
        }
        if (!response.ok) throw Error(`Upstream HTTP ${response.status}: ${path}`);
        const chunks=[]; let size=0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 256*1024*1024) throw Error('Asset exceeds 256 MiB limit');
          chunks.push(chunk);
        }
        const body=Buffer.concat(chunks);
        const meta={sourceUrl, contentType:response.headers.get('content-type') || 'application/octet-stream', sha256:digest(body), bytes:body.length, acquiredAt:new Date().toISOString()};
        const suffix=`.${randomUUID()}.tmp`;
        await writeFile(bodyPath+suffix,body); await rename(bodyPath+suffix,bodyPath);
        await writeFile(metaPath+suffix,JSON.stringify(meta)); await rename(metaPath+suffix,metaPath);
        stats.fetched++;
        console.log(`Cached ${path} (${body.length} bytes)`);
        return {...meta,body};
      } catch (error) {
        stats.failures++;
        await appendFile(join(root,'.cache','errors.jsonl'),JSON.stringify({path,error:error.message,time:new Date().toISOString()})+'\n');
        throw error;
      } finally { stats.active--; }
    });
  }
  return {stats, get(path) {
    if (!inflight.has(path)) {
      const promise=acquire(path).finally(() => inflight.delete(path));
      inflight.set(path,promise);
    }
    return inflight.get(path);
  }};
}
