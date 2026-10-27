import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMirror, adaptHtml} from '../mirror.mjs';
import {applyVerifiedPatches} from '../compatibility.mjs';

async function rootFor(t) {
  const root = await mkdtemp(join(tmpdir(), 'growtopia-mirror-test-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  return root;
}
test('concurrent fetches deduplicate and persisted bytes work offline with source digest', async t => {
  const root = await rootFor(t); let calls = 0;
  const mirror = createMirror({root, fetchImpl: async () => { calls++; return new Response('sprite', {headers:{'content-type':'image/png'}}); }});
  const [a,b] = await Promise.all([mirror.get('/set/a.png?v=1'), mirror.get('/set/a.png?v=1')]);
  assert.equal(calls, 1); assert.deepEqual(a.body,b.body);
  assert.equal(a.sha256, createHash('sha256').update('sprite').digest('hex'));
  assert.equal(a.sourceUrl, 'https://growtopiasimulator.com/set/a.png?v=1');
  const offline = createMirror({root, fetchImpl:async () => {throw Error('offline');}});
  assert.equal((await offline.get('/set/a.png?v=1')).body.toString(), 'sprite');
});
test('query versions do not collide, failed requests do not poison cache', async t => {
  const root = await rootFor(t); let fail = true;
  const mirror = createMirror({root, fetchImpl:async url => {
    if (fail) return new Response('failure', {status:503});
    return new Response(new URL(url).search);
  }});
  await assert.rejects(mirror.get('/data?v=1'));
  fail = false;
  assert.equal((await mirror.get('/data?v=1')).body.toString(), '?v=1');
  assert.equal((await mirror.get('/data?v=2')).body.toString(), '?v=2');
  assert.ok((await readdir(join(root, 'public'))).every(x => !x.endsWith('.tmp')));
});
test('refuses cross-origin redirects and never sends browser credentials', async t => {
  const root = await rootFor(t); let options;
  const mirror = createMirror({root, fetchImpl:async (url, opts) => {
    options=opts; return new Response('', {status:302, headers:{location:'https://other.example/private'}});
  }});
  await assert.rejects(mirror.get('/file'), /origin/i);
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.cookie, undefined); assert.equal(options.headers.authorization,undefined);
});
test('HTML drops analytics, keeps attribution and script version, and localizes own-origin links', () => {
  const html = '<p>Fan-made site. Ubisoft.</p><script src="app.js?v=123"></script><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/123"></script><a href="https://growtopiasimulator.com/world/">World</a>';
  const result = adaptHtml(html);
  assert.ok(!result.includes('cloudflareinsights'));
  assert.ok(result.includes('Fan-made site. Ubisoft.'));
  assert.ok(result.includes('app.js?v=123'));
  assert.ok(result.includes('href="/world/"'));
});
test('localhost enables the existing GS skin without a query flag', () => {
  const html="(h==='localhost'||h==='127.0.0.1')&&/[?&]ui=gs(&|$)/.test(location.search)";
  assert.equal(adaptHtml(html),"(h==='localhost'||h==='127.0.0.1')");
});
test('compatibility patches refuse changed source and preserve original bytes elsewhere', () => {
  const code=Buffer.from('const a=HOST,b=CHECK;');
  const hash=createHash('sha256').update(code).digest('hex');
  assert.equal(applyVerifiedPatches(code,hash,[{start:8,end:12,text:'"original"'},{start:15,end:20,text:'()=>0'}]).toString(),'const a="original",b=()=>0;');
  assert.throws(()=>applyVerifiedPatches(Buffer.from('changed'),hash,[]),/hash/i);
});
