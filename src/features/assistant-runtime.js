/* Adapter to the frozen runtime. No extra polling or automatic message publishing. */
function BHAssistantAccount(helper) {
  const page = window._PAGE || {};
  return String(page.uid || page.userId || helper.geek?.msgBuilder?.config?.userId || page.encryptUserId || '');
}

function BHAssistantStorage() {
  return {get: (key, fallback) => iu.storageGet(key, fallback), set: (key, value) => iu.storageSet(key, value)};
}

function BHAssistantProfileKey(helper) {
  const account = BHAssistantAccount(helper);
  if (!account) throw Error('请登录 BOSS 后再保存简历。');
  return 'local:assistant-resume-v1:' + account;
}

function BHGetAssistant(helper) {
  if (helper._bhAssistant) return helper._bhAssistant;
  const assistant = new BHRReplyAssistant({
    account: () => BHAssistantAccount(helper),
    selfId: () => helper.geek?.msgBuilder?.config?.userId,
    now: () => Date.now(), setTimeout: (fn, delay) => setTimeout(fn, delay), clearTimeout: id => clearTimeout(id),
    autoEnabled: () => helper.conf.formData.aiReply?.enable,
    policyStamp: () => {
      const form = helper.conf.formData, profile = helper._bhAssistant?.profile;
      return JSON.stringify([helper.conf.formDataKey?.(), form.aiReply?.prompt, form.aiReply?.model,
        form.aiGreeting?.model, form.aiFiltering?.model, profile?.resumeText, profile?.goals]);
    },
    deliveryRunning: () => !!helper.workflowRunning?.value,
    model: () => {
      const form = helper.conf.formData;
      const key = form.aiReply?.model || form.aiGreeting?.model || form.aiFiltering?.model;
      return helper.models.modelData.value.find(model => model.key === key)?.data || null;
    },
    prompt: () => helper.conf.formData.aiReply?.prompt,
    job: thread => {
      for (const record of helper.jobMaps?.values() || []) {
        const boss = record.rawData?.boss;
        if (boss && jh(boss) && String(boss.data?.bossId || '') === thread.peer) return record.jobData;
      }
      return {};
    },
    generate: (config, messages) => BHDirectGenerate(config, messages, {
      timeout: Math.max(30000, Math.min(Number(config.other?.timeout) || 180000, 180000)), maxOutputTokens: 1800,
    }),
    wait: async cancelled => {
      await helper._bhPacing?.waitReady(cancelled);
      if (cancelled()) return;
      const seconds = Number(helper.conf.formData.delayMessageSending);
      const delay = Number.isFinite(seconds) ? Math.max(1, seconds) : 5;
      await BHWaitUntil(performance.now() + delay * 1000, cancelled);
    },
    publish: (metadata, text) => new Promise((resolve, reject) => {
      const geek = helper.geek;
      if (!geek?.client?.connected || !geek.msgBuilder) return reject(Error('消息连接未就绪。'));
      const message = geek.msgBuilder.createTextMessage(metadata, {text});
      let settled = false;
      const done = error => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => done(Error('消息确认超时')), 15000);
      try { geek.client.publish('chat', geek.msgBuilder.encode(message), {qos: 1, retain: true}, done); }
      catch (error) { done(error); }
    }),
  });
  helper._bhAssistant = assistant;
  return assistant;
}

function BHAttachAssistant(helper) {
  const assistant = BHGetAssistant(helper), geek = helper.geek;
  if (!geek?.client || assistant.boundClient === geek.client) return;
  assistant.detach?.();
  const client = geek.client;
  const updateConnection = () => { assistant.connection = client.connected ? '消息已连接' : '消息连接中，等待新消息'; assistant.changed(); };
  const onMessage = (_topic, payload) => {
    try { assistant.ingest(geek.msgBuilder.decode(payload instanceof Uint8Array ? payload : new Uint8Array(payload))); }
    catch { /* Non-chat packets and invalid payloads do not become prompts. */ }
  };
  client.on('message', onMessage); client.on('connect', updateConnection); client.on('close', updateConnection);
  assistant.boundClient = client; updateConnection();
  assistant.detach = () => {
    client.removeListener('message', onMessage); client.removeListener('connect', updateConnection); client.removeListener('close', updateConnection);
    assistant.boundClient = null;
  };
}

async function BHAssistantConnect(helper) {
  if (helper.geek?.client && !helper.geek.client.disconnecting) { BHAttachAssistant(helper); return; }
  if (!helper._bhAssistantConnecting) helper._bhAssistantConnecting = (async () => {
    helper.geek = new tue();
    await helper.geek.connect(); BHAttachAssistant(helper);
  })().catch(error => {
    const assistant = BHGetAssistant(helper);
    assistant.connection = '消息连接失败，请检查 BOSS 登录后点击继续回复辅助。';
    assistant.autoBlocked = true; assistant.changed();
    throw error;
  }).finally(() => { helper._bhAssistantConnecting = null; });
  return helper._bhAssistantConnecting;
}

function BHAssistantIsChat(path) {
  return /^\/web\/geek\/chat(?:\/|\?|$)/.test(String(path || ''));
}

async function BHAssistantStart(helper) {
  if (helper._bhAssistantReady) return helper._bhAssistantReady;
  helper._bhAssistantReady = (async () => {
    await helper.conf.confInit(); await helper.models.initModel();
    const assistant = BHGetAssistant(helper);
    try { assistant.profile = await iu.storageGet(BHAssistantProfileKey(helper), null); }
    catch { assistant.profile = null; }
    const stopAuto = hr(() => !!helper.conf.formData.aiReply?.enable, value => assistant.setAutoEnabled(value), {immediate: true});
    const stopPreset = hr(() => helper.conf.formDataKey?.(), () => assistant.pause('配置预设已切换，请核对后继续回复辅助。'));
    const onInput = event => {
      const target = event.composedPath?.()[0] || event.target;
      if (target?.getRootNode?.().host?.tagName?.toLowerCase().startsWith('boss-helper')) return;
      if (target?.closest?.('.chat-input,.chat-editor,#chat-input,.chat-message-input,.chat-box textarea,.chat-conversation [contenteditable="true"]'))
        assistant.pause('检测到你正在聊天窗口手动输入，已暂停回复辅助。');
    };
    document.addEventListener('input', onInput, true);
    window.addEventListener('pagehide', () => {
      assistant.pause(); assistant.detach?.(); stopAuto(); stopPreset(); document.removeEventListener('input', onInput, true);
    }, {once: true});
    return assistant;
  })();
  return helper._bhAssistantReady;
}

function BHAssistantMenu(helper, visible) {
  const existing = document.getElementById('boss-helper-assistant-menu');
  if (!visible) { existing?.remove(); return; }
  if (!existing) {
    const menu = document.createElement('boss-helper-menu'); menu.id = 'boss-helper-assistant-menu';
    document.body.appendChild(menu);
  }
}

function BHOpenAssistant(helper, startTab = 'resume') {
  RX().create(BHAssistantPanel, {props: {helper: an(helper), startTab}, destroyOnClose: true}).open();
}
/* end personal assistant runtime */
