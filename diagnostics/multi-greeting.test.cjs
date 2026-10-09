const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '..', 'boss.js'), 'utf8');
const previous = fs.readFileSync(path.join(__dirname, 'fixtures',
  'filtering-pipeline-0.5.2.txt'), 'utf8');
function section(start, end, input = source) {
  const at = input.indexOf(start);
  const until = input.indexOf(end, at + start.length);
  assert(at >= 0 && until > at, 'Missing source section: ' + start);
  return input.slice(at, until);
}
new vm.Script(source);
const waitCalls = [];
const generationCalls = [];
let responses = [];
const context = vm.createContext({
  console: {warn() {}}, TextEncoder, crypto: webcrypto, structuredClone, performance,
  Md: {debug() {}},
  BHSafetyStopError: class extends Error { constructor(message) { super(message); this.bhStopAll = true; } },
  BHWaitUntil: async (deadline, stopped) => { waitCalls.push({deadline, stopped: stopped()}); },
  BHDirectGenerate: async (config, messages, options) => {
    generationCalls.push({config, messages, options});
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return {text: response, usage: {outputTokens: 80}};
  },
  hh: text => { assert.equal(text, 'FILTER_OK'); },
  lu: async (seconds, stopped) => { waitCalls.push({seconds, stopped: stopped()}); },
  yh: Error,
});
vm.runInContext(section('/* bh-multi-greeting:', '/* end bh-multi-greeting helpers */') +
  section('function BHAssertCanSend(helper)', 'function BHHasJobDetail') +
  section('async function BHAICacheKey', '/* end bh-safe-pacing helpers */') +
  section('function Oh(', 'function kh('), context);
