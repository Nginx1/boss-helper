const BHDeliveryRecords = new WeakMap();
const BHDeliveryHistoryRoute = 'boss-helper:delivery-history:v1';
const BHDeliveryLabels = {delivered: '已投递', filtered: '已过滤', review: '待人工确认',
  failed: '处理失败', unconfirmed: '投递结果待确认', unprocessed: '未处理', already_contacted: '此前已沟通'};

function BHDeliveryText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.slice(0, limit * 2)
    .replace(/(状态码:\s*\d{3}):[^\n]*?(?=（累计|$)/gi, '$1')
    .replace(/(AI响应不是合法JSON):[^\n]*?(?=（累计|$)/gi, '$1')
    .replace(/(?:Bearer\s+|\b(?:api[-_ ]?key|authorization|zp_token|securityId)\b\s*[:=]\s*)[^\s，；,;"'<>]+/gi, '[凭据已隐藏]')
    .replace(/\b[A-Z0-9._+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱已隐藏]')
    .replace(/(?<!\d)1[3-9](?:[ \t-]?\d){9}(?!\d)/g, '[手机号已隐藏]')
    .slice(0, limit);
}

function BHMakeDeliveryRecord(job, runId) {
  const now = Date.now();
  return {id: `${now}-${crypto.randomUUID()}`, runId, at: new Date(now).toISOString(),
    version: BHProject.version, revision: 0, jobKey: BHDeliveryText(job.key, 150),
    title: BHDeliveryText(job.jobName || job.positionName, 180), company: BHDeliveryText(job.brand?.name, 180),
    salary: BHDeliveryText(job.salary, 80), location: BHDeliveryText(job.city || job.address, 180),
    experience: BHDeliveryText(job.experienceName, 80), education: BHDeliveryText(job.degreeName, 80),
    description: '', screening: null, delivery: 'not_sent', greetingSubmitted: 0};
}

function BHStartDeliveryRecord(job, run) {
  BHDeliveryRecords.set(job, {account: run.account, row: BHMakeDeliveryRecord(job.jobData, run.id)});
}

function BHRecordScreening(job, assessment, threshold) {
  const record = BHDeliveryRecords.get(job);
  if (!record) return;
  const {rating, coreMismatch, requiresReview, message, reviewReason, criticalUnknown = []} = assessment;
  const decision = coreMismatch ? '职责不匹配' : requiresReview ? '待人工确认' : rating < threshold ? '分数不足' : '通过';
  record.row.screening = {score: rating, threshold, decision, summary: BHDeliveryText(message, 5500),
    reviewReason: BHDeliveryText(reviewReason, 100),
    criticalUnknown: criticalUnknown.slice(0, 8).map(reason => BHDeliveryText(reason, 160))};
}

function BHRecordGreetingSubmission(job) {
  const record = BHDeliveryRecords.get(job);
  if (record) record.row.greetingSubmitted++;
}

async function BHPersistDelivery(helper, account, rows) {
  if (!account) return;
  const buffer = (helper._bhDeliveryBuffer ??= new Map());
  if (!buffer.has(account)) buffer.set(account, new Map());
  const pending = buffer.get(account);
  for (const row of rows) pending.set(row.id, {...row, revision: ++row.revision});
  try {
    while (pending.size) {
      const batch = [...pending.values()].slice(0, 25);
      const result = await iu.backgroundTest(BHDeliveryHistoryRoute, {action: 'write', account, rows: batch});
      if (result?.saved !== true) throw Error('未收到保存确认');
      for (const row of batch) if (pending.get(row.id) === row) pending.delete(row.id);
    }
  } catch {
    BHLogAI(helper, 'warn', '投递日志暂存于本页', `有 ${pending.size} 条尚未写入，下一次保存或导出时会再尝试。`);
  }
}

async function BHSubmitDelivery(context, job) {
  const helper = context.helper;
  BHAssertFiltered(helper, job);
  BHAssertCanSend(helper);
  const record = BHDeliveryRecords.get(job);
  if (record) {
    Object.assign(record.row, {stage: '岗位投递', outcome: 'unconfirmed', delivery: 'unconfirmed',
      reason: '已进入投递步骤，尚未记录到平台确认。', description: BHDeliveryText(job.jobData.jobDescription, 8000)});
    await BHPersistDelivery(helper, record.account, [record.row]);
  }
  let attempted = false;
  try {
    BHAssertCanSend(helper);
    BHAssertFiltered(helper, job);
    attempted = true;
    await uh(job.rawData.jobitem);
  } catch (error) {
    if (record && (!attempted || error.bhDeliveryRejected)) record.row.delivery = 'not_sent';
    throw error;
  }
  if (record) {
    Object.assign(record.row, {outcome: 'delivered', delivery: 'confirmed', reason: '平台已确认投递，后续步骤尚在处理。'});
    await BHPersistDelivery(helper, record.account, [record.row]);
  }
  helper.statistics.todayData.value.success++;
  return {status: 'success', msg: '投递成功'};
}

async function BHFinishDeliveryRecord(helper, job, stage, result, failure, interrupted) {
  const record = BHDeliveryRecords.get(job);
  if (!record) return;
  const {row} = record;
  let reason = result?.reason || failure?.message || result?.msg;
  if (row.delivery === 'confirmed') {
    row.outcome = 'delivered';
    reason = '平台已确认投递。' + (failure ? reason || '后续步骤失败。' : interrupted ? '后续步骤已停止。' : '');
  } else if (row.delivery === 'unconfirmed') {
    row.outcome = 'unconfirmed';
    reason = `未取得平台投递确认。${reason || ''}`;
  } else if (failure?.bhStopReason === 'cancelled' || (interrupted && !failure && result?.status !== 'warn')) {
    row.outcome = 'unprocessed'; reason = '本轮已停止，未进入投递。';
  } else if (failure) row.outcome = 'failed';
  else if (stage === '已沟通') row.outcome = 'already_contacted';
  else if (row.screening?.decision === '待人工确认') row.outcome = 'review';
  else row.outcome = 'filtered';
  Object.assign(row, {stage, reason: BHDeliveryText(reason, 5500),
    description: BHDeliveryText(job.jobData.jobDescription, 8000), finishedAt: new Date().toISOString()});
  await BHPersistDelivery(helper, record.account, [row]);
  return row.delivery;
}

async function BHSaveUnprocessedDelivery(helper, run, reason) {
  if (!run.account) return;
  const rows = [];
  for (const job of helper.jobList.value) {
    const status = helper.jobResultMaps.get(job.key)?.status;
    if (run.seen.has(job.key) || run.settled.has(job.key) || status === 'success' || status === 'warn') continue;
    rows.push({...BHMakeDeliveryRecord(job, run.id), outcome: 'unprocessed', stage: '等待处理',
      reason: BHDeliveryText(reason, 5500)});
  }
  if (rows.length) await BHPersistDelivery(helper, run.account, rows);
}

async function BHListDeliveryHistory(helper, recent) {
  const account = String(helper.uid || '');
  if (!account) throw Error('请登录 BOSS 后查看投递记录。');
  await BHPersistDelivery(helper, account, []);
  const records = new Map();
  let after = '';
  do {
    const result = await iu.backgroundTest(BHDeliveryHistoryRoute, {action: recent ? 'recent' : 'list', account, after});
    if (!Array.isArray(result?.rows)) throw Error('投递记录读取失败，请重新加载扩展并刷新页面。');
    for (const row of result.rows) records.set(row.id, row);
    after = result.next || '';
  } while (!recent && after);
  for (const row of helper._bhDeliveryBuffer?.get(account)?.values() || []) records.set(row.id, row);
  const sorted = [...records.values()].sort((a, b) => b.id.localeCompare(a.id));
  return recent ? sorted.slice(0, 20) : sorted;
}

function BHDeliveryCSV(records) {
  const columns = ['时间', '岗位', '公司', '薪资', '地点', '结果', '处理环节', '原因', 'AI分数', '及格线',
    'AI判断', 'AI评分理由', '招呼已提交条数', '岗位描述', '批次'];
  const cell = value => {
    let text = String(value ?? '');
    if (/^\s*[=+@-]|^[\t\r\n]/.test(text) && typeof value !== 'number') text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const data = records.map(row => [row.at, row.title, row.company, row.salary, row.location, BHDeliveryLabels[row.outcome],
    row.stage, row.reason, row.screening?.score, row.screening?.threshold, row.screening?.decision, row.screening?.summary,
    row.finishedAt ? row.greetingSubmitted : '', row.description, row.runId]);
  return '\uFEFF' + [columns, ...data].map(row => row.map(cell).join(',')).join('\r\n');
}
