'use strict';

// CRACKPROOF's optional server never receives a password or full hash.
// It serves the app and forwards only a validated five-hex SHA-1 prefix.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PUBLIC_CONFIG = Object.freeze({
  speeds: Object.freeze({ onlineLimited: 100 / 3600, onlineUnlimited: 1000,
    md5: 1.5e11, ntlm: 2.5e11, sha1: 4.9e10, sha256: 2.1e10,
    bcrypt: 1.4e3, argon2id: 100 }),
  quickAttackers: Object.freeze([
    Object.freeze({ id: 'online', name: 'Online attack', speed: 100, assumption: '100 guesses / second' }),
    Object.freeze({ id: 'gpu', name: 'Offline fast hash · GPU rig', speed: 1e10, assumption: '10 billion guesses / second' }),
    Object.freeze({ id: 'cluster', name: 'Massive cracking cluster', speed: 1e14, assumption: '100 trillion guesses / second' })
  ]),
  hardware: Object.freeze({ single: 1, rig: 8, cluster: 1000 }),
  secondsPerYear: 365.25 * 86400,
  universeYears: 13.8e9,
  maxLength: 256
});

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://api.pwnedpasswords.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/README.md', ['README.md', 'text/plain; charset=utf-8']],
  ['/DEMO_SCRIPT.md', ['DEMO_SCRIPT.md', 'text/plain; charset=utf-8']],
  ['/DEPLOY.md', ['DEPLOY.md', 'text/plain; charset=utf-8']]
]);
const HEALTH = Object.freeze({ ok: true, service: 'crackproof', passwordProcessing: 'client-side' });

function secureHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
}

// Bound the decompressed upstream body as well as its Content-Length header.
// This avoids buffering arbitrarily large or non-range responses into memory.
async function readRange(response, controller, maxBytes) {
  if (!response || !response.ok || !response.body || typeof response.body.getReader !== 'function') {
    throw new Error('unavailable');
  }
  const contentLength = response.headers?.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) throw new Error('unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        await reader.cancel().catch(() => {});
        throw new Error('unavailable');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }
  const body = chunks.join('');
  const lines = body.trim().split(/\r?\n/);
  if (!body.trim() || !lines.every(line => {
    const match = /^([a-fA-F0-9]{35}):(0|[1-9]\d*)$/.exec(line);
    return match && Number.isSafeInteger(Number(match[2]));
  })) throw new Error('unavailable');
  return body;
}

