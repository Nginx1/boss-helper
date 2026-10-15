const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const {EventEmitter} = require('node:events');
const {zip} = require('../scripts/package.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'boss.js'), 'utf8');
const content = fs.readFileSync(path.join(root, 'content-scripts/content.js'), 'utf8');
const slice = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Missing actual runtime section: ' + start); return text.slice(a, b);
};
const quiet = {info() {}, warn() {}, error() {}, debug() {}};
const context = vm.createContext({console: quiet, TextDecoder, TextEncoder, Uint8Array, DataView, Blob,
  atob, DecompressionStream, performance, setTimeout, clearTimeout});
vm.runInContext(slice(source, 'function BHRPlain(', 'var BHAssistantPanel=') +
  slice(content, 'var BHRFileLimit', 'var e=(e,t)=>'), context);
const native = value => JSON.parse(JSON.stringify(value));
const resume = '测试求职者\n邮箱 test@example.com 手机 13800138000\n工作经历：五年 Linux 系统维护，参与服务器监控和故障处理。\n技能：Linux、Shell、监控告警。\n证书：简历没有列出额外证书。';
const packet = (mid, time, text = '你好，能介绍一下你的工作经历吗？', from = '200', to = '100', extra = {}) => ({messages: [{
  type: 1, mid: String(mid), time, from: {uid: from, name: '测试招聘者', source: 0}, to: {uid: to, source: 0},
  body: {type: 1, text}, ...extra,
}]});
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function fixture(overrides = {}) {
  let now = 1800000000000, timer = 0, account = '100';
  const timers = new Map(), generated = [], published = [];
  const options = {account: () => account, selfId: () => '100', now: () => now, autoEnabled: () => true,
    setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id),
    model: () => ({model: 'mock'}), prompt: () => [{role: 'user', content: '{{ hrMessage }}\n{{ conversation }}'}],
    job: () => ({jobName: '系统运维工程师'}), deliveryRunning: () => false,
    generate: async (config, messages) => { generated.push({config, messages}); return {text: JSON.stringify({reply: '您好，我有相关系统维护经验，可以进一步介绍。', confirm: []})}; },
    wait: async () => {}, publish: async (metadata, text) => { published.push({metadata, text}); }, ...overrides};
  const assistant = new context.BHRReplyAssistant(options);
  return {assistant, options, generated, published, timers, now: () => now,
    tick: async () => { now += 2000; const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); await flush(); },
    advance: () => { now += 1000; }, switchAccount: () => { account = '999'; }};
}
async function promptChecks() {
  const prompts = native(context.BHRBuildPrompts(resume + '\n{{ dangerous.variable }}', {roles: '系统运维', city: '深圳'}));
  assert(prompts.resumeText.includes('[邮箱已隐藏]') && prompts.resumeText.includes('[手机号已隐藏]'));
  assert(!prompts.resumeText.includes('test@example.com') && !prompts.resumeText.includes('13800138000'));
  assert(prompts.resumeText.includes('｛｛ dangerous.variable ｝｝'));
  for (const key of ['filtering', 'greetings', 'reply']) {
    assert.equal(prompts[key].length, 2); assert(prompts[key][1].content.includes('五年 Linux'));
    assert(prompts[key][0].content.includes('不能补造'));
  }
  assert(prompts.filtering[0].content.includes('"negative"') && prompts.filtering[0].content.includes('"positive"'));
  assert(prompts.filtering[0].content.includes('“优先”') && prompts.filtering[0].content.includes('不扣分'));
  assert(prompts.greetings[0].content.includes('两条或三条') && prompts.greetings[0].content.includes('JSON字符串数组'));
  assert.throws(() => context.BHRBuildPrompts('太短'), /太少/);
  assert.throws(() => context.BHRBuildPrompts('a'.repeat(50001)), /5 万字/);
  const store = new Map(), storage = {get: async key => store.get(key), set: async (key, value) => store.set(key, native(value))};
  let fail = false, saves = 0;
  const helper = {workflowRunning: {value: false}, conf: {formDataKey: () => 'preset-A',
    formData: {aiFiltering: {enable: true, model: 'filter', score: 37, prompt: '旧筛选'},
      aiGreeting: {enable: false, model: 'greet', prompt: '旧招呼'}, aiReply: {enable: false, prompt: '旧回复'},
      greetingMessageCount: 2, delayDeliveryInterval: 20, delayMessageSending: 5},
    confSaving: async () => { saves++; if (fail) throw Error('模拟保存失败'); }}};
  await context.BHRApplyPrompts(helper, prompts, ['filtering', 'greetings', 'reply', '__proto__'], storage);
  assert.equal(helper.conf.formData.aiFiltering.model, 'filter'); assert.equal(helper.conf.formData.aiFiltering.score, 37);
  assert.equal(helper.conf.formData.aiGreeting.enable, false); assert.equal(helper.conf.formData.aiReply.enable, false);
  assert.equal(helper.conf.formData.greetingMessageCount, 2); assert.equal(helper.conf.formData.delayMessageSending, 5);
  helper.conf.formData.aiGreeting.model = 'changed-model';
  await context.BHRRestorePrompts(helper, storage);
  assert.equal(helper.conf.formData.aiGreeting.prompt, '旧招呼'); assert.equal(helper.conf.formData.aiGreeting.model, 'changed-model');
  const before = native(helper.conf.formData); fail = true;
  await assert.rejects(context.BHRApplyPrompts(helper, prompts, ['filtering'], storage), /模拟保存失败/);
  assert.deepEqual(native(helper.conf.formData), before); fail = false;
  helper.workflowRunning.value = true;
  await assert.rejects(context.BHRApplyPrompts(helper, prompts, ['filtering'], storage), /停止投递/);
  helper.workflowRunning.value = false;
  helper.conf.formDataKey = () => 'preset-B';
  await assert.rejects(context.BHRRestorePrompts(helper, storage), /没有可恢复/);
  helper.conf.formDataKey = () => 'preset-A';
  const beforeRace = native(helper.conf.formData);
  const racingStorage = {set: async () => {helper.conf.formDataKey = () => 'preset-B';}};
  await assert.rejects(context.BHRApplyPrompts(helper, prompts, ['filtering'], racingStorage), /预设或投递状态发生变化/);
  assert.deepEqual(native(helper.conf.formData), beforeRace);
  assert(saves >= 3);
}