const three = [
  '您好，看到您发布的云平台运维岗位，我对岗位中的基础设施保障工作很感兴趣。',
  '我有近十年基础设施与运维经验，做过大规模服务器保障，也有Kubernetes生产运维经历。',
  '希望有机会了解团队目前的工作重点，我也愿意进一步介绍与这个岗位相关的经历。',
];
const two = [three[0], three[1] + three[2]];
const plain = '您好，我对您发布的云平台运维岗位很感兴趣。我有近十年基础设施与运维经验，参与过大规模服务器保障。希望有机会了解团队的工作重点，并进一步介绍相关经历。';
const asNative = value => JSON.parse(JSON.stringify(value));
const parse = (text, count) => asNative(context.BHParseGreetingTexts(text, count));
async function main() {
  assert.equal(context.BHGetGreetingCount({}), 3);
  assert.equal(context.BHGetGreetingCount({greetingMessageCount: '2'}), 2);
  for (const bad of [0, 1, 4, NaN]) assert.equal(context.BHGetGreetingCount({greetingMessageCount: bad}), 3);
  assert.deepEqual(parse(JSON.stringify(three), 3), three);
  assert.deepEqual(parse('```json\n' + JSON.stringify(two) + '\n```', 2), two);
  assert.deepEqual(parse(JSON.stringify({messages: three}), 3), three);
  assert.equal(parse(plain, 3).join(''), plain);
  assert.equal(parse(plain, 2).join(''), plain);
  for (const invalid of [JSON.stringify(two), JSON.stringify([three[0], three[0], three[2]]),
    JSON.stringify(['', three[1], three[2]]), JSON.stringify([three[0], {}, three[2]]),
    '分析：应该发送三条消息。第一条表示兴趣。第二条写经历。第三条结束。',
    '<think>思考</think>' + JSON.stringify(three), '没有可以自然拆分的内容']) {
    assert.throws(() => parse(invalid, 3), /AI招呼返回格式无效/);
  }
  const originalPrompt = [{role: 'system', content:
    '真实经历：近十年运维。禁止编造。输出要求：生成一条45至85个汉字的中文招呼语，语气专业自然，内容为礼貌开场、1至2个真实匹配点和沟通意愿。不得使用“精通”“专家”“百分百匹配”“完全胜任”等夸张表达。只输出最终招呼语，不输出分析、标题、引号、Markdown或换行。'},
    {role: 'user', content: '岗位名称：云平台运维。最终只输出一条45至85个汉字的招呼语。'}];
  const snapshot = JSON.stringify(originalPrompt);
  const prepared = context.BHBuildGreetingPrompt(originalPrompt, 3);
  assert.equal(JSON.stringify(originalPrompt), snapshot, 'Do not mutate saved user prompts');
  assert(prepared[0].content.includes('真实经历：近十年运维。禁止编造。'));
  assert(!JSON.stringify(prepared).includes('最终只输出一条'));
  assert(prepared.at(-1).content.includes('消息条数为3条'));
  assert(context.BHBuildGreetingPrompt(originalPrompt, 2).at(-1).content.includes('消息条数为2条'));

  const owner = {ctx: {conf: {formData: {greetingMessageCount: 2}},
    workflow: {status: {value: 'running'}}}, resultCache: new Map()};
  const job = {jobData: {key: 'offline-job'}, rawData: {
    boss: {data: {bossId: '123'}}, detail: {bossInfo: {bossSource: 0}}, jobitem: {encryptBossId: 'offline-hr'},
  }};
  responses = [JSON.stringify(two), JSON.stringify(three)];
  const first = await context.BHGenerateCachedAI(owner, 'greetings', job, {}, originalPrompt);
  assert.deepEqual(JSON.parse(first.text), two);
  owner.ctx.conf.formData.greetingMessageCount = 3;
  const second = await context.BHGenerateCachedAI(owner, 'greetings', job, {}, originalPrompt);
  assert.deepEqual(JSON.parse(second.text), three);
  await context.BHGenerateCachedAI(owner, 'greetings', job, {}, originalPrompt);
  assert.equal(generationCalls.length, 2, 'A count change must miss the old cache; same count reuses cache');
  assert(generationCalls[0].messages.at(-1).content.includes('消息条数为2条'));
  assert(generationCalls[1].messages.at(-1).content.includes('消息条数为3条'));
  responses = ['无效', JSON.stringify(three)];
  await context.BHGenerateCachedAI(owner, 'greetings', {jobData: {key: 'retry'}}, {}, originalPrompt);
  assert.equal(generationCalls.length, 4, 'Malformed output retries before any message is sent');
  responses = ['无效', '仍然无效'];
  await assert.rejects(context.BHGenerateCachedAI(owner, 'greetings', {jobData: {key: 'reject'}}, {}, originalPrompt),
    /AI招呼返回格式无效/);
  responses = ['FILTER_OK'];
  assert.equal((await context.BHGenerateCachedAI(owner, 'filtering', job, {}, originalPrompt)).text, 'FILTER_OK');
  assert.equal(generationCalls.at(-1).messages.length, originalPrompt.length, 'Filtering prompt must be unchanged');

  vm.runInContext('globalThis.Sender = class {' + section('async sendMessage(e,t){', 'async onMount(') + '};' +
    'globalThis.GreetingTask = class {' + section('aiGreeting=Oh(', ';amap=Oh(') + ';};', context);
  const published = [];
  const sender = new context.Sender();
  sender.conf = {formData: {delayMessageSending: 5, greetingMessageCount: 3, aiGreeting: {enable: true}}};
  sender.workflow = {status: {value: 'running'}};
  sender.pendingMessages = {value: undefined};
  sender.geek = {msgBuilder: {createTextMessage: (metadata, content) => ({metadata: {...metadata}, ...content}),
    encode: message => message}, client: {publish: (topic, message) => published.push({topic, ...message})}};
  sender.chatModel = {createAgent: () => true, chat: async () => ({text: JSON.stringify(three)})};
  const descriptor = new context.GreetingTask().aiGreeting({deps: ['岗位详情获取', '岗位投递', 'Boss信息获取']});
  assert.deepEqual(asNative(descriptor.deps), ['岗位详情获取', '岗位投递', 'Boss信息获取']);
  const greeting = descriptor.task({helper: sender});
  const waitsBefore = waitCalls.length;
  await greeting({helper: sender}, job);
  assert.deepEqual(published.map(message => message.text), three, 'Send complete messages once, in order');
  assert.deepEqual(waitCalls.slice(waitsBefore).map(wait => wait.seconds), [5, 5, 5]);
  assert.equal(sender.pendingMessages.value, undefined);
  published.length = 0;
  sender.conf.formData.greetingMessageCount = 2;
  sender.chatModel.chat = async () => ({text: JSON.stringify(two)});
  await greeting({helper: sender}, job);
  assert.deepEqual(published.map(message => message.text), two);
  published.length = 0;
  sender.chatModel.chat = async () => ({text: JSON.stringify(['重复内容足够长', '重复内容足够长'])});
  await assert.rejects(greeting({helper: sender}, job), /AI招呼返回格式无效/);
  assert.equal(published.length, 0, 'Invalid greeting must send nothing');
  sender.geek.client.publish = (topic, message) => {
    published.push({topic, ...message}); sender.workflow.status.value = 'stop';
  };
  await assert.rejects(sender.sendMessage(job, three.map(content => ({type: 'text', content}))),
    error => error.bhStopAll === true);
  assert.equal(published.length, 1, 'Stop after the first message suppresses all remaining messages');
  published.length = 0;
  await assert.rejects(sender.sendMessage(job, two.map(content => ({type: 'text', content}))),
    error => error.bhStopAll === true);
  assert.equal(published.length, 0, 'An already stopped workflow must send nothing');
  sender.workflow.status.value = 'running';
  sender.geek.client.publish = () => { throw new Error('mock transport failure'); };
  await assert.rejects(sender.sendMessage(job, two.map(content => ({type: 'text', content}))), /mock transport failure/);

  assert.equal(section('Q9=kh(', ';function nue()'), section('Q9=kh(', ';function nue()', previous),
    'The job filtering / delivery / greeting pipeline must remain unchanged');
  assert(source.includes('timeout:Math.max(1,Math.ceil(Number(t.bhTimeoutMs??18e4)/1e3))'),
    'Preserve the earlier request timeout fix');
  assert(source.includes('label:`AI招呼消息条数`'));
  let saved = 0;
  const uiConfig = {formData: {greetingMessageCount: 3, aiGreeting: {}, aiFiltering: {}, aiReply: {}},
    confSaving: () => { saved++; }};
  const uiWorkflow = {workflow: {status: {value: 'ready'}}, workflowRunning: {value: false}};
  const vnode = (component, props, children) => ({component, props, children:
    children && typeof children.default === 'function' ? children.default() : children});
  Object.assign(context, {I: value => value, N: value => ({value}), SF: () => uiWorkflow, Gm: () => uiConfig,
    P: value => value, R() {}, z: vnode, V: vnode, H: vnode, F: fn => fn, U: text => text,
    W: text => text, Ui: () => 'directive', j0: {}, M0: {}, AX: 'button', A0: 'AI-toggle',
    I1: 'field', U1: 'number', h0: 'popover',
    Df: {aiGreeting: {}, aiFiltering: {}, aiReply: {}}});
  vm.runInContext('globalThis.AIPanel = ' + section('N0=I(', ';function P0').slice(3), context);
  function findNumber(node) {
    if (node?.component === 'number') return node;
    const children = Array.isArray(node?.children) ? node.children : [node?.children];
    for (const child of children) {
      if (child && typeof child === 'object') { const found = findNumber(child); if (found) return found; }
    }
  }
  const render = context.AIPanel.setup({});
  const countInput = findNumber(render({}, []));
  assert(countInput, 'The count selector must render in the AI panel');
  assert.equal(countInput.props.modelValue, 3);
  assert.equal(countInput.props.min, 2);
  assert.equal(countInput.props.max, 3);
  countInput.props['onUpdate:modelValue'](2);
  assert.equal(uiConfig.formData.greetingMessageCount, 2);
  assert.equal(saved, 1, 'The AI panel must save the selected count');
  uiWorkflow.workflowRunning.value = true;
  assert.equal(findNumber(render({}, [])).props.disabled, true, 'Do not change count during a running batch');
  console.log('PASS: syntax, 2/3 messages, grounded prompt preservation, paragraph fallback, invalid-output handling, cache isolation, retry, sending order/delay, stop/failure, filtering pipeline and timeout regression. No network or real messages.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
