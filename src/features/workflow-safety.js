/* bh-safe-pacing:20261006 — local skips, bounded AI cache, timing, stop signals. */
class BHSafetyStopError extends Error {
  constructor(message, reason = "platform") {
    super(message);
    this.bhStopReason = reason;
    this.name = reason === "communication" ? "扩展通信中断" : reason === "cancelled" ? "任务已停止" : "平台保护停止";
    this.bhStopAll = true;
  }
}

function BHPlatformRestriction(response, httpStatus = 200) {
  const message = [response?.message, response?.msg,
    response?.zpData?.bizData?.chatRemindDialog?.content].filter(Boolean).join("；");
  const failed = httpStatus >= 400 || (response?.code != null && response.code !== 0);
  if (!failed) return null;
  if (httpStatus === 429 || /操作过于频繁|请求过于频繁|访问过于频繁|操作频繁/.test(message))
    return new BHSafetyStopError(message || "平台返回请求频率限制（429），已停止整批投递");
  if (/今天已与\d+位BOSS沟通|达到.{0,12}(限制|上限)|今日.{0,20}(上限|限制)|沟通次数.{0,12}(用完|不足|限制|上限)/.test(message))
    return new BHSafetyStopError(message || "已达到平台沟通限制");
  const redirect = String(response?.zpData?.redirectUrl || response?.zpData?.url || "");
  if (httpStatus === 401 || httpStatus === 403 ||
      /验证码|安全验证|人机验证|账号.{0,10}(异常|限制|受限)|账户.{0,10}(异常|限制|受限)|未登录|登录.{0,6}(过期|失效)|请.{0,5}登录/.test(message) ||
      /captcha|verify|passport\/user\/login/i.test(redirect))
    return new BHSafetyStopError(message || `平台要求检查登录或验证（${httpStatus}），已停止整批投递`);
  return null;
}

function BHShouldStop(error) {
  return !!error?.bhStopAll || error instanceof ih || error instanceof rh ||
    (error?.error_type === "boss-helper" && !!BHPlatformRestriction({code: 1, message: error.message}));
}

async function BHPlatformJSON(response) {
  const status = response.status ?? 200;
  let body;
  try { body = await response.json(); }
  catch (error) {
    const stop = BHPlatformRestriction({}, status);
    if (stop) throw stop;
    throw error;
  }
  const stop = BHPlatformRestriction(body, status);
  if (stop) throw stop;
  if (status >= 400) throw new th(`平台请求失败（HTTP ${status}）：${body?.message || body?.msg || "未知错误"}`);
  return body;
}


/* bh-multi-greeting:20261008 — generate and validate all parts before sending. */
function BHGetGreetingCount(form) {
  return Number(form?.greetingMessageCount) === 2 ? 2 : 3;
}

function BHBuildGreetingPrompt(messages, count) {
  const oldSystem = "输出要求：生成一条45至85个汉字的中文招呼语，语气专业自然，内容为礼貌开场、1至2个真实匹配点和沟通意愿。不得使用“精通”“专家”“百分百匹配”“完全胜任”等夸张表达。只输出最终招呼语，不输出分析、标题、引号、Markdown或换行。";
  const oldUser = "最终只输出一条45至85个汉字的招呼语。";
  const prepared = messages.map(message => typeof message.content === "string"
    ? {...message, content: message.content.replace(oldSystem,
      "语气专业自然，只使用1至2个真实匹配点，不得使用精通、专家、百分百匹配、完全胜任等夸张表达。")
        .replace(oldUser, "")}
    : message);
  const structure = count === 2
    ? "第一条：礼貌开场、对具体岗位的兴趣及一个真实匹配点。第二条：补充一个相关经历或能承担的工作，并自然表达沟通意愿。"
    : "第一条：礼貌开场，表达对具体岗位的兴趣。第二条：结合岗位描述说明1至2个有真实经历支持的匹配点。第三条：自然表达进一步沟通和介绍相关经历的意愿。";
  prepared.push({role: "system", content:
    "本次任务是向同一位招聘负责人发送一组初次招呼，消息条数为" + count + "条。" + structure +
    "每条都是可以独立发送的自然中文短句，每条15至60个汉字，总计70至140个汉字。" +
    "同一组只问候一次，每条提供不同信息，不重复催促，不假装HR已经回复，也不声称已经提交附件。" +
    "沿用前文求职者真实经历和禁止编造规则；岗位要求不能反推为个人经历，缺乏匹配依据时只表达兴趣。" +
    "这是对前文招呼语条数、长度和输出格式要求的更新，其余事实约束继续生效。" +
    "只输出恰好" + count + "个字符串组成的JSON数组，每个元素是一条最终可发送的消息；不输出分析、标题、序号、Markdown或其他字段。"});
  return prepared;
}

