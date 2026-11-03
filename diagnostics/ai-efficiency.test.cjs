const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../boss.js'), 'utf8');
const section = (start, end) => {
  const at = source.indexOf(start), until = source.indexOf(end, at + start.length);
  assert(at >= 0 && until > at, start); return source.slice(at, until);
};
const native = value => JSON.parse(JSON.stringify(value));
const flush = async () => {for (let i = 0; i < 30; i++) await Promise.resolve();};
function clock() {
  let now = 0, serial = 0; const timers = new Map();
  return {performance: {now: () => now}, now: () => now, timers,
    setTimeout: (fn, ms) => {timers.set(++serial, {fn, at: now + ms}); return serial;}, clearTimeout: id => timers.delete(id),
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...timers].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      now = target; await flush();
    }};
}
function fixture(generate = async () => ({text: JSON.stringify({negative: [], positive: [{reason: '相关职责有明确经历支持', score: 50}], unknown: []})})) {
  const timer = clock(), calls = [], logs = [], waits = [];
  const owner = {ctx: {conf: {formData: {}}, workflow: {status: {value: 'running'}},
    logs: Object.fromEntries(['info', 'warn'].map(level => [level, (...args) => logs.push({level, args})]))}, resultCache: new Map()};
  const context = vm.createContext({console: {warn() {}}, ...timer, AbortController, AbortSignal, Response, TextEncoder,
    structuredClone, BHDirectGenerate: async (config, messages, options) => {calls.push({config, messages, options}); return generate(config, messages, options);},
    BHWaitUntil: async (deadline, stopped) => {waits.push(deadline - timer.now()); if (!stopped()) await timer.advance(Math.max(0, deadline - timer.now()));}});
  vm.runInContext(section('class BHSafetyStopError', 'function BHPlatformRestriction') +
    section('/* bh-multi-greeting:', '/* end bh-multi-greeting helpers */') +
    section('function BHIsBridgeUnavailable', 'function BHRestoreJobDetail') +
    section('function BHAssertCanSend(', 'function BHHasJobDetail') +
    section('async function BHAICacheKey', '/* end bh-safe-pacing helpers */') +
    section('function hh(', 'async function gh('), context);
  return {context, timer, owner, calls, logs, waits, job: {jobData: {key: 'offline', jobName: '离线岗位'}}};
}
function assessmentChecks() {
  const {context} = fixture();
  // Anonymized replay of the user's actual failure pattern; no candidate or HR identifiers.
  const sre = context.hh({negative: [
    {reason: '岗位硬性要求英语口语流利，求职者未证明外语能力', score: 30},
    {reason: '岗位硬性要求Akamai经验，求职者未证明CDN能力', score: 30},
    {reason: '岗位硬性要求CI/CD和DevSecOps，求职者未证明能力', score: 30},
    {reason: '岗位硬性要求APM工具，求职者未证明该工具能力', score: 30},
  ], positive: [20, 20, 15, 15, 15, 10, 10, 10, 10].map((score, index) => ({score, reason: '匹配维度' + index}))});
  assert.equal(sre.data.positive.rawScore, 125); assert.equal(sre.data.positive.score, 100);
  assert.equal(sre.data.negative.score, 0); assert.equal(sre.requiresReview, true);
  assert(sre.message.includes('不是不具备')); assert.equal(sre.res.unknown.length, 5);
  const windows = context.hh({negative: ['Windows Server', '防病毒产品', 'AD/Exchange'].map(skill =>
    ({reason: '岗位要求' + skill + '，求职者未证明相关能力', score: 30})),
    positive: [{reason: '服务器维护', score: 20}, {reason: '虚拟化', score: 15}, {reason: '安全运维', score: 10}]});
  assert.equal(windows.rating, 45); assert.equal(windows.requiresReview, true); assert.equal(windows.data.negative.score, 0);
  const explicit = context.hh({negative: [{reason: '本人明确确认不接受驻场，该岗位必须驻场', score: 40}],
    positive: [{reason: '基础设施经历匹配', score: 30}]});
  assert.equal(explicit.rating, -10); assert.equal(explicit.requiresReview, false);
  const duplicate = context.hh({negative: [], positive: [{reason: 'Linux运维', score: 20}, {reason: 'Linux 运维。', score: 20}]});
  assert.equal(duplicate.rating, 20);
  for (const score of [-30, 0, 1.2, 101, Infinity]) assert.throws(() => context.hh({negative: [], positive: [{reason: '错误分数', score}]}), /格式无效/);
  assert.throws(() => context.hh({negative: [], positive: [], unknown: [{reason: 30}]}), /格式无效/);
  Object.assign(context, {Oh: (_name, factory) => () => ({task: factory}), yh: Error,
    xh: {skip: message => ({isSkip: true, message})}});
  vm.runInContext('globalThis.FilterTask=class {' + section('aiFiltering=Oh(', 'activityFilter=Oh(') + '};', context);
  const helper = {conf: {formData: {aiFiltering: {enable: true, score: 10}}},
    chatModel: {createAgent: () => true, chat: async () => ({text: JSON.stringify(windows.res)})}};
  return new context.FilterTask().aiFiltering().task({helper})({helper}, {}).then(result => {
    assert(result.isSkip && result.message.startsWith('待人工确认（非不匹配）' + String.fromCharCode(10)));
  });
}
async function requestChecks() {
  const normal = fixture();
  const saved = [{role: 'user', content: '原有个人事实与意向'}], before = JSON.stringify(saved);
  await normal.context.BHGenerateCachedAI(normal.owner, 'filtering', normal.job, {other: {timeout: 180000}}, saved);
  assert.equal(normal.calls[0].options.timeout, 60000); assert.equal(normal.calls[0].options.maxOutputTokens, 1600);
  assert.equal(JSON.stringify(saved), before); assert(normal.calls[0].messages.at(-1).content.includes('unknown'));
  assert(normal.logs.some(item => item.args[0] === 'AI请求完成')); assert.equal(normal.timer.timers.size, 0);
  let attempt = 0;
  const format = fixture(async () => ({text: ++attempt === 1 ? 'not JSON' : '{"positive":[],"negative":[]}'}));
  await format.context.BHGenerateCachedAI(format.owner, 'filtering', format.job, {}, saved);
  assert.equal(format.calls.length, 2); assert.deepEqual(format.waits, [500]);
  const hanging = fixture(() => new Promise(() => {}));
  const pending = hanging.context.BHGenerateCachedAI(hanging.owner, 'filtering', hanging.job, {}, saved);
  const rejected = assert.rejects(pending, error => error.bhStopReason === 'ai' && error.cause.name === 'TimeoutError');
  await flush(); await hanging.timer.advance(60000); await rejected;
  assert.equal(hanging.calls.length, 1, 'Do not repeat a full timed-out request or move onto the next job');
  assert.equal(hanging.calls[0].options.signal.aborted, true); assert.equal(hanging.timer.timers.size, 0);
  const cancel = fixture(() => new Promise(() => {}));
  const cancelling = cancel.context.BHGenerateCachedAI(cancel.owner, 'filtering', cancel.job, {}, saved);
  const cancelled = assert.rejects(cancelling, error => error.bhStopReason === 'cancelled');
  await flush(); cancel.owner.ctx.workflow.status.value = 'stop'; await cancel.timer.advance(100); await cancelled;
  assert.equal(cancel.calls[0].options.signal.aborted, true); assert.equal(cancel.timer.timers.size, 0);
  const auth = fixture(async () => {throw Error('状态码: 401: mock invalid key');});
  await assert.rejects(auth.context.BHGenerateCachedAI(auth.owner, 'filtering', auth.job, {}, saved), error => error.bhStopReason === 'ai');
  assert.equal(auth.calls.length, 1);
  const quota = fixture(async () => {throw Error('状态码: 429: mock quota');});
  await assert.rejects(quota.context.BHGenerateCachedAI(quota.owner, 'filtering', quota.job, {}, saved), error => error.bhStopReason === 'ai');
  assert.equal(quota.calls.length, 1);
  const shorter = fixture();
  await shorter.context.BHGenerateCachedAI(shorter.owner, 'filtering', shorter.job, {other: {timeout: 5000}}, saved);
  assert.equal(shorter.calls[0].options.timeout, 5000);
}
async function adapterChecks() {
  const {context} = fixture(); let payload, options;
  let response = {choices: [{message: {content: '{}'}, finish_reason: 'stop'}]};
  context.BHFetch = async (_url, input) => {payload = JSON.parse(input.body); options = input; return new Response(JSON.stringify(response));};
  vm.runInContext(section('async function BHDirectGenerate(', 'var Sk='), context);
  const config = {base_url: 'https://offline.invalid/v1', api_key: 'offline-only', model: 'mock',
    advanced: {extra_body: {max_tokens: 30000}}};
  const controller = new AbortController();
  await context.BHDirectGenerate(config, [], {timeout: 60000, maxOutputTokens: 1600, signal: controller.signal});
  assert.equal(payload.max_tokens, 1600); controller.abort(); assert(options.signal.aborted);
  config.advanced.extra_body = {max_completion_tokens: 30000};
  await context.BHDirectGenerate(config, [], {maxOutputTokens: 768});
  assert.equal(payload.max_completion_tokens, 768); assert(!('max_tokens' in payload));
  config.responses = true; config.advanced.extra_body = {max_output_tokens: 30000};
  await context.BHDirectGenerate(config, [], {maxOutputTokens: 1600}); assert.equal(payload.max_output_tokens, 1600);
  response = {choices: [{message: {content: '', reasoning_content: '{"positive":[],"negative":[]}'}, finish_reason: 'stop'}]};
  assert.equal((await context.BHDirectGenerate(config, [], {})).text, '', 'Reasoning is never treated as a final answer');
  response = {choices: [{message: {content: '{}'}, finish_reason: 'length'}]};
  await assert.rejects(context.BHDirectGenerate(config, [], {}), /被截断/);
}
(async () => {
  await assessmentChecks(); await requestChecks(); await adapterChecks();
  console.log('PASS: supplied SRE/Windows failure patterns become review, not invented inability; bounded scoring and explicit conflict preservation; review blocks delivery; runtime guards cover saved prompts; 60s total AI budget, 500ms format retry, cancellation within 100ms, no timeout/auth/quota retry loops, token caps resist extra-body overrides, reasoning-only/truncated output rejected. All AI and platform operations simulated.');
})().catch(error => {console.error(error); process.exitCode = 1;});
