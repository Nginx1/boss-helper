const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../boss.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start); return source.slice(a, b);
}
const resume = '具备Linux服务器生产运维经历，负责Kubernetes集群维护、监控和故障处理。';
const jobData = {key: 'offline-job', jobName: '平台运维工程师',
  jobDescription: '维护Linux服务器及Kubernetes集群，负责监控、稳定性和故障处理。', skills: ['Linux'], jobLabels: []};
function assessment(overrides = {}) {
  return {core: {status: 'match', reason: '核心工作为生产基础设施维护，双方有明确证据',
    jobEvidence: '维护Linux服务器及Kubernetes集群', resumeEvidence: '具备Linux服务器生产运维经历'},
    positive: [
      {dimension: 'responsibilities', reason: '生产运维职责', score: 30},
      {dimension: 'skills', reason: '集群与监控维护', score: 25},
      {dimension: 'projects', reason: '相关生产项目', score: 20},
      {dimension: 'seniority', reason: '职责层级相近', score: 10},
    ], negative: [], unknown: [], ...overrides};
}
async function fixture(response, onChat, options = {}) {
  const calls = {delivery: 0, greeting: 0, details: 0, prepare: 0}, logs = [];
  const saved = new Map();
  const logger = Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, (...args) => logs.push({level, args})]));
  logger.withContext = () => logger;
  const context = vm.createContext({console, performance, structuredClone, crypto: webcrypto, BHProject: {version: 'offline'},
    BHWaitUntil: async () => {},
    N: value => ({value}), ln: value => ({value}), K: fn => ({get value() {return fn();}}), ld: value => value,
    Md: logger, alert: message => {throw Error(message);},
    BHShouldStop: error => !!error?.bhStopAll,
    BHPacingController: class {
      beforeTask() {} recordTask() {} startJob() {} finishJob() {} resetStats() {} finishRun() {}
      async waitConfigured() {} async waitReady() {} canPrepareGreeting() {return true;}
    },
    uh: async job => {calls.delivery++; await options.submit?.(job);}, dh: async () => ({data: {bossId: 'offline'}}),
    iu: {async backgroundTest(route, request) {
      assert.equal(route, 'boss-helper:delivery-history:v1');
      if (request.action === 'write') {
        for (const row of request.rows) saved.set(row.id, structuredClone(row));
        return {saved: true};
      }
      assert.equal(request.account, 'offline');
      return {rows: [...saved.values()]};
    }},
  });
  vm.runInContext(section('var vh=class', ',Sh=class') + ';' +
    section('class BHSafetyStopError', 'function BHPlatformRestriction') +
    section('function BHConsecutiveFailure(', 'async function BHPlatformJSON(') +
    section('function BHAssertCanSend(', 'function BHHasJobDetail(') +
    section('async function BHAICacheKey', '/* end bh-safe-pacing helpers */') +
    section('const BHDeliveryRecords', 'const BHDeliveryHistoryPanel') +
    section('function Th(', '/* bh-safe-pacing:') +
    section('async function Eh(', 'var Dh=') +
    'var Dh=[`pending`,`wait`,`running`,`request`,`ai`,`success`,`warn`,`error`];' +
    section('function Oh(', 'function Ah(') +
    'globalThis.FilterTask=class {' + section('aiFiltering=Oh(', 'activityFilter=Oh(') + '};', context);
  const realFilter = new context.FilterTask().aiFiltering;
  context.Z9 = new Proxy({}, {get: (_target, key) => key === 'aiFiltering' ? realFilter : key === 'customGreeting' ?
    config => context.Oh('customGreeting', () => async (_ctx, job) => {calls.greeting++; await options.greet?.(job);})(config) :
    options => context.Oh(String(key), () => undefined)(options)});
  vm.runInContext('var ' + section('Q9=kh(', ';function nue()') + ';', context);
  const helper = {conf: {formData: {aiFiltering: {enable: true, score: 20, prompt: [{role: 'system', content: '用户原有策略'}]},
    aiGreeting: {enable: false}, bossGoldMedalHr: {value: false}, delayDeliveryStarts: 10}},
    _bhLocalResume: {resumeText: resume}, logs: logger, uid: 'offline',
    jobList: {value: options.jobs || [jobData]}, jobResultMaps: new Map(), jobMaps: new Map(), currentJob: {value: null},
    statistics: {todayData: {value: {total: 0, success: 0, tasks: {}}}},
    onJobCardClick: async () => {calls.details++;}, notification() {}, loadMoreJob: options.loadMore || (async () => false),
    chatModel: {createAgent: () => true, chat: async (_stage, job) => {
      await onChat?.(helper, job); return {text: typeof response === 'string' ? response : JSON.stringify(response)};
    }, prepare: async () => {calls.prepare++;}}};
  helper.workflow = await context.Q9(helper);
  const rawData = new Map(helper.jobList.value.map(job => [job.key,
    {jobitem: {securityId: 'synthetic-secret', encryptJobId: job.key, contact: false}, detail: {bossInfo: {}}}]));
  const job = {jobData, rawData: rawData.get(jobData.key), state: {}};
  return {context, helper, calls, logs, job, saved,
    run: () => helper.workflow.executeAll(rawData),
    result: () => helper.jobResultMaps.get(jobData.key)};
}
async function main() {
  // Execute the real compiled workflow, including the real skip loop and delivery node.
  // Even a nominal score of 100 must not cancel the core-responsibility decision.
  const hundred = assessment().positive.concat({dimension: 'preferences', reason: '本人已确认的目标', score: 10});
  hundred[1] = {...hundred[1], score: 30};
  const mismatch = await fixture(assessment({positive: hundred,
    core: {status: 'mismatch', reason: '主要职责是Java应用研发，运维关键词不构成主业匹配'}}));
  await mismatch.run(); assert.equal(mismatch.calls.delivery, 0); assert.equal(mismatch.calls.greeting, 0);
  assert.match(mismatch.result().reason, /核心职责不匹配/); assert.match(mismatch.result().reason, /分数100/);
  const uncertain = await fixture(assessment({core: {status: 'uncertain', reason: '岗位没有给出实际核心工作'}}));
  await uncertain.run(); assert.equal(uncertain.calls.delivery, 0); assert.match(uncertain.result().reason, /核心职责待确认/);
  const critical = await fixture(assessment({unknown: [{reason: '必须独立主持全英文技术会议，语言能力待本人确认', critical: true}]}));
  await critical.run(); assert.equal(critical.calls.delivery, 0); assert.equal(critical.calls.greeting, 0);
  assert.match(critical.result().reason, /关键硬性条件待确认/);
  const suitable = await fixture(assessment({unknown: [{reason: '同类监控产品品牌差异，可沟通了解', critical: false}]}));
  await suitable.run(); assert.equal(suitable.calls.delivery, 1); assert.equal(suitable.calls.greeting, 1);
  assert(suitable.logs.some(item => item.args[0].startsWith('AI筛选通过：') && item.args[1].includes('及格线20')));
  assert.equal(suitable.helper.conf.formData.aiFiltering.score, 20, 'Do not rewrite the saved threshold');
  const lowScore = await fixture(assessment({positive: [{dimension: 'responsibilities', reason: '只有部分职责相关', score: 15}]}));
  await lowScore.run(); assert.equal(lowScore.calls.delivery, 0); assert.match(lowScore.result().reason, /低于筛选及格线20/);
  const fabricated = await fixture(assessment({core: {...assessment().core, resumeEvidence: '十年Java微服务应用研发经历'}}));
  await fabricated.run(); assert.equal(fabricated.calls.delivery, 0); assert.match(fabricated.result().reason, /匹配证据待确认/);
  const changed = await fixture(assessment(), helper => {helper.conf.formData.aiFiltering.score = 99;});
  await changed.run(); assert.equal(changed.calls.delivery, 0); assert.equal(changed.helper.workflow.status.value, 'stop');
  const invalid = await fixture('{"positive":[{"reason":"关键词相关","score":100}],"negative":[]}');
  await invalid.run(); assert.equal(invalid.calls.delivery, 0); assert.equal(invalid.calls.greeting, 0);
  const unfiltered = await fixture(assessment());
  const deliver = unfiltered.helper.workflow.items.find(item => item.id === '岗位投递').task();
  await assert.rejects(deliver({helper: unfiltered.helper}, unfiltered.job), /没有通过有效的AI筛选/);
  assert.equal(unfiltered.calls.delivery, 0);
  // Passing one object or an older policy cannot authorize a different job or changed policy.
  const executedJob = suitable.helper.jobMaps.get(jobData.key);
  suitable.context.BHAssertFiltered(suitable.helper, executedJob);
  assert.throws(() => suitable.context.BHAssertFiltered(suitable.helper, {...executedJob}), /没有通过有效的AI筛选/);
  suitable.helper.conf.formData.aiFiltering.score = 99;
  assert.throws(() => suitable.context.BHAssertFiltered(suitable.helper, executedJob), /没有通过有效的AI筛选/);
  const read = (value, extra = {}) => suitable.context.BHReadFiltering(value, {requireCore: true, jobData, resumeText: resume, ...extra});
  assert.equal(read(assessment({positive: [{dimension: 'responsibilities', score: 100, reason: '单项满分'}]})).requiresReview, true);
  assert.equal(read(assessment({positive: [assessment().positive[0], {...assessment().positive[0], reason: '重复维度'}]})).requiresReview, true);
  assert.equal(read(assessment({unknown: ['未区分关键性的未知项']})).requiresReview, true);
  const zeros = await fixture(assessment({positive: assessment().positive.concat({dimension: 'preferences', score: 0}),
    negative: [{score: 0, reason: '没有明确冲突'}]}));
  await zeros.run(); assert.equal(zeros.calls.delivery, 1); assert.equal(zeros.calls.greeting, 1);
  const legacy = read({positive: [{reason: '工具相同', score: 100}], negative: []});
  assert.equal(legacy.requiresReview, true, 'Legacy output is skipped for review, never auto-approved');
  assert.equal(read(assessment()).requiresReview, false);
  await transferableChecks();
  const preferredSource = {...jobData, jobDescription: jobData.jobDescription + '\n有证券行业运维经验者优先考虑。'};
  const preferredUnknown = {reason: '证券行业经验未明确', critical: true, requirement: '有证券行业运维经验'};
  const preferred = read(assessment({unknown: [preferredUnknown]}), {jobData: preferredSource});
  assert.equal(preferred.requiresReview, false, 'The actual JD says preferred even if the model marks it critical');
  assert.match(preferred.message, /原文标为优先项/);
  const mixedSource = {...preferredSource, jobDescription: preferredSource.jobDescription + '\n必须具备全日制本科及以上学历。'};
  const degree = {reason: '全日制学历待确认', critical: true, requirement: '全日制本科及以上学历'};
  const mixed = read(assessment({unknown: [preferredUnknown, degree]}), {jobData: mixedSource});
  assert.equal(mixed.reviewReason, '关键硬性条件待确认');
  assert.deepEqual(Array.from(mixed.criticalUnknown), [degree.reason]);
  const repeatedSource = {...preferredSource, jobDescription: preferredSource.jobDescription + '\n必须有证券行业运维经验。'};
  assert.equal(read(assessment({unknown: [preferredUnknown]}), {jobData: repeatedSource}).requiresReview, true);
  const unsupported = read(assessment({unknown: [{...degree, requirement: '有金融行业运维经验'}]}), {jobData: mixedSource});
  assert.equal(unsupported.requiresReview, true, 'A paraphrased or missing source does not waive a critical requirement');
  const format = read(assessment({core: {...assessment().core, jobEvidence: '维护Ｌｉｎｕｘ服务器，及Kubernetes集群',
    resumeEvidence: '具备Linux服务器⽣产运维经历'}}));
  assert.equal(format.requiresReview, false, 'Width, list punctuation and PDF radicals do not invalidate real evidence');
  assert.match(fabricated.result().reason, /简历证据未能在原文中定位/);
  await continuationAndHistory();
  await storageChecks();
  await salaryChecks();
  console.log('PASS: real workflow blocks 100-score core mismatch, uncertain responsibilities, critical unknowns, fabricated evidence, low scores, malformed responses and policy changes before delivery or greeting; suitable role with minor tool differences passes once; final delivery guard cannot reuse another job or stale approval; saved threshold preserved. All delivery and messaging endpoints are mocks.');
}