function BHParseGreetingTexts(text, count) {
  const raw = String(text ?? "").trim();
  const clean = raw.replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  let parts;
  try {
    const parsed = JSON.parse(clean);
    parts = Array.isArray(parsed) ? parsed : parsed?.messages;
    if (!Array.isArray(parts) || parts.length !== count)
      throw new Error("消息条数不符");
  } catch (error) {
    // Older/custom prompts may still return a paragraph. Split at clause boundaries only.
    if (/^[\[{]|\x60{3}|<\/?think>|^(?:分析|思考|推理)[：:]/i.test(clean))
      throw new Error("AI招呼返回格式无效：需要" + count + "条消息");
    let clauses = clean.match(/[^。！？!?；;\n]+[。！？!?；;]?/g)?.map(part => part.trim()).filter(Boolean) ?? [];
    if (clauses.length < count)
      clauses = clean.match(/[^，,。！？!?；;\n]+[，,。！？!?；;]?/g)?.map(part => part.trim()).filter(Boolean) ?? [];
    if (clauses.length < count)
      throw new Error("AI招呼返回格式无效：无法自然拆成" + count + "条消息");
    parts = [];
    for (let slot = 0; slot < count; slot++) {
      const remaining = count - slot;
      const target = clauses.join("").length / remaining;
      let part = clauses.shift();
      while (clauses.length > remaining - 1 && part.length < target)
        part += clauses.shift();
      parts.push(part);
    }
  }
  if (parts.length !== count || parts.some(part => typeof part !== "string"))
    throw new Error("AI招呼返回格式无效：消息必须是文本");
  parts = parts.map(part => part.trim());
  if (parts.some(part => part.length < 8 || part.length > 100 ||
      /\x60{3}|<\/?think>|^(?:分析|思考|推理)[：:]/i.test(part)) ||
      parts.join("").length > 260 ||
      new Set(parts.map(part => part.replace(/[\s，。！？、；：,.!?;:]/g, ""))).size !== count)
    throw new Error("AI招呼返回格式无效：消息为空、过长或重复");
  return parts;
}
/* end bh-multi-greeting helpers */

function BHIsBridgeUnavailable(error) {
  return /Provider unavailable|heartbeat check timeout|Could not establish connection|Receiving end does not exist|Extension context invalidated|message (?:port|channel).{0,30}closed|Extension bridge request failed/i.test(String(error?.message || error));
}

function BHBridgeStop(error) {
  const stop = new BHSafetyStopError(
    "扩展内部通信中断，已停止本轮。请重新加载扩展并刷新BOSS页面后继续：" + String(error?.message || error), "communication");
  stop.cause = error;
  return stop;
}

function BHRestoreJobDetail(record, detail) {
  const info = detail.jobInfo, boss = detail.bossInfo, brand = detail.brandComInfo, job = record.jobData;
  job.activeTime = brand.activeTime;
  job.activeTimeStr = boss.activeTimeDesc;
  job.jobDescription = info.postDescription ?? "";
  job.city = info.locationName;
  job.address = info.address;
  job.addressCoords = [info.longitude, info.latitude];
  job.boss = {...job.boss, isOnline: boss.bossOnline, isCertificated: boss.certificated};
  job.brand = {...job.brand, labels: brand.labels, introduce: brand.introduce, stageName: brand.stageName};
}

function BHAssertCanSend(helper) {
  if (["stop", "error"].includes(helper.workflow?.status?.value))
    throw new BHSafetyStopError("投递已停止，未发送后续消息", "cancelled");
}

function BHHasJobDetail(job) {
  const detail = job?.rawData?.detail;
  return !!detail && jh(detail) && !!detail.jobInfo && !!detail.bossInfo && !!detail.brandComInfo;
}

async function BHWaitUntil(deadline, isStopped) {
  while (!isStopped() && performance.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, Math.min(100, deadline - performance.now())));
  }
}

