I({
  __name: 'ResumeAndReplyAssistant',
  props: {helper: {type: Object, required: true}, startTab: {type: String, default: 'resume'}},
  emits: ['close'],
  setup(props, {emit}) {
    const helper = props.helper, assistant = BHGetAssistant(helper), storage = BHAssistantStorage();
    const tab = N(props.startTab), version = N(0), busy = N(false), status = N(''), error = N('');
    const resume = N(''), roles = N(''), city = N(''), salary = N(''), notes = N('');
    const redact = N(true), checked = N(false), preview = N(null), promptType = N('filtering');
    const selected = N({filtering: true, greetings: true, reply: true});
    const current = N(''), reviewed = N(false);
    let reviewSignature = '', alive = true;
    const unsubscribe = assistant.subscribe(() => {
      if (!alive) return;
      const thread = assistant.threads.get(current.value);
      const signature = thread ? [thread.key, thread.revision, thread.draft, thread.latestId].join('|') : '';
      if (signature !== reviewSignature) { reviewed.value = false; reviewSignature = signature; }
      version.value++;
    });
    Pi(() => { alive = false; unsubscribe(); });
    Ai(async () => {
      await helper._bhAssistantReady;
      if (!alive) return;
      const profile = assistant.profile;
      if (profile) {
        resume.value = profile.resumeText || '';
        roles.value = profile.goals?.roles || ''; city.value = profile.goals?.city || '';
        salary.value = profile.goals?.salary || ''; notes.value = profile.goals?.notes || '';
      }
    });
    const goals = () => ({roles: roles.value, city: city.value, salary: salary.value, notes: notes.value});
    function invalidate() { preview.value = null; checked.value = false; status.value = ''; }
    async function run(action) {
      if (busy.value) return;
      busy.value = true; error.value = ''; status.value = '';
      try { await action(); } catch (reason) { error.value = String(reason?.message || reason); }
      finally { busy.value = false; }
    }
    async function importFile(event) {
      const input = event.target, file = input.files?.[0]; if (!file) return;
      await run(async () => {
        if (file.size > 8 * 1024 * 1024) throw Error('简历文件不能超过 8 MB。');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let index = 0; index < bytes.length; index += 32768)
          binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
        const result = await BHExtractResume({name: file.name, data: btoa(binary)});
        if (!alive) return;
        resume.value = result.text; invalidate();
        status.value = '已在本地提取 ' + result.format + (result.pages ? '，共 ' + result.pages + ' 页' : '') +
          '。请核对文字顺序和完整性。' + (result.warnings?.length ? '\n' + result.warnings.join('\n') : '');
      });
      input.value = '';
    }
    async function generatePrompts() {
      preview.value = BHRBuildPrompts(resume.value, goals(), {redact: redact.value});
      promptType.value = 'filtering'; checked.value = false;
      status.value = '三组提示词已在本地生成。请查看预览、核对事实，再应用到当前配置。';
    }
    async function applyPrompts() {
      if (!checked.value || !preview.value) throw Error('请先生成提示词，并勾选已核对简历与意向。');
      await BHRApplyPrompts(helper, preview.value, Object.keys(selected.value).filter(key => selected.value[key]), storage);
      assistant.profile = {version: 1, resumeText: preview.value.resumeText, goals: preview.value.goals};
      assistant.pause('提示词已更新，请核对后继续回复辅助。');
      status.value = '选中的提示词已应用并保存。原模型、开关、筛选分数和发送间隔保持原设置。';
    }
    async function saveResume() {
      if (!checked.value) throw Error('请先核对简历内容和求职意向。');
      const profile = {version: 1, resumeText: BHRResumeText(resume.value, {redact: redact.value}), goals: goals(), savedAt: Date.now()};
      await storage.set(BHAssistantProfileKey(helper), profile); assistant.profile = profile;
      status.value = '已保存到本机当前 BOSS 账号；未上传简历文件。';
    }
    async function clearResume() {
      await storage.set(BHAssistantProfileKey(helper), null);
      assistant.profile = null; resume.value = ''; roles.value = ''; city.value = ''; salary.value = ''; notes.value = '';
      invalidate(); assistant.pause('简历已清除，已暂停回复辅助。');
      status.value = '已清除输入和本机保存的简历。已应用到配置的提示词仍需单独恢复或编辑。';
    }
    async function toggleAuto(value) {
      const previous = !!helper.conf.formData.aiReply.enable;
      helper.conf.formData.aiReply.enable = value;
      try { await helper.conf.confSaving(); assistant.setAutoEnabled(value); }
      catch (reason) { helper.conf.formData.aiReply.enable = previous; assistant.setAutoEnabled(previous); throw reason; }
    }
    const inputStyle = {width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', color: '#172033', fontSize: '14px', lineHeight: '1.6'};
    const button = (label, action, disabled = false, primary = false) => V('button', {
      type: 'button', disabled, onClick: action,
      style: {padding: '8px 12px', border: '1px solid ' + (primary ? '#0f766e' : '#cbd5e1'), borderRadius: '8px',
        background: primary ? '#0f766e' : '#fff', color: primary ? '#fff' : '#172033', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? '.5' : '1'},
    }, label);
    const text = (value, muted = false) => V('p', {style: {margin: '6px 0', color: muted ? '#64748b' : '#172033', whiteSpace: 'pre-wrap', lineHeight: '1.6'}}, value);
    const row = children => V('div', {style: {display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '12px 0'}}, children);
    const field = (label, state, placeholder, multiline = false) => V('label', {style: {display: 'block', margin: '10px 0'}}, [
      V('span', {style: {display: 'block', marginBottom: '4px', fontWeight: '600'}}, label),
      V(multiline ? 'textarea' : 'input', {value: state.value, placeholder, rows: multiline ? 3 : undefined, style: inputStyle,
        onInput: event => { state.value = event.target.value; invalidate(); }}),
    ]);
    const check = (label, value, action, disabled = false) => V('label', {style: {display: 'flex', alignItems: 'flex-start', gap: '7px', margin: '10px 0'}}, [
      V('input', {type: 'checkbox', checked: value, disabled, onChange: event => action(event.target.checked), style: {marginTop: '5px'}}), V('span', null, label),
    ]);
    function renderResume() {
      const generated = preview.value, type = promptType.value, messages = generated?.[type];
      return [
        text('导入简历，生成适合你自己的筛选、招呼和回复提示词。所有内容先预览，再应用。'),
        V('input', {type: 'file', accept: '.pdf,.docx,.txt,.md', disabled: busy.value, onChange: importFile, 'aria-label': '导入简历文件'}),
        text('支持 PDF、Word（DOCX）、TXT / Markdown，文件不超过 8 MB。扫描 PDF 需先识别文字；旧 DOC 请另存为 DOCX。', true),
        V('label', {style: {display: 'block', margin: '10px 0'}}, [V('strong', null, '简历正文（可直接粘贴或修正）'),
          V('textarea', {value: resume.value, rows: 10, placeholder: '在这里粘贴简历中的工作经历、项目、技能、学历及证书。', style: inputStyle,
            onInput: event => { resume.value = event.target.value; invalidate(); }}),
        ]),
        field('目标岗位', roles, '例如：运维负责人、基础设施项目经理'),
        row([V('div', {style: {flex: '1 1 220px'}}, [field('意向城市', city, '可留空，不推测城市限制')]),
          V('div', {style: {flex: '1 1 220px'}}, [field('薪资意向', salary, '可留空；仅作为意向，不自动向 HR 承诺')])]),
        field('其他意向或明确限制', notes, '例如出差、工作形式、希望强调的经历；未填写的不补造。', true),
        check('生成时隐藏手机号、邮箱和证件号', redact.value, value => { redact.value = value; invalidate(); }),
        row([button(busy.value ? '处理中…' : '生成三组提示词', () => run(generatePrompts), busy.value, true)]),
        generated ? V('section', {style: {padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px'}}, [
          V('strong', null, '提示词预览'),
          row(Object.entries({filtering: '筛选提示词', greetings: '招呼提示词', reply: '回复提示词'}).map(([key, label]) =>
            button(label, () => { promptType.value = key; }, false, type === key))),
          ...messages.map((message, index) => V('label', {style: {display: 'block', margin: '8px 0'}}, [
            V('span', null, message.role === 'system' ? '规则（可修改）' : '简历与任务上下文（可修改）'),
            V('textarea', {value: message.content, rows: 7, style: inputStyle, onInput: event => {
              generated[type][index].content = event.target.value; checked.value = false;
            }}),
          ])),
          ...Object.entries({filtering: '应用岗位筛选提示词', greetings: '应用招呼提示词', reply: '应用回复提示词'}).map(([key, label]) =>
            check(label, selected.value[key], value => { selected.value[key] = value; })),
        ]) : null,
        check('我已核对简历、求职意向和预览中的事实，确认没有编造经历。', checked.value, value => { checked.value = value; }),
        row([button('应用选中的提示词', () => run(applyPrompts), busy.value || !generated || !checked.value || helper.workflowRunning.value, true),
          button('保存简历到本机', () => run(saveResume), busy.value || !checked.value),
          button('恢复上一次提示词', () => run(async () => {
            await BHRRestorePrompts(helper, storage); assistant.pause('提示词已恢复，请核对后继续回复辅助。'); status.value = '已恢复当前预设上一次替换前的提示词。';
          }), busy.value || helper.workflowRunning.value),
          button('清除简历输入和本机保存', () => run(clearResume), busy.value)]),
        text('提取与生成模板均在本机完成。应用后，实际筛选、打招呼或起草回复会把相应简历内容发送给你配置的 AI 服务。导出配置时也会包含已经应用的提示词。', true),
      ];
    }
    function renderReplies() {
      const threads = [...assistant.threads.values()].sort((a, b) => b.latestAt - a.latestAt);
      const thread = assistant.threads.get(current.value);
      const stages = {waiting: '待起草', queued: '等待生成', generating: '正在生成', review: '待你确认', sending: '发送前等待／提交中', sent: '已提交发送', uncertain: '请核对发送结果', manual: '已人工接管', paused: '已暂停', error: '生成失败'};
      return [
        text('HR 新消息只生成草稿。接收人、最新问题和草稿由你核对后，才会提交发送。'),
        text(assistant.connection + (assistant.paused || assistant.autoBlocked ? ' · ' + assistant.pauseReason : ''), true),
        check('收到新消息时自动起草（不会自动发送）', !!helper.conf.formData.aiReply.enable,
          value => run(() => toggleAuto(value)), busy.value),
        V('label', {style: {display: 'block'}}, [V('span', null, '回复模型：'),
          V('select', {value: helper.conf.formData.aiReply.model || '', style: inputStyle, disabled: busy.value,
            onChange: event => run(async () => {
              const previous = helper.conf.formData.aiReply.model;
              helper.conf.formData.aiReply.model = event.target.value;
              try { await helper.conf.confSaving(); assistant.pause('回复模型已更改，请核对后继续。'); }
              catch (reason) { helper.conf.formData.aiReply.model = previous; throw reason; }
            })}, [V('option', {value: ''}, '沿用招呼模型，未配置时沿用筛选模型'),
            ...helper.models.modelData.value.map(model => V('option', {value: model.key}, (model.label || model.key) + (model.data?.model ? ' · ' + model.data.model : '')))]),
        ]),
        row([button('继续回复辅助', () => run(async () => { assistant.resume(); await BHAssistantConnect(helper); }), busy.value),
          button('停止回复辅助', () => { assistant.pause(); status.value = '已停止，未发送的草稿已取消。'; }),
          button('清空会话列表', () => { assistant.clear(); current.value = ''; reviewed.value = false; })]),
        text('只接收当前页面连接后到达的新文字消息；不自动拉取历史聊天。没有收到消息时，可在 BOSS 聊天页面保持连接。', true),
        !threads.length ? text('还没有收到新的 HR 文字消息。可以先在“简历与提示词”准备个人资料。', true) : null,
        row(threads.map(item => button(item.name + ' · ' + (stages[item.stage] || '待处理'), () => {
          current.value = item.key; reviewed.value = false; error.value = '';
        }, false, item.key === current.value))),
        thread ? V('section', {style: {border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px'}}, [
          V('strong', null, '接收人：' + thread.name + ' · 编号尾号 ' + thread.peer.slice(-4)),
          ...thread.history.slice(-8).map(message => text(message.role + '：' + message.text, message.role === '本人')),
          row([button(thread.stage === 'review' ? '重新起草' : '生成回复草稿', () => run(() => assistant.requestDraft(thread.key, {manual: true})),
            busy.value || assistant.paused || !!thread.sending || ['uncertain', 'sent'].includes(thread.stage), true),
          button('本会话人工接管', () => assistant.takeOver(thread.key), !!thread.sending)]),
          thread.stage === 'review' || thread.stage === 'sending' ? V('div', null, [
            V('label', null, [V('strong', null, '回复草稿（可修改）'), V('textarea', {value: thread.draft, rows: 5, style: inputStyle,
              disabled: !!thread.sending, onInput: event => assistant.editDraft(thread.key, event.target.value)})]),
            ...thread.confirm.map(item => text('待确认：' + item)),
            check('我已核对接收人、最新消息和回复内容，确认发送这一条。', reviewed.value, value => { reviewed.value = value; }, !!thread.sending),
            row([button('确认并发送这一条', () => run(async () => {
              await assistant.confirmSend(thread.key, {confirmed: reviewed.value}); reviewed.value = false; status.value = '已提交发送，请在 BOSS 聊天查看。';
            }), busy.value || !reviewed.value || !!thread.sending || helper.workflowRunning.value, true)]),
            helper.workflowRunning.value ? text('投递仍在运行，请先停止投递，再继续回复辅助并确认发送。', true) : null,
          ]) : null,
          thread.error ? text(thread.error) : null,
          thread.stage === 'sent' ? text('本条回复已提交，不会对同一条 HR 消息重复发送。') : null,
        ]) : null,
      ];
    }
    return () => {
      version.value;
      R();
      return B(hQ, {title: '简历与回复助手', portal: false,
        content: {style: {width: 'min(900px,94vw)', maxWidth: '900px', maxHeight: '92vh'}}, ui: {content: 'max-w-3xl'}}, {
        close: F(() => [V('button', {type: 'button', 'aria-label': '关闭助手', onClick: () => emit('close', false),
          style: {fontSize: '25px', lineHeight: '1', background: 'transparent', border: '0', color: '#64748b', cursor: 'pointer'}}, '×')]),
        body: F(() => [V('div', {style: {paddingRight: '4px'}}, [
          row([button('简历与提示词', () => { tab.value = 'resume'; }, false, tab.value === 'resume'),
            button('回复助手', () => { tab.value = 'replies'; }, false, tab.value === 'replies')]),
          ...(tab.value === 'resume' ? renderResume() : renderReplies()),
          status.value ? V('div', {role: 'status', style: {whiteSpace: 'pre-wrap', marginTop: '12px', color: '#0f766e'}}, status.value) : null,
          error.value ? V('div', {role: 'alert', style: {whiteSpace: 'pre-wrap', marginTop: '12px', color: '#b91c1c'}}, error.value) : null,
        ])]),
        footer: F(() => [button('关闭', () => emit('close', false))]), _: 1,
      });
    };
  },
})