async function transferableChecks() {
  const job = {...jobData, jobName: '基础设施交付工程师',
    jobDescription: '负责客户Linux环境部署、监控与故障处理，并协调项目验收。'};
  const related = assessment({core: {status: 'transferable',
    reason: '岗位含Linux交付及运行保障，已有生产运维和故障处理经历可用于客户环境。',
    jobEvidence: 'Linux环境部署、监控与故障处理', resumeEvidence: '监控和故障处理'},
    positive: [{dimension: 'responsibilities', reason: '生产运行保障职责可迁移', score: 18},
      {dimension: 'skills', reason: 'Linux、监控和排障可用于交付', score: 16}],
    unknown: [{reason: '客户使用的虚拟化品牌未确认', critical: false}]});
  const eligible = await fixture(related, null, {jobs: [job]});
  await eligible.run();
  assert.equal(eligible.calls.delivery, 1, 'A 34-point adjacent role can pass the saved 20-point threshold');
  const record = [...eligible.saved.values()][0];
  assert.equal(record.screening.score, 34);
  assert.equal(record.screening.fit, '职责可迁移');
  const options = {requireCore: true, jobData: job, resumeText: resume};
  const read = (value, overrides = {}) => eligible.context.BHReadFiltering(value, {...options, ...overrides});
  const withHardGate = {...related, unknown: [{reason: '必需证书待确认', critical: true}]};
  assert.equal(read(withHardGate).reviewReason, '关键硬性条件待确认');
  assert.equal(read(related, {resumeText: undefined}).reviewReason, '可迁移职责缺少原文');
  assert.equal(read({...related, core: {...related.core, resumeEvidence: '主导过客户上线验收'}}).reviewReason, '匹配证据待确认');
  console.log('PASS: a moderate-score role with supported transferable duties reaches delivery, with hard requirements and source evidence still enforced.');
}