class BHPacingController {
  constructor(helper) {
    this.helper = helper;
    this.readyAt = 0;
    this.current = null;
    this.resetStats();
  }
  resetStats() {
    this.stats = {startedAt: performance.now(), processed: 0, delivered: 0,
      localSkipped: 0, aiMs: 0, aiCacheHits: 0, cooldownMs: 0,
      startWaitMs: 0, pageWaitMs: 0, tasks: {}, jobs: []};
    this.helper.bhPerformance = this.stats;
  }
  startJob(job) {
    this.current = {key: job.jobData.key, name: job.jobData.jobName,
      startedAt: performance.now(), platform: false, delivered: false, cooldownMs: 0, tasks: {}};
  }
  async waitReady(isStopped) {
    const started = performance.now();
    await BHWaitUntil(this.readyAt, isStopped);
    const elapsed = performance.now() - started;
    this.stats.cooldownMs += elapsed;
    if (this.current) this.current.cooldownMs += elapsed;
  }
  async waitConfigured(kind, seconds, isStopped) {
    const started = performance.now();
    await lu(seconds, isStopped);
    this.stats[kind === "page" ? "pageWaitMs" : "startWaitMs"] += performance.now() - started;
  }
  async beforeTask(task, job, isStopped) {
    const touchesPlatform = task.id === "岗位详情获取" ? !BHHasJobDetail(job) :
      ["岗位投递", "Boss信息获取", "打招呼"].includes(task.id);
    if (touchesPlatform && !this.current?.platform) {
      await this.waitReady(isStopped);
      if (isStopped()) throw new BHSafetyStopError("投递已停止，未请求后续岗位", "cancelled");
      if (this.current) this.current.platform = true;
    }
  }
  canPrepareGreeting(job) {
    return BHHasJobDetail(job) && !this.current?.platform && this.readyAt > performance.now();
  }
  recordTask(task, elapsed, result) {
    const label = task.label || task.id;
    this.stats.tasks[label] = (this.stats.tasks[label] || 0) + elapsed;
    if (this.current) {
      this.current.tasks[label] = (this.current.tasks[label] || 0) + elapsed;
      if (task.id === "岗位投递" && result?.status === "success") this.current.delivered = true;
    }
  }
  recordAI(key, elapsed, cacheHit) {
    if (this.current?.key !== key) return;
    this.stats.aiMs += elapsed;
    if (cacheHit) this.stats.aiCacheHits++;
  }
  finishJob(result) {
    const job = this.current;
    if (!job) return;
    job.elapsedMs = performance.now() - job.startedAt;
    job.status = result?.status || "stop";
    if (job.platform) {
      const configured = Number(this.helper.conf.formData.delayDeliveryInterval);
      this.readyAt = performance.now() + (Number.isFinite(configured) ? Math.max(1, configured) : 20) * 1000;
    }
    this.stats.processed++;
    if (job.delivered) this.stats.delivered++;
    if (!job.platform && job.status === "warn") this.stats.localSkipped++;
    this.stats.jobs.push(job);
    if (this.stats.jobs.length > 150) this.stats.jobs.shift();
    console.info("[BOSS Helper][Timing] job", job);
    this.current = null;
  }
  finishRun() {
    this.stats.elapsedMs = performance.now() - this.stats.startedAt;
    const seconds = ms => (ms / 1000).toFixed(1);
    const stages = Object.entries(this.stats.tasks).map(([name, ms]) => `${name} ${seconds(ms)}秒`).join("；");
    const message = `处理 ${this.stats.processed} 个岗位，成功开聊 ${this.stats.delivered} 个，纯本地跳过 ${this.stats.localSkipped} 个。` +
      `总耗时 ${seconds(this.stats.elapsedMs)}秒；AI耗时 ${seconds(this.stats.aiMs)}秒（含重试等待），缓存命中 ${this.stats.aiCacheHits} 次；` +
      `平台冷却等待 ${seconds(this.stats.cooldownMs)}秒；开始等待 ${seconds(this.stats.startWaitMs)}秒；翻页等待 ${seconds(this.stats.pageWaitMs)}秒。` +
      (stages ? `各任务耗时（包含任务内部等待）：${stages}` : "");
    console.info("[BOSS Helper][Timing] run", this.stats);
    this.helper.logs?.info("本轮投递耗时统计", message);
  }
}

