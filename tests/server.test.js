'use strict';

// Exercise the real HTTP routes with an injected upstream. These tests never
// send anything to HIBP, and all sample prefixes/passwords are public fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createServer, PUBLIC_CONFIG } = require('../server.js');

const RANGE = 'A'.repeat(35) + ':42\r\n' + 'B'.repeat(35) + ':0\r\n';
const rangeResponse = () => new Response(RANGE, { status: 200, headers: { 'Content-Type': 'text/plain' } });
async function fixture(t, options = {}) {
  const server = createServer({ fetchImpl: async () => rangeResponse(), ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const origin = new URL(url).origin;
    const rawPath = url.slice(origin.length) || '/';
    const req = http.request(origin, { ...options, path: rawPath }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

test('health and public settings return JSON with privacy/security headers', async t => {
  let upstreamCalls = 0;
  const { url } = await fixture(t, { fetchImpl: async () => { upstreamCalls++; return rangeResponse(); } });
  const health = await request(url + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), { ok: true, service: 'crackproof', passwordProcessing: 'client-side' });
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');
  assert.equal(health.headers['referrer-policy'], 'no-referrer');
  assert.match(health.headers['content-security-policy'], /connect-src 'self' https:\/\/api\.pwnedpasswords\.com/);
  assert.equal(health.headers['access-control-allow-origin'], undefined);
  const config = await request(url + '/api/config');
  assert.equal(config.status, 200);
  assert.deepEqual(JSON.parse(config.body), { version: 1, config: PUBLIC_CONFIG });
  assert.equal(JSON.parse(config.body).config.quickAttackers[2].speed, 1e14);
  const head = await request(url + '/api/health', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(upstreamCalls, 0);
});

test('range proxy sends only the uppercased five-character prefix to the fixed endpoint', async t => {
  let sent;
  const { url } = await fixture(t, { fetchImpl: async (upstream, options) => {
    sent = { upstream, options }; return rangeResponse();
  } });
  const response = await request(url + '/api/breach/5baa6');
  assert.equal(response.status, 200);
  assert.equal(response.body, RANGE);
  assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(sent.upstream, 'https://api.pwnedpasswords.com/range/5BAA6');
  assert.equal(sent.options.headers['Add-Padding'], 'true');
  assert.equal(sent.options.redirect, 'error');
  assert.equal(sent.options.credentials, 'omit');
  assert.equal(sent.options.body, undefined);
  assert.ok(sent.options.signal instanceof AbortSignal);
});

test('rejects full hashes, passwords, query strings, injected destinations and invalid prefixes before fetch', async t => {
  let upstreamCalls = 0;
  const { url } = await fixture(t, { fetchImpl: async () => { upstreamCalls++; return rangeResponse(); } });
  const bad = [
    '/api/breach/5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8',
    '/api/breach/password', '/api/breach/ZZZZZ', '/api/breach/1234',
    '/api/breach/123456', '/api/breach/5BAA6/extra',
    '/api/breach/5BAA6?password=public-example', '/api/breach/5BAA6?',
    '/api/breach/https://example.com', '/api/breach/%35BAA6',
    '/api/health?anything=1', '/api/config?password=public-example'
  ];
  for (const route of bad) {
    const response = await request(url + route);
    assert.equal(response.status, 400, route);
    assert.ok(!response.body.includes('public-example'));
    assert.ok(!response.body.includes('5BAA6'));
  }
  assert.equal(upstreamCalls, 0);
});

test('rejects mutation methods and GET payloads without processing them', async t => {
  let upstreamCalls = 0;
  const { url } = await fixture(t, { fetchImpl: async () => { upstreamCalls++; return rangeResponse(); } });
  const post = await request(url + '/api/breach/5BAA6', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"public-example"}'
  });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.ok(!post.body.includes('public-example'));
  const getBody = await request(url + '/api/breach/5BAA6', {
    method: 'GET', headers: { 'Content-Length': '14' }, body: 'public-example'
  });
  assert.equal(getBody.status, 400);
  const head = await request(url + '/api/breach/5BAA6', { method: 'HEAD' });
  assert.equal(head.status, 405);
  assert.equal(head.headers.allow, 'GET');
  assert.equal(upstreamCalls, 0);
});

test('upstream errors and malformed ranges become generic unavailable responses', async t => {
  for (const fetchImpl of [
    async () => { throw new Error('private upstream diagnostic'); },
    async () => new Response('upstream error', { status: 500 }),
    async () => new Response('<html>not a range</html>'),
    async () => new Response('A'.repeat(35) + ':9007199254740993'),
    async () => new Response('')
  ]) {
    const { url } = await fixture(t, { fetchImpl });
    const response = await request(url + '/api/breach/5BAA6');
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(response.body), { error: 'Breach lookup unavailable.' });
  }
});

test('upstream failures abort unread error bodies', async t => {
  let signal;
  const { url } = await fixture(t, { fetchImpl: async (_, options) => {
    signal = options.signal;
    return new Response('error body', { status: 500 });
  } });
  assert.equal((await request(url + '/api/breach/5BAA6')).status, 503);
  assert.equal(signal.aborted, true);
});

test('limits the decompressed upstream response body', async t => {
  const { url } = await fixture(t, { maxResponseBytes: 40 });
  const response = await request(url + '/api/breach/5BAA6');
  assert.equal(response.status, 503);
});

test('times out and aborts even if an injected upstream does not reject on abort', async t => {
  let signal;
  const { url } = await fixture(t, { upstreamTimeoutMs: 20, fetchImpl: async (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } });
  const response = await request(url + '/api/breach/5BAA6');
  assert.equal(response.status, 504);
  assert.equal(signal.aborted, true);
  assert.deepEqual(JSON.parse(response.body), { error: 'Breach lookup timed out.' });
});

test('rate limits by TCP peer, ignores forwarding-header spoofing, and expires counters', async t => {
  let now = 1000;
  let calls = 0;
  const { url } = await fixture(t, { rateLimit: 1, rateWindowMs: 2000, clock: () => now,
    fetchImpl: async () => { calls++; return rangeResponse(); } });
  assert.equal((await request(url + '/api/breach/5BAA6', { headers: { 'X-Forwarded-For': '1.2.3.4' } })).status, 200);
  const limited = await request(url + '/api/breach/ABCDE', { headers: { 'X-Forwarded-For': '5.6.7.8' } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['retry-after'], '2');
  assert.equal(calls, 1);
  assert.equal((await request(url + '/api/health')).status, 200);
  now = 3001;
  assert.equal((await request(url + '/api/breach/ABCDE')).status, 200);
  assert.equal(calls, 2);
});

test('caps simultaneous upstream lookups and recovers the slot afterward', async t => {
  let finish;
  let started;
  let calls = 0;
  const ready = new Promise(resolve => { started = resolve; });
  const { url } = await fixture(t, { maxConcurrent: 1, fetchImpl: async () => {
    calls++;
    if (calls > 1) return rangeResponse();
    started(); return new Promise(resolve => { finish = () => resolve(rangeResponse()); });
  } });
  const first = request(url + '/api/breach/5BAA6');
  await ready;
  const busy = await request(url + '/api/breach/ABCDE');
  assert.equal(busy.status, 503);
  assert.equal(busy.headers['retry-after'], '1');
  finish();
  assert.equal((await first).status, 200);
  assert.equal((await request(url + '/api/breach/ABCDE')).status, 200);
  assert.equal(calls, 2);
  assert.equal((await request(url + '/api/health')).status, 200);
});

test('serves only explicit public files and supports the browser self-test URL', async t => {
  const { url } = await fixture(t);
  for (const route of ['/', '/index.html', '/index.html?selftest=1', '/README.md', '/DEMO_SCRIPT.md', '/DEPLOY.md']) {
    const response = await request(url + route);
    assert.equal(response.status, 200, route);
    assert.ok(response.body.length > 0);
  }
  const head = await request(url + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  for (const route of ['/server.js', '/package.json', '/.env', '/.git/config', '/tests/server.test.js', '/%2e%2e/.git/config', '/api/missing', '/index.html?password=public-example']) {
    assert.equal((await request(url + route)).status, 404, route);
  }
});

test('invalid server limits fail before opening a socket', () => {
  assert.throws(() => createServer({ maxConcurrent: 0 }), /Invalid server limit/);
  assert.throws(() => createServer({ fetchImpl: null }), /Invalid server dependency/);
});