async function continuationAndHistory() {
  const jobs = ['A', 'B', 'C', 'D', 'E'].map(key => ({...jobData, key, jobName: key}));
  let page = 0;
  const intermittent = await fixture(assessment(), (_helper, job) => {
    if (['A', 'C', 'D'].includes(job.jobData.key)) throw Error('模拟 AI 请求超时');
  }, {jobs, loadMore: async () => ++page < 2});
  await intermittent.run();
  assert.equal(intermittent.calls.details, 5, 'The same failed job is not retried on pagination');
  assert.equal(intermittent.calls.delivery, 2, 'A healthy job resets the failure streak');
  const exported = await intermittent.context.BHListDeliveryHistory({uid: 'offline'}, false);
  assert.deepEqual(Object.fromEntries(Array.from(exported, row => [row.jobKey, row.outcome])),
    {A: 'failed', B: 'delivered', C: 'failed', D: 'failed', E: 'delivered'});
  const successful = exported.find(row => row.jobKey === 'B');
  assert.equal(successful.screening.score, 85);
  assert.match(successful.description, /Kubernetes集群/);
  assert.match(successful.reason, /平台已确认投递/);
  assert(!JSON.stringify(exported).includes('synthetic-secret'));
  const csv = intermittent.context.BHDeliveryCSV([{...successful, title: '=1+1'}]);
  assert(csv.startsWith('\uFEFF') && csv.includes('"\'=1+1"') && csv.includes('"已投递"'));

  const streak = await fixture(assessment(), () => {throw Error('模拟持续错误');}, {jobs});
  await streak.run();
  assert.equal(streak.calls.details, 3);
  assert.equal(streak.calls.delivery, 0);
  assert.match(streak.helper.workflow.errorMessage.value, /连续 3 个岗位处理失败/);
  const untouched = [...streak.saved.values()].filter(row => row.outcome === 'unprocessed');
  assert.equal(untouched.length, 2);
  assert(untouched.every(row => row.reason.includes('连续 3 个岗位')));

  let partlyDelivered;
  partlyDelivered = await fixture(assessment(), null, {jobs: jobs.slice(0, 3),
    submit(job) {
      if (job.encryptJobId === 'B') throw Error('平台响应丢失');
    },
    greet(job) {
      if (job.jobData.key !== 'A') return;
      partlyDelivered.context.BHRecordGreetingSubmission(job);
      throw Error('第二条招呼失败');
    }});
  await partlyDelivered.run();
  const byKey = Object.fromEntries([...partlyDelivered.saved.values()].map(row => [row.jobKey, row]));
  assert.equal(byKey.A.outcome, 'delivered');
  assert.equal(byKey.A.greetingSubmitted, 1);
  assert.match(byKey.A.reason, /第二条招呼失败/);
  assert.equal(byKey.B.outcome, 'unconfirmed');
  assert.equal(byKey.C.outcome, 'delivered');
  assert.equal(partlyDelivered.helper.statistics.todayData.value.success, 2);
  partlyDelivered.helper.workflow.reset();
  await partlyDelivered.run();
  assert.equal(partlyDelivered.calls.delivery, 3, 'Settled or ambiguous delivery is not resubmitted on continue/reset');
}

