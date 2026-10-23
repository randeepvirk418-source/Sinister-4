'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
// Exercise the actual module shipped inside the single-file frontend.
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('/* BREACH CHECK');
const end=html.indexOf('/* CRYPTOGRAPHIC GENERATOR',start);
assert.ok(start>=0&&end>start,'Embedded breach module must exist');
const code=html.slice(start,end)+'\n;globalThis.TEST_BREACH=Breach;';
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
function harness(fetchImpl=async()=>new Response('A'.repeat(35)+':1\n')) {
 let now=0,nextId=1;const timers=new Map(),updates=[],calls=[];
 const sandbox={crypto:webcrypto,TextEncoder,TextDecoder,AbortController,Response,URL,
  navigator:{onLine:true},location:{href:'https://crackproof.example/',protocol:'https:',origin:'https://crackproof.example'},
  Engine:{isKnown:value=>new Set(['password','admin','1234567890']).has(value.toLowerCase())},
  setTimeout(fn,delay){const id=nextId++;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),
  fetch:async(...args)=>{calls.push(args);return fetchImpl(...args)}
 };
 vm.runInNewContext(code,sandbox);
 const checker=sandbox.TEST_BREACH.create({onUpdate:update=>updates.push(update)});
 async function advance(ms){const target=now+ms;for(;;){let selected=null;for(const [id,timer]of timers){if(timer.due<=target&&(!selected||timer.due<selected[1].due))selected=[id,timer];}if(!selected)break;now=selected[1].due;timers.delete(selected[0]);selected[1].fn();await pause();}now=target;await pause();}
 return{sandbox,checker,updates,calls,advance,latest:()=>updates.at(-1)};
}
test('SHA-1 known vector',async()=>{const h=harness();assert.equal(await h.sandbox.TEST_BREACH.sha1('password'),'5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');});
test('only five-prefix GET, padding header, local suffix match and padding exclusion',async()=>{
 const suffix='1E4C9B93F3F0682250B6CF8331B7EE68FD8';
 const h=harness(async()=>new Response(suffix+':42\r\n'+'B'.repeat(35)+':0\r\n'+'C'.repeat(35)+':5\r\n'));
 h.checker.check('password');await h.advance(599);assert.equal(h.calls.length,0);await h.advance(1);
 assert.equal(h.calls.length,1);const[url,options]=h.calls[0];assert.equal(url,'https://api.pwnedpasswords.com/range/5BAA6');
 assert.equal(options.headers['Add-Padding'],'true');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-store');assert.equal(options.body,undefined);
 const last=h.latest();assert.equal(last.count,42);assert.equal(last.resultCount,2);assert.equal(last.status,'FOUND');assert.equal(last.responseReceived,true);
 assert.ok(!JSON.stringify(h.updates).includes(suffix));assert.ok(!JSON.stringify(h.updates).includes('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'));
});
test('backend route constrained to current origin and preserving five-prefix privacy',async()=>{
 const h=harness();const updates=[];const checker=h.sandbox.TEST_BREACH.create({onUpdate:u=>updates.push(u),getEndpoint:()=>({base:'https://crackproof.example/api/breach/',kind:'backend'})});
 checker.check('PublicUniqueFixture!5');await h.advance(600);
 assert.match(h.calls[0][0],/^https:\/\/crackproof\.example\/api\/breach\/[A-F0-9]{5}$/);assert.equal(updates.at(-1).route,'backend');
 const rejected=h.sandbox.TEST_BREACH.create({onUpdate:u=>updates.push(u),getEndpoint:()=>({base:'https://other.example/api/breach/',kind:'backend'})});
 rejected.check('PublicUniqueFixture!5');await h.advance(600);assert.equal(h.calls.length,1);assert.equal(updates.at(-1).status,'OFFLINE');
});
test('short inputs, disabled, and offline do not send requests; known baseline stays flagged',async()=>{
 const h=harness();h.checker.check('abc');await h.advance(900);assert.equal(h.calls.length,0);
 h.checker.check('admin',false);assert.equal(h.latest().found,true);assert.equal(h.latest().source,'local');
 h.checker.check('public-unknown-value',false);assert.equal(h.latest().status,'DISABLED');
 h.sandbox.navigator.onLine=false;h.checker.check('public-unknown-value');assert.equal(h.latest().status,'OFFLINE');await h.advance(900);assert.equal(h.calls.length,0);
});
test('negative API result is not called safe; malformed/oversized response falls back',async()=>{
 let body='A'.repeat(35)+':2\n';const h=harness(async()=>new Response(body));h.checker.check('public-unknown-value');await h.advance(600);assert.equal(h.latest().status,'NOT_FOUND');assert.match(h.latest().note,/does not mean safe/);
 body='not a range response';h.checker.check('public-unknown-value');await h.advance(600);assert.equal(h.latest().status,'OFFLINE');assert.equal(h.latest().responseReceived,false);
 body='A'.repeat(2*1024*1024+1);h.checker.check('public-unknown-value');await h.advance(600);assert.equal(h.latest().status,'OFFLINE');
});
test('network failure and four-second timeout fall back without uncaught errors',async()=>{
 const bad=harness(async()=>{throw Error('private details must not leak')});bad.checker.check('public-unknown-value');await bad.advance(600);assert.equal(bad.latest().status,'OFFLINE');assert.ok(!JSON.stringify(bad.updates).includes('private details'));
 let resolve;const pending=harness(()=>new Promise(r=>resolve=r));pending.checker.check('public-unknown-value');await pending.advance(600);assert.equal(pending.latest().status,'CHECKING');await pending.advance(4000);assert.equal(pending.latest().status,'OFFLINE');assert.match(pending.latest().note,/4-second/);const count=pending.updates.length;resolve(new Response('A'.repeat(35)+':1\n'));await pause();assert.equal(pending.updates.length,count);
});
test('changing input, disabling and wiping cancel stale callbacks',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.checker.check('UniquePrivateSentinel!8374');await h.advance(600);assert.equal(h.calls.length,1);
 h.checker.check('new-password-value',false);const count=h.updates.length;resolve(new Response('A'.repeat(35)+':1\n'));await pause();assert.equal(h.updates.length,count);assert.equal(h.latest().status,'DISABLED');
 h.checker.check('UniquePrivateSentinel!8374');await h.advance(600);h.checker.wipe();const afterWipe=h.updates.length;resolve(new Response('A'.repeat(35)+':1\n'));await pause();assert.equal(h.updates.length,afterWipe);assert.equal(h.latest().status,'IDLE');assert.equal(h.latest().prefix,'');
 assert.ok(!JSON.stringify(h.updates).includes('UniquePrivateSentinel!8374'));
});
