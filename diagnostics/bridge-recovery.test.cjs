const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const root = process.argv[2] || path.join(__dirname,
  fs.existsSync(path.join(__dirname, 'bridge-20261009', 'boss.js')) ? 'bridge-20261009' : '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sources = Object.fromEntries(['boss.js', 'content-scripts/content.js', 'background.js'].map(f => [f, read(f)]));
const boss = sources['boss.js'];
const section = (source, start, end) => {
  const at = source.indexOf(start), until = source.indexOf(end, at + start.length);
  assert(at >= 0 && until > at, 'Missing section: ' + start);
  return source.slice(at, until);
};
const quiet = {info() {}, warn() {}, debug() {}, error() {}};
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function clock(clamp = 0) {
  let now = 0, id = 0;
  const tasks = new Map();
  return {
    performance: {now: () => now},
    setTimeout: (fn, delay) => { tasks.set(++id, {fn, at: now + Math.max(delay, clamp)}); return id; },
    clearTimeout: id => tasks.delete(id),
    size: () => tasks.size,
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const first = [...tasks.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!first) break;
        now = first[1].at; tasks.delete(first[0]); first[1].fn(); await flush();
      }
      now = target; await flush();
    },
  };
}
const types = {APPLY: 'apply', CALLBACK: 'callback', PING: 'ping', PONG: 'pong'};
const actors = {PROVIDER: 'provider', INJECTOR: 'injector'};
let serial = 0;
function protocol(file, timer, globals = {}) {
  const source = sources[file];
  const config = file === 'boss.js'
    ? ['Ul=Symbol(', ',tu=class', 'eu', {Il: types, Ll: actors, zl: () => String(++serial), Rl: () => true}]
    : file === 'background.js'
      ? ['_=Symbol(', ',w=null', 'C', {u: types, d: actors, p: () => String(++serial), f: () => true}]
      : ['f=Symbol(', ',te=class', 'S', {a: types, o: actors, c: () => String(++serial), s: () => true}];
  const ctx = vm.createContext({console: quiet, ...timer, ...config[3], ...globals});
  vm.runInContext(section(source, '/* bh-bridge-recovery:', '/* end bh-bridge-recovery */') +
    'var ' + section(source, config[0], config[1]) + ';globalThis.createRPC=' + config[2] + ';', ctx);
  return ctx;
}
function bus(name, send) {
  const listeners = new Set();
  return {name, listeners, sendMessage: send,
    onMessage(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    deliver(message) { return Promise.all([...listeners].map(fn => fn(message))); }};
}
async function testProtocol() {
  for (const file of Object.keys(sources)) {
    const timer = clock(60000), ctx = protocol(file, timer);
    let sent = 0, client;
    client = bus('content', message => {
      sent++;
      return client.deliver({...message, type: types.PONG, sender: {type: actors.PROVIDER}});
    });
    await ctx.BHBridgeHeartbeat(client, {namespace: 'hidden', heartbeatTimeout: 10000}, types, actors, () => 'ping');
    assert.equal(sent, 1, file + ': first probe must run without timer advancement');
    assert.equal(client.listeners.size, 0); assert.equal(timer.size(), 0);

    const delayed = clock(), delayedCtx = protocol(file, delayed);
    let last;
    const transport = bus('content', message => { last = message; });
    const promise = delayedCtx.BHBridgeHeartbeat(transport, {namespace: 'cold', heartbeatTimeout: 10000}, types, actors, () => 'cold');
    await delayed.advance(2000);
    await transport.deliver({...last, type: types.PONG, sender: {type: actors.PROVIDER}});
    await promise;
    assert.equal(transport.listeners.size, 0); assert.equal(delayed.size(), 0);

    const failure = clock(), failureCtx = protocol(file, failure);
    const unavailable = bus('content', () => {});
    const [, inject] = failureCtx.createRPC(() => ({}), {namespace: 'missing'});
    const proxy = inject(unavailable);
    const rejected = assert.rejects(proxy.echo('hello'), /timeout 10000ms.*missing/);
    await flush(); assert.equal(unavailable.listeners.size, 2, 'response and heartbeat listeners registered');
    await failure.advance(10000); await rejected;
    assert.equal(unavailable.listeners.size, 0, file + ': failed preflight must clean response listener');
    assert.equal(failure.size(), 0);

    const disconnected = bus('content', async () => { throw Error('Extension context invalidated'); });
    const disconnectProxy = inject(disconnected);
    await assert.rejects(disconnectProxy.echo(), /context invalidated/);
    assert.equal(disconnected.listeners.size, 0);

    const working = clock(), workingCtx = protocol(file, working);
    let caller, server;
    caller = bus('caller', m => server.deliver(m)); server = bus('provider', m => caller.deliver(m));
    const [provide, consume] = workingCtx.createRPC(() => ({echo: async text => text + ':ok'}), {namespace: 'rpc'});
    provide(server);
    assert.equal(await consume(caller).echo('offline'), 'offline:ok');
    assert.equal(caller.listeners.size, 0); assert.equal(working.size(), 0);
  }
}
async function testRuntimeRouting() {
  const workerListeners = new Set(), tabListeners = new Set(), routes = [];
  const timer = clock();
  const onMessage = listeners => ({addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn)});
  let ackMode = 'normal';
  const runtime = {id: 'offline-extension', onMessage: onMessage(tabListeners),
    sendMessage: async (id, message) => {
      if (ackMode === 'reject') throw Error('Extension context invalidated');
      if (ackMode === 'bad') return {bhAck: false, error: 'reply unavailable'};
      return new Promise((resolve, reject) => {
        const listener = [...workerListeners][0];
        assert(listener);
        const keep = listener(message, {tab: {id: 7}, frameId: 3}, resolve);
        if (keep !== true) reject(Error('Async runtime channel was not kept open'));
      });
    }};
  const content = protocol('content-scripts/content.js', timer, {n: {runtime}, document: {location: {href: 'https://offline.invalid/old-url'}}});
  const worker = protocol('background.js', timer, {O: {runtime: {onMessage: onMessage(workerListeners)}, tabs: {
    query: async () => { throw Error('Must route by actual sender tab, even when URL changes'); },
    sendMessage: async (id, message, options) => {
      routes.push({id, options}); await Promise.all([...tabListeners].map(fn => fn(message)));
    },
  }}});
  vm.runInContext('globalThis.RuntimeTransport=' + section(sources['content-scripts/content.js'], 'he=class', ',W=Object').slice(3) + ';', content);
  vm.runInContext('globalThis.TabTransport=' + section(sources['background.js'], 'Se=class', ',Ce=l').slice(3) + ';', worker);
  const transport = new content.RuntimeTransport();
  const [provide] = worker.createRPC(() => ({echo: async x => x + ':runtime'}), {namespace: '__boss-helper-background__'});
  provide(new worker.TabTransport());
  const [, consume] = content.createRPC(() => ({}), {namespace: '__boss-helper-background__'});
  assert.equal(await consume(transport).echo('offline'), 'offline:runtime');
  await flush();
  assert.equal(routes.length, 2, 'One PONG and one method reply');
  assert(routes.every(route => route.id === 7 && route.options.frameId === 3));
  assert.equal(tabListeners.size, 0); assert.equal(timer.size(), 0);
  const message = {namespace: '__boss-helper-background__', type: 'ping', sender: {type: 'injector', name: 'content'}, meta: {}};
  ackMode = 'bad'; await assert.rejects(transport.sendMessage(message), /Extension bridge request failed.*reply unavailable/);
  ackMode = 'reject'; await assert.rejects(transport.sendMessage(message), /context invalidated/);
  assert.equal([...workerListeners][0]({...message, namespace: 'unrelated'}, {}, () => {}), undefined);
}
function helpers(timer, extra = {}) {
  const logs = [];
  const logger = {withContext() { return this; }, ...Object.fromEntries(['debug','info','warn','error'].map(level => [level, (...args) => logs.push({level, args})]))};
  const ctx = vm.createContext({console: quiet, ...timer, TextEncoder, crypto: webcrypto, structuredClone,
    jh: () => true, Md: logger, ih: class extends Error {}, rh: class extends Error {}, th: Error,
    ...extra});
  vm.runInContext(section(boss, 'class BHSafetyStopError', 'async function BHPlatformJSON') +
    section(boss, '/* bh-multi-greeting:', '/* end bh-multi-greeting helpers */') +
    section(boss, 'function BHIsBridgeUnavailable', 'async function BHWaitUntil') +
    section(boss, 'async function BHAICacheKey', '/* end bh-safe-pacing helpers */') +
    'globalThis.StopError=BHSafetyStopError;', ctx);
  return {ctx, logs, logger};
}
const detail = lid => ({lid, jobInfo: {postDescription: '真实岗位内容', locationName: '深圳', address: '办公地址', longitude: 1, latitude: 2},
  bossInfo: {activeTimeDesc: '今日活跃', bossOnline: true, certificated: true},
  brandComInfo: {activeTime: 1, labels: ['标签'], introduce: '公司介绍', stageName: '已上市'}});