async function storageChecks() {
  const background = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
  const dbRows = new Map();
  const store = {
    get: async key => dbRows.get(JSON.stringify(key)),
    put: async (row, key) => dbRows.set(JSON.stringify(key), structuredClone(row)),
    async openCursor({lower}, direction) {
      const entries = [...dbRows.entries()].map(([key, row]) => [JSON.parse(key), row])
        .filter(([key]) => key[0] === lower[0] && key[1] > lower[1])
        .sort(([a], [b]) => a[1].localeCompare(b[1]));
      if (direction === 'prev') entries.reverse();
      const cursor = index => entries[index] && {value: entries[index][1], continue: async () => cursor(index + 1)};
      return cursor(0);
    },
  };
  const context = vm.createContext({IDBKeyRange: {bound: (lower, upper) => ({lower, upper})},
    me: async () => ({transaction: () => ({store, done: Promise.resolve()})})});
  const at = background.indexOf('let BHDeliveryDatabase;'), end = background.indexOf('/* end delivery history storage */', at);
  const method = background.indexOf('async backgroundTest(e,request){');
  vm.runInContext(background.slice(at, end) + 'globalThis.Service=class {' +
    background.slice(method, background.indexOf('async fetch(...e){', method)) + '};', context);
  const service = new context.Service();
  const request = (action, fields = {}) => service.backgroundTest('boss-helper:delivery-history:v1', {action, account: 'test', ...fields});
  const entries = Array.from({length: 101}, (_, index) => ({id: `${1794000000000 + index}-00000000-0000-0000-0000-000000000000`,
    revision: 1, outcome: 'unconfirmed'}));
  for (let i = 0; i < entries.length; i += 25) await request('write', {rows: entries.slice(i, i + 25)});
  await request('write', {rows: [{...entries[0], revision: 2, outcome: 'delivered'}]});
  await request('write', {rows: [entries[0]]});
  const first = await request('list');
  assert.equal(first.rows.length, 100);
  assert.equal(first.rows[0].outcome, 'delivered', 'A late checkpoint must not replace confirmed delivery');
  assert.equal((await request('list', {after: first.next})).rows[0].id, entries.at(-1).id);
  assert.equal((await request('recent')).rows.length, 20);
  assert.equal((await request('list', {account: 'other'})).rows.length, 0);
  console.log('PASS: isolated failures continue, success resets the streak, third failure records unprocessed jobs, confirmed and ambiguous sends are separated, history reload/export/pagination and stale-write protection.');
}