async function BHAICacheKey(task, jobKey, config, messages) {
  if (!["filtering", "greetings"].includes(task) || !globalThis.crypto?.subtle) return null;
  try {
    const input = new TextEncoder().encode(JSON.stringify([task, jobKey, config, messages]));
    const digest = await crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

function BHAICacheRead(cache, key) {
  if (!key) return null;
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) { cache.delete(key); return null; }
  cache.delete(key);
  cache.set(key, item);
  return structuredClone(item.result);
}

function BHAICacheWrite(cache, key, result) {
  if (!key || !result?.text?.trim()) return;
  try {
    cache.set(key, {expiresAt: Date.now() + 30 * 60 * 1000, result: structuredClone(result)});
    while (cache.size > 100) cache.delete(cache.keys().next().value);
  } catch { /* Cache failure must not interrupt a valid response. */ }
}

async function BHGenerateCachedAI(owner, task, job, config, messages) {
  const greetingCount = BHGetGreetingCount(owner.ctx.conf?.formData);
  if (task === "greetings") messages = BHBuildGreetingPrompt(messages, greetingCount);
  const started = performance.now();
  let cacheHit = false;
  try {
    const key = await BHAICacheKey(task, job.jobData.key, config, messages);
    const cached = BHAICacheRead(owner.resultCache, key);
    if (cached) {
      cacheHit = true;
      return cached;
    }
    const attempts = 2;
    const timeout = Math.max(30000, Math.floor((config.other?.timeout ?? 180000) / attempts));
    for (let attempt = 1; attempt <= attempts; attempt++) {
      BHAssertCanSend(owner.ctx);
      try {
        let result = await BHDirectGenerate(config, messages, {timeout,
          maxOutputTokens: task === "greetings" ? 3000 : 8000});
        if (!result?.text?.trim()) throw Error("AI返回为空");
        if (task === "filtering") hh(result.text);
        if (task === "greetings") result = {...result, text: JSON.stringify(BHParseGreetingTexts(result.text, greetingCount))};
        BHAICacheWrite(owner.resultCache, key, result);
        return result;
      } catch (error) {
        const bridgeUnavailable = BHIsBridgeUnavailable(error);
        const retryable = bridgeUnavailable || ["TimeoutError", "AbortError", "AI_NoOutputGeneratedError"].includes(error?.name) ||
          /timed out|failed to fetch|network|no output generated|AI返回为空|AI筛选返回格式无效|AI招呼返回格式无效|状态码:\s*(502|503|504)/i.test(String(error?.message || error));
        if (!retryable || attempt === attempts) throw bridgeUnavailable ? BHBridgeStop(error) : error;
        console.warn(`[BOSS Helper] AI request attempt ${attempt} failed, retrying after 15s`, error);
        await BHWaitUntil(performance.now() + 15000, () => ["stop", "error"].includes(owner.ctx.workflow?.status?.value));
      }
    }
  } finally {
    owner.ctx._bhPacing?.recordAI(job.jobData.key, performance.now() - started, cacheHit);
  }
}
/* end bh-safe-pacing helpers */