async function testDetails() {
  const timer = clock(), watches = new Set();
  const {ctx} = helpers(timer, {hr: (getter, callback, options) => {
    assert.equal(options.flush, 'sync'); const watch = {getter, callback}; watches.add(watch); return () => watches.delete(watch);
  }});
  vm.runInContext('globalThis.DetailAdapter=class {' + section(boss, 'async onJobCardClick(key)', 'async _initJobList()') + '};', ctx);
  const record = {jobData: {key: 'cached', boss: {name: '招聘者'}, brand: {name: '公司'}}, rawData: {detail: detail('cached'), jobitem: {lid: 'cached'}}};
  const adapter = new ctx.DetailAdapter(); adapter.jobMaps = new Map([['cached', record]]);
  adapter._jobDetail = {value: {}}; let clicks = 0;
  adapter._clickJobCardAction = () => { clicks++; };
  await adapter.onJobCardClick('cached');
  assert.equal(clicks, 0); assert.equal(record.jobData.activeTimeStr, '今日活跃');
  assert.equal(record.jobData.jobDescription, '真实岗位内容'); assert.equal(record.jobData.boss.name, '招聘者');
  assert.equal(record.jobData.brand.name, '公司'); assert.equal(timer.size(), 0);

  const fresh = {jobData: {}, rawData: {detail: {}, jobitem: {lid: 'fresh'}}};
  adapter.jobMaps.set('fresh', fresh);
  adapter._clickJobCardAction = item => {
    clicks++; adapter._jobDetail.value = detail(item.lid);
    [...watches].forEach(watch => watch.callback(watch.getter()));
  };
  await adapter.onJobCardClick('fresh');
  assert.equal(clicks, 1); assert.equal(fresh.rawData.detail.lid, 'fresh');
  assert.equal(fresh.jobData.activeTimeStr, '今日活跃'); assert.equal(watches.size, 0); assert.equal(timer.size(), 0);

  const missing = {jobData: {}, rawData: {jobitem: {lid: 'missing'}}};
  adapter.jobMaps.set('missing', missing); adapter._clickJobCardAction = () => { clicks++; };
  const pending = adapter.onJobCardClick('missing');
  const rejected = assert.rejects(pending, /获取超时/);
  await timer.advance(60000); await rejected; assert.equal(watches.size, 0); assert.equal(timer.size(), 0);
  adapter._clickJobCardAction = () => { throw Error('click failed'); };
  await assert.rejects(adapter.onJobCardClick('missing'), /click failed/);
  assert.equal(watches.size, 0); assert.equal(timer.size(), 0);
  const unknown = detail('unknown'); unknown.bossInfo.activeTimeDesc = undefined;
  const unknownRecord = {jobData: {}, rawData: {detail: unknown, jobitem: {lid: 'unknown'}}};
  adapter.jobMaps.set('unknown', unknownRecord); await adapter.onJobCardClick('unknown');
  assert.equal(unknownRecord.jobData.activeTimeStr, undefined, 'Never invent activity for an unknown value');
}
async function testRetryAndWorkflow() {
  const timer = clock(), results = [], calls = [], waits = [];
  const {ctx, logs, logger} = helpers(timer, {BHDirectGenerate: async () => {
    calls.push('generate'); const result = results.shift(); if (result instanceof Error) throw result; return {text: result};
  }, hh: text => assert.equal(text, 'FILTER_OK'),
  BHWaitUntil: async (deadline, stopped) => waits.push({deadline, stopped: stopped()}),
  N: value => ({value}), ln: value => ({value}), K: getter => ({get value() {return getter();}}),
  ld: value => value, Th: value => value, vh: class extends Error {}, alert: () => {throw Error('Unexpected alert');}});
  const helper = {conf: {formData: {}}, workflow: {status: {value: 'running'}}};
  const owner = {ctx: helper, resultCache: new Map()};
  results.push(Error('Provider unavailable: heartbeat check timeout 1000ms.'), 'FILTER_OK');
  assert.equal((await ctx.BHGenerateCachedAI(owner, 'filtering', {jobData: {key: 'recovered'}}, {}, [])).text, 'FILTER_OK');
  assert.equal(calls.length, 2); assert.equal(waits.length, 1);
  results.push(Error('Provider unavailable: heartbeat check timeout 10000ms.'), Error('Provider unavailable: heartbeat check timeout 10000ms.'));
  let communicationStop;
  await assert.rejects(ctx.BHGenerateCachedAI(owner, 'filtering', {jobData: {key: 'unavailable'}}, {}, []), error => {
    communicationStop = error; return !!(error.bhStopAll && error.bhStopReason === 'communication' && error.cause);
  });
  assert.equal(calls.length, 4); assert.equal(waits.length, 2);
  helper.workflow.status.value = 'stop';
  assert.throws(() => ctx.BHAssertCanSend(helper), error => error.bhStopReason === 'cancelled');
  helper.workflow.status.value = 'running';
  results.push(Error('AI筛选返回格式无效'));
  const originalCalls = calls.length;
  results.push(Error('AI筛选返回格式无效'));
  await assert.rejects(ctx.BHGenerateCachedAI(owner, 'filtering', {jobData: {key: 'ai-error'}}, {}, []), error => !error.bhStopAll);
  assert.equal(calls.length, originalCalls + 2);

  vm.runInContext(section(boss, 'async function Eh(', 'var Dh='), ctx);
  async function runWorkflow(error) {
    let executed = 0, pages = 0;
    const pacing = {beforeTask: async () => {}, startJob() {}, recordTask() {}, finishJob() {}, resetStats() {},
      waitConfigured: async () => {}, waitReady: async () => {}, finishRun() {}};
    const helper = {conf: {formData: {}}, _bhPacing: pacing, logs: logger,
      jobList: {value: [{key: 'first', jobName: '第一岗位'}, {key: 'second', jobName: '第二岗位'}]},
      jobMaps: new Map(), jobResultMaps: new Map(), currentJob: {value: null},
      statistics: {todayData: {value: {total: 0, success: 0, tasks: {}}}},
      notification: () => {}, loadMoreJob: async () => {pages++; return false;}};
    const task = {id: 'AI筛选', deps: [], before: [], after: [], task: async () => async () => {executed++; throw error;}};
    const workflow = await ctx.Eh([task], helper); helper.workflow = workflow;
    const before = logs.length; await workflow.executeAll(new Map([['first', {}], ['second', {}]]));
    assert.equal(executed, 1); assert.equal(pages, 0); assert.equal(workflow.status.value, 'stop');
    return {result: helper.jobResultMaps.get('first'), logs: logs.slice(before)};
  }
  const interrupted = await runWorkflow(communicationStop);
  assert.equal(interrupted.result.status, 'error'); assert(interrupted.logs.some(log => log.args[0] === '扩展通信中断'));
  const cancelled = await runWorkflow(new ctx.StopError('投递已停止，未发送后续消息', 'cancelled'));
  assert.equal(cancelled.result.status, 'wait'); assert(!cancelled.logs.some(log => log.level === 'error'));
  assert(!cancelled.logs.some(log => log.args[0] === '平台保护停止'));
  const limited = await runWorkflow(new ctx.StopError('操作过于频繁'));
  assert.equal(limited.result.status, 'error'); assert(limited.logs.some(log => log.args[0] === '平台保护停止'));
}
async function main() {
  Object.entries(sources).forEach(([file, source]) => new vm.Script(source, {filename: file}));
  await testProtocol(); await testRuntimeRouting(); await testDetails(); await testRetryAndWorkflow();
  console.log('PASS: all three scripts parse; immediate probes under 60s timer clamping, 2s delayed PONG, 10s deadline and listener cleanup, actual RPC replies, runtime acknowledgement and tab/frame routing, cached/fresh detail restoration, watcher cleanup, one retry, whole-batch stop, cancellation and platform-stop classification. All requests/messages simulated.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