async function salaryChecks() {
  const preset = 'local:web-geek-job-FormData';
  const form = {salaryRange: {enable: true, value: [18, 25, false], advancedValue: {
    M: [18000, 25000, false], D: [500, 1000, false], H: [50, 80, false]}}, unrelated: 'preserved'};
  let saved = structuredClone(form), writes = 0;
  const context = vm.createContext({xh: {skip: reason => ({reason})}, Oh: (_label, factory) => factory,
    iu: {backgroundTest: async () => ({version: 1, from: [18, 25, false]}),
      storageGet: async key => {assert.equal(key, preset); return structuredClone(saved);},
      storageSet: async (key, value) => {assert.equal(key, preset); saved = structuredClone(value); writes++; return true;}}});
  vm.runInContext(section('function ph(e,t)', 'function hh(e)') +
    section('function BHSalarySkipReason(', 'const BHDeliveryRecords') +
    'globalThis.SalaryTask=class {' + section('salaryRange=Oh(', 'companySizeRange=Oh(') + '};', context);
  const conf = {formData: form, formDataKey: () => preset};
  const task = new context.SalaryTask().salaryRange({helper: {conf}});
  const check = salary => task({}, {jobData: {salary}});
  assert.match((await check('30-60K·14薪')).reason, /18 - 25 K/);
  await context.BHApplyLocalSalaryChoice(conf);
  assert.equal(saved.salaryRange.onlyMinimum, true);
  assert.equal(form.salaryRange.onlyMinimum, true);
  assert.equal(saved.unrelated, 'preserved');
  assert.equal(await check('30-60K·14薪'), undefined);
  assert.equal(await check('250-300K'), undefined);
  assert.equal(await check('15-18K'), undefined);
  assert.match((await check('12-17K')).reason, /18 K 起/);
  assert.equal(await check('30000-45000元/月'), undefined);
  assert.match((await check('12000-17999元/月')).reason, /18000 元\/月 起/);
  assert.match((await check('90-120元/时')).reason, /50 - 80/);
  assert.equal(await check('面议'), undefined);
  form.salaryRange.onlyMinimum = false;
  await context.BHApplyLocalSalaryChoice(conf);
  assert.equal(writes, 1, 'A manual opt-out must not be overwritten');
  assert.match((await check('30-60K')).reason, /18 - 25 K/);
  const alternate = structuredClone(form);
  delete alternate.salaryRange.onlyMinimum;
  await context.BHApplyLocalSalaryChoice({formData: alternate, formDataKey: () => preset + '-other'});
  assert.equal(writes, 1, 'A different preset must not be migrated');
  console.log('PASS: saved salary floor applies once to the matching preset; compiled workflow admits high monthly ranges, respects the floor and preserves hourly range behavior.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