function tinyPDF() {
  const body = 'BT /F1 12 Tf 72 720 Td (Synthetic candidate resume. Five years of Linux operations, monitoring and incident response.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`];
  let result = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result);
}

async function fileChecks() {
  const payload = (name, bytes) => ({name, data: Buffer.from(bytes).toString('base64')});
  const txt = await context.BHRReadResume(payload('resume.txt', Buffer.from(resume)));
  assert.equal(txt.text, resume); assert.equal(txt.format, '文本');
  const utf16 = await context.BHRReadResume(payload('resume.md', Buffer.concat([Buffer.from([255,254]), Buffer.from(resume, 'utf16le')])));
  assert.equal(utf16.text, resume);
  const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    '<w:p><w:r><w:t>测试求职者 &amp; 简历</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>五年系统维护经验，参与 Linux 系统监控、故障处理和变更维护。熟悉 Shell，目标岗位是系统运维工程师。</w:t></w:r></w:p></w:body></w:document>';
  const docx = zip([['word/document.xml', Buffer.from(xml)]], new Date('2026-10-15T00:00:00Z'));
  const word = await context.BHRReadResume(payload('resume.docx', docx));
  assert(word.text.includes('测试求职者 & 简历\n五年系统维护')); assert.equal(word.format, 'DOCX');
  const damaged = Buffer.from(docx); damaged[70] ^= 255;
  await assert.rejects(context.BHRReadResume(payload('bad.docx', damaged)));
  await assert.rejects(context.BHRReadResume(payload('resume.doc', Buffer.from(resume))), /旧 DOC/);
  await assert.rejects(context.BHRReadResume(payload('fake.pdf', Buffer.from(resume))), /文件头无效/);
  await assert.rejects(context.BHRReadResume({name: 'resume.txt', data: '%%%%'}), /文件数据无效/);
  await assert.rejects(context.BHRReadResume({name: 'resume.txt', data: 'A'.repeat(12 * 1024 * 1024)}), /8 MB/);
  assert.throws(() => context.BHRDocxText('<!DOCTYPE a><w:document></w:document>'), /无效/);

  // Exercise the shipped PDF parser itself with a generated non-personal PDF.
  globalThis.DOMMatrix ||= class {constructor() {this.a = this.d = 1; this.b = this.c = this.e = this.f = 0;}};
  const basePath = path.join(root, 'third_party/pdfjs');
  globalThis.pdfjsWorker = await import(pathToFileURL(path.join(basePath, 'legacy/build/pdf.worker.min.mjs')).href);
  // Text extraction does not use Node's optional native raster renderer.
  const previousWarn = console.warn;
  let library;
  try {
    console.warn = (...args) => {
      if (/^Warning: Cannot load "@napi-rs\/canvas"|^Warning: Cannot polyfill `Path2D`/.test(String(args[0]))) return;
      previousWarn(...args);
    };
    library = await import(pathToFileURL(path.join(basePath, 'legacy/build/pdf.min.mjs')).href);
  } finally { console.warn = previousWarn; }
  const base = pathToFileURL(basePath + path.sep).href;
  const pdf = await context.BHRReadResume(payload('resume.pdf', tinyPDF()), {loadPDF: async () => ({library, base})});
  assert.equal(pdf.pages, 1); assert(pdf.text.includes('Five years of Linux operations'));
  let destroyed = 0;
  const blankLibrary = {getDocument: () => ({promise: Promise.resolve({numPages: 1, getPage: async () => ({getTextContent: async () => ({items: []}), cleanup() {}})}), destroy: async () => {destroyed++;}})};
  await assert.rejects(context.BHRReadResume(payload('scan.pdf', tinyPDF()), {loadPDF: async () => ({library: blankLibrary, base})}), /扫描 PDF/);
  assert.equal(destroyed, 1);
}

