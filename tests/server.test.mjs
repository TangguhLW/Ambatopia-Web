import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createLocalServer } from '../server.mjs';

async function fixture(t) {
  const paths = [];
  const mirror = { async get(path) {
    paths.push(path);
    if (path === '/bad') throw new Error('upstream unavailable');
    return { body: Buffer.from('body'), contentType: 'application/javascript', sha256: 'abc' };
  } };
  const server = createLocalServer({ mirror });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  function request(path, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: {host} }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject); req.end();
    });
  }
  return { request, paths };
}

test('serves GET and HEAD with original MIME and query identity', async t => {
  const { request, paths } = await fixture(t);
  const get = await request('/set/fixture.js?v=1');
  assert.equal(get.status, 200); assert.equal(get.body, 'body');
  assert.equal(get.headers['content-type'], 'application/javascript');
  assert.equal((await request('/set/fixture.js?v=2', { method:'HEAD' })).body, '');
  assert.deepEqual(paths, ['/set/fixture.js?v=1', '/set/fixture.js?v=2']);
});
test('rejects mutations, nonlocal hosts, absolute URLs and traversal before mirror access', async t => {
  const { request, paths } = await fixture(t);
  assert.equal((await request('/set/', {method:'POST'})).status, 405);
  assert.equal((await request('/set/', {host:'attacker.example'})).status, 403);
  for (const path of ['/../secret', '/%2e%2e/secret', '/%252e%252e/secret', '/a/%2f../secret', '/a%5c..%5csecret', 'https://other.example/a', '//other.example/a', '/%ZZ']) {
    assert.equal((await request(path)).status, 400, path);
  }
  assert.deepEqual(paths, []);
});
test('root redirects locally and upstream failures return bounded errors', async t => {
  const {request} = await fixture(t);
  const root = await request('/');
  assert.equal(root.status, 302); assert.equal(root.headers.location, '/set/');
  const bad = await request('/bad');
  assert.equal(bad.status, 502); assert.ok(bad.body.length < 1000);
});
test('country lookup stays local and does not persist an IP trace',async t=>{
  const {request,paths}=await fixture(t);
  const result=await request('/cdn-cgi/trace');
  assert.equal(result.status,200);assert.equal(result.body,'loc=XX\n');
  assert.deepEqual(paths,[]);
});