function createServer(options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    rootDir = __dirname,
    upstreamTimeoutMs = 3500,
    maxResponseBytes = 2 * 1024 * 1024,
    maxConcurrent = 8,
    rateLimit = 30,
    rateWindowMs = 60_000,
    maxClients = 10_000,
    clock = Date.now
  } = options;
  for (const value of [upstreamTimeoutMs, maxResponseBytes, maxConcurrent, rateLimit, rateWindowMs, maxClients]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid server limit.');
  }
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new Error('Invalid server dependency.');

  // Only rate-limit counters are retained: never prefixes, hashes or passwords.
  // Use the actual TCP peer; untrusted forwarding headers cannot bypass limits.
  const clients = new Map();
  let activeUpstreams = 0;
  function allowLookup(peer) {
    const now = clock();
    // Expire buckets on each lookup; no process timers remain after server.close.
    for (const [ip, bucket] of clients) if (bucket.resetAt <= now) clients.delete(ip);
    let bucket = clients.get(peer);
    if (!bucket) {
      if (clients.size >= maxClients) return Math.max(1, Math.ceil(rateWindowMs / 1000));
      bucket = { count: 0, resetAt: now + rateWindowMs };
      clients.set(peer, bucket);
    }
    if (bucket.count >= rateLimit) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    bucket.count++;
    return 0;
  }

  return http.createServer({ maxHeaderSize: 8192, requestTimeout: 10_000, headersTimeout: 10_000 }, async (req, res) => {
    secureHeaders(res);
    function json(status, value) {
      if (res.destroyed || res.writableEnded) return;
      const body = JSON.stringify(value);
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(body));
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    function rejectBody() {
      // Discard rather than collect any unsupported request payload. Close this
      // connection so a declared large body cannot keep the server occupied.
      res.setHeader('Connection', 'close');
      req.resume();
    }
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        rejectBody();
        return json(405, { error: 'Only GET and HEAD are supported.' });
      }
      if (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
        rejectBody();
        return json(400, { error: 'Request bodies are not accepted.' });
      }
      const raw = req.url || '';
      if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('#') || raw.includes('\\')) {
        return json(400, { error: 'Invalid request path.' });
      }
      const split = raw.indexOf('?');
      const pathname = split < 0 ? raw : raw.slice(0, split);
      const query = split < 0 ? '' : raw.slice(split + 1);
      if (pathname.startsWith('/api/') && split >= 0) {
        return json(400, { error: 'API query parameters are not accepted.' });
      }
      if (pathname === '/api/health') return json(200, HEALTH);
      if (pathname === '/api/config') return json(200, { version: 1, config: PUBLIC_CONFIG });
      if (pathname.startsWith('/api/breach/')) {
        if (req.method === 'HEAD') {
          res.setHeader('Allow', 'GET');
          return json(405, { error: 'This endpoint requires GET.' });
        }
        const match = /^\/api\/breach\/([a-fA-F0-9]{5})$/.exec(pathname);
        if (!match) return json(400, { error: 'Supply exactly five hexadecimal prefix characters.' });
        const retryAfter = allowLookup(req.socket.remoteAddress || 'unknown');
        if (retryAfter) {
          res.setHeader('Retry-After', String(retryAfter));
          return json(429, { error: 'Lookup limit reached. Try again shortly.' });
        }
        if (activeUpstreams >= maxConcurrent) {
          res.setHeader('Retry-After', '1');
          return json(503, { error: 'Lookup capacity reached. Try again shortly.' });
        }
        const controller = new AbortController();
        let timer;
        let timedOut = false;
        activeUpstreams++;
        const onClose = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', onClose);
        try {
          const upstream = (async () => {
            const response = await fetchImpl('https://api.pwnedpasswords.com/range/' + match[1].toUpperCase(), {
              method: 'GET', headers: { 'Add-Padding': 'true' },
              signal: controller.signal, redirect: 'error', credentials: 'omit',
              referrerPolicy: 'no-referrer', cache: 'no-store'
            });
            return readRange(response, controller, maxResponseBytes);
          })();
          const deadline = new Promise((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              controller.abort();
              reject(new Error('timeout'));
            }, upstreamTimeoutMs);
          });
          const body = await Promise.race([upstream, deadline]);
          if (!res.destroyed && !res.writableEnded) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Length', Buffer.byteLength(body));
            res.end(body);
          }
        } catch (_) {
          // Cancel unread error/malformed bodies as well as timed-out requests.
          controller.abort();
          json(timedOut ? 504 : 503, { error: timedOut ? 'Breach lookup timed out.' : 'Breach lookup unavailable.' });
        } finally {
          clearTimeout(timer);
          res.removeListener('close', onClose);
          activeUpstreams--;
        }
        return;
      }
      if (pathname.startsWith('/api/')) return json(404, { error: 'API route not found.' });
      // Match the literal pathname, without URL normalization. Encoded traversal,
      // source files, dotfiles, directories and environment files are not served.
      const file = STATIC_FILES.get(pathname);
      if (!file || (query && query !== 'selftest=1')) return json(404, { error: 'File not found.' });
      const data = await fs.readFile(path.join(rootDir, file[0]));
      res.statusCode = 200;
      res.setHeader('Content-Type', file[1]);
      res.setHeader('Content-Length', data.length);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (_) {
      json(500, { error: 'Request could not be completed.' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('Invalid PORT. Choose a port from 1 to 65535.\n');
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.on('error', () => {
      process.stderr.write('CRACKPROOF could not start. Check the port and host settings.\n');
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      // No per-request logs: the prefix and visitor IP must not appear here.
      process.stdout.write('CRACKPROOF server listening on port ' + port + '.\n');
    });
  }
}

module.exports = { createServer, PUBLIC_CONFIG };