async function replyChecks() {
  const f = fixture();
  f.assistant.ingest(packet(1, f.now())); f.assistant.ingest(packet(1, f.now()));
  await f.tick();
  assert.equal(f.generated.length, 1); assert.equal(f.published.length, 0, 'Incoming messages must never publish');
  const thread = f.assistant.threads.get('200:0'); assert.equal(thread.stage, 'review');
  await assert.rejects(f.assistant.confirmSend(thread.key), /先核对/);
  assert.equal(f.published.length, 0);
  await f.assistant.confirmSend(thread.key, {confirmed: true});
  assert.equal(f.published.length, 1); assert.equal(f.published[0].metadata.uid, 200);
  await assert.rejects(f.assistant.confirmSend(thread.key, {confirmed: true})); assert.equal(f.published.length, 1);
  f.assistant.ingest(packet(8, f.now(), f.published[0].text, '100', '200'));
  assert.equal(thread.takenOver, false, 'Our own send echo is not a manual takeover');
  f.advance(); f.assistant.ingest(packet(9, f.now(), '期望薪资是多少，什么时候可以面试？')); await f.tick();
  assert.equal(thread.stage, 'review'); assert(thread.confirm.length > 0);

  const invalid = fixture();
  for (const p of [packet(1, invalid.now() - 60000), packet(2, invalid.now(), '旧消息', '200', '100', {offline: true}),
    packet(3, invalid.now(), '其他账号', '200', '999'), packet(4, invalid.now(), '群聊', '200', '100', {type: 2}),
    packet(5, invalid.now(), '图片', '200', '100', {body: {type: 3, text: '图片'}})]) invalid.assistant.ingest(p);
  await invalid.tick(); assert.equal(invalid.generated.length, 0); assert.equal(invalid.assistant.threads.size, 0);

  let resolveAI;
  const racing = fixture({generate: () => new Promise(resolve => {resolveAI = resolve;})});
  racing.assistant.ingest(packet(1, racing.now())); await racing.tick();
  racing.advance(); racing.assistant.ingest(packet(2, racing.now(), '新的问题，请回答最新这条。'));
  resolveAI({text: JSON.stringify({reply: '旧回复不应显示', confirm: []})}); await flush();
  assert.equal(racing.assistant.threads.get('200:0').draft, '');
  racing.assistant.pause(); await racing.tick(); assert.equal(racing.published.length, 0);

  let releaseWait;
  const cancelling = fixture({wait: () => new Promise(resolve => {releaseWait = resolve;})});
  cancelling.assistant.ingest(packet(1, cancelling.now())); await cancelling.tick();
  const sending = cancelling.assistant.confirmSend('200:0', {confirmed: true});
  cancelling.advance(); cancelling.assistant.ingest(packet(2, cancelling.now(), '刚才的信息有变化，请先看这一条。'));
  releaseWait(); await assert.rejects(sending, /已取消/); assert.equal(cancelling.published.length, 0);

  const manual = fixture(); manual.assistant.ingest(packet(1, manual.now())); await manual.tick();
  manual.assistant.ingest(packet(2, manual.now(), '我正在手动回复', '100', '200'));
  assert.equal(manual.assistant.threads.get('200:0').stage, 'manual');
  await assert.rejects(manual.assistant.confirmSend('200:0', {confirmed: true}));
  manual.assistant.pause(); await assert.rejects(manual.assistant.requestDraft('200:0', {manual: true}));

  const lost = fixture({publish: async () => {throw Error('模拟确认丢失');}});
  lost.assistant.ingest(packet(1, lost.now())); await lost.tick();
  await assert.rejects(lost.assistant.confirmSend('200:0', {confirmed: true}), /勿重复发送/);
  assert.equal(lost.assistant.threads.get('200:0').stage, 'uncertain');
  await assert.rejects(lost.assistant.requestDraft('200:0', {manual: true}), /已提交发送/);

  const changedAccount = fixture(); changedAccount.assistant.ingest(packet(1, changedAccount.now())); await changedAccount.tick();
  changedAccount.switchAccount(); await assert.rejects(changedAccount.assistant.confirmSend('200:0', {confirmed: true}), /账号发生变化/);
  assert.equal(changedAccount.published.length, 0);
  const busy = fixture({deliveryRunning: () => true}); busy.assistant.ingest(packet(1, busy.now())); await busy.tick();
  await assert.rejects(busy.assistant.confirmSend('200:0', {confirmed: true}), /投递仍在运行/); assert.equal(busy.published.length, 0);
  const failedAI = fixture({generate: async () => {throw Error('模拟 AI 配额错误');}});
  failedAI.assistant.ingest(packet(1, failedAI.now())); await failedAI.tick(); assert.equal(failedAI.assistant.autoBlocked, true);
  assert.equal(failedAI.published.length, 0);
  let policy = 'first';
  const changedPolicy = fixture({policyStamp: () => policy});
  changedPolicy.assistant.ingest(packet(1, changedPolicy.now())); await changedPolicy.tick();
  policy = 'second';
  await assert.rejects(changedPolicy.assistant.confirmSend('200:0', {confirmed: true}), /草稿已过期/);
  assert.equal(changedPolicy.published.length, 0);
  assert.throws(() => context.BHRParseReply('分析：应当回复您好'), /格式无效/);
  assert.throws(() => context.BHRParseReply(JSON.stringify({reply: 'a'.repeat(801), confirm: []})), /格式无效/);
  assert.throws(() => context.BHRRenderReply([{role: 'user', content: '{{ jobData.__proto__.x }}'}], {}), /不支持/);
}

async function integrationChecks() {
  const events = new Map(), store = new Map(), mounted = [], client = new EventEmitter(), sent = [], generated = [], opened = [];
  client.connected = true;
  client.publish = (_topic, bytes, _options, callback) => {sent.push(bytes); callback();};
  const helper = {conf: {formData: {aiReply: {enable: false, prompt: [{role: 'user', content: '{{ hrMessage }}'}]},
    aiGreeting: {model: 'chosen'}, aiFiltering: {}, delayMessageSending: 5}, formDataKey: () => 'default', confInit: async () => {}, confSaving: async () => {}},
  models: {modelData: {value: [{key: 'chosen', data: {model: 'mock'}}]}, initModel: async () => {}},
  workflowRunning: {value: false}, jobMaps: new Map(), geek: {client, msgBuilder: {config: {userId: 100},
    decode: bytes => JSON.parse(new TextDecoder().decode(bytes)), encode: value => value,
    createTextMessage: (metadata, body) => ({metadata, body})}}};
  Object.assign(context, {
    window: {_PAGE: {uid: 100}, addEventListener: (name, fn) => events.set(name, fn)},
    document: {getElementById: id => mounted.find(item => item.id === id), createElement: tag => ({tag}), body: {appendChild: item => mounted.push(item)},
      addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name)},
    iu: {storageGet: async (key, fallback) => store.has(key) ? store.get(key) : fallback, storageSet: async (key, value) => store.set(key, value)},
    hr: (getter, callback, options) => {if (options?.immediate) callback(getter()); return () => {};},
    BHWaitUntil: async () => {}, BHDirectGenerate: async (config, messages) => {generated.push({config, messages}); return {text: JSON.stringify({reply: '您好，可以进一步沟通岗位职责。', confirm: []})};},
    jh: () => true, an: value => value, BHAssistantPanel: 'AssistantPanel',
    RX: () => ({create: (component, options) => ({open: () => opened.push({component, options})})}),
  });
  await context.BHAssistantStart(helper); await context.BHAssistantStart(helper);
  assert.equal(mounted.length, 0, 'Job page already has an overlay provider; avoid a second menu');
  context.BHAssistantMenu(helper, true); context.BHAssistantMenu(helper, true);
  assert.equal(mounted.length, 1); assert.equal(mounted[0].tag, 'boss-helper-menu');
  context.BHOpenAssistant(helper, 'replies');
  assert.equal(opened[0].component, 'AssistantPanel'); assert.equal(opened[0].options.props.helper, helper);
  assert.equal(opened[0].options.props.startTab, 'replies');
  context.BHAttachAssistant(helper); context.BHAttachAssistant(helper); assert.equal(client.listenerCount('message'), 1);
  const incoming = packet(1, Date.now()); client.emit('message', 'chat', new TextEncoder().encode(JSON.stringify(incoming)));
  assert.equal(sent.length, 0); assert.equal(generated.length, 0, 'Default auto drafting is off');
  await helper._bhAssistant.requestDraft('200:0', {manual: true}); assert.equal(generated.length, 1); assert.equal(sent.length, 0);
  await helper._bhAssistant.confirmSend('200:0', {confirmed: true}); assert.equal(sent.length, 1); assert.equal(sent[0].metadata.uid, 200);
  events.get('input')({target: {closest: () => true}}); assert.equal(helper._bhAssistant.paused, true);
  assert(context.BHAssistantIsChat('/web/geek/chat') && !context.BHAssistantIsChat('/web/geek/jobs'));
  events.get('pagehide')(); assert.equal(client.listenerCount('message'), 0);
  assert.equal(helper._bhAssistant.paused, true);
  context.tue = class {async connect() {throw Error('模拟登录失效');}};
  const failedConnection = {...helper, geek: undefined, _bhAssistant: undefined, _bhAssistantConnecting: undefined};
  await assert.rejects(context.BHAssistantConnect(failedConnection), /登录失效/);
  assert(failedConnection._bhAssistant.connection.includes('连接失败'));
  assert.equal(failedConnection._bhAssistantConnecting, null);
}

async function main() {
  await promptChecks(); await fileChecks(); await replyChecks(); await integrationChecks();
  console.log('PASS: local resume prompts/redaction/format, reversible preset-specific application, real TXT/DOCX/PDF extraction, corrupt/oversized/scanned input handling, draft-only incoming processing, deduplication, latest-message races, manual takeover, pause/account/delivery guards, explicit single send, lost-ack duplicate prevention, real runtime adapter wiring and teardown. No platform or AI requests.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
