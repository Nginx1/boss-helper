const assert = require('node:assert/strict');

function replaceOnce(input, before, after) {
  assert.equal(input.split(before).length - 1, 1, 'Runtime anchor changed: ' + before.slice(0, 80));
  return input.replace(before, after);
}
function replaceSection(input, start, end, replacement) {
  const a = input.indexOf(start), b = input.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Runtime boundaries changed: ' + start);
  assert.equal(input.indexOf(start, a + start.length), -1, 'Ambiguous runtime boundary: ' + start);
  return input.slice(0, a) + replacement + input.slice(b);
}

function personalizeBoss(input, {projectConfig, versionPanel, appMenu, assistantModules, assistantPanel}) {
  let output = replaceSection(input, ',gF=new Map;', 'var yF=class', ';' + projectConfig + '\n' +
    '/* personal assistant features */\n' + assistantModules + '\nvar BHAssistantPanel=' + assistantPanel.trim() + ';\n');
  output = replaceOnce(output,
    'initNetConf(){vF().then(e=>{this.netConf.value=e}),this.netConfTimer||=setInterval(()=>{vF().then(e=>{this.netConf.value=e})},1e3*60*5)}',
    'initNetConf(){if(this.netConfTimer!==null){clearInterval(this.netConfTimer);this.netConfTimer=null}this.netConf.value=BHPersonalNetConf()}');
  output = replaceSection(output, 'var _d={chrome:', ',vd={debug:', 'var _d={}');
  output = replaceSection(output, 'wQ=I({__name:`Version`', ',TQ={slots:', 'wQ=' + versionPanel.trim());
  output = replaceSection(output, 'Sse=I({__name:`AppMenu`', ',Cse=`', 'Sse=' + appMenu.trim());
  output = replaceOnce(output, 'xF=`0.5.2`', 'xF=BHProject.version');
  output = replaceOnce(output, 't4=`2026/05/24`', 't4=`personal-`+BHProject.version');
  output = replaceOnce(output, 'items:[`gpt-4o`,`gpt-5.4`,`deepseek-chat`', 'items:[`gpt-4o`,`gpt-5.4`,`deepseek-flash`,`deepseek-chat`');
  output = replaceOnce(output, 'M(P(Rm).hideHeader?`Helper`:`Boss-Helper`)', 'M(P(Rm).hideHeader?BHProject.shortName:BHProject.name)');
  output = replaceOnce(output, 't.value=`https://onlinecalculator.cc/public/favicon.svg`', 't.value=BHProject.maskIcon');
  output = replaceSection(output, 'n[14]||=V(`div`,null,[U(` 使用 {{}}', ',V(`div`,b0,',
    'n[14]||=V(`div`,null,[U(` 使用 {{}} 渲染变量，例如 {{ data.jobName }}、{{ data.salaryDesc }}、{{ data.brandName }}。两条或三条招呼在 AI 配置中选择，详细字段见项目 docs/prompt-variables.md。 `)],-1)');
  output = replaceOnce(output, 'stop(){this.workflow?.stop()}', 'stop(){this.workflow?.stop();this._bhAssistant?.pause()}');
  output = replaceSection(output, 'function hh(e){', 'async function gh(', 'function hh(e){return BHReadFiltering(e)}');
  output = replaceSection(output, 'aiFiltering=Oh(', 'activityFilter=Oh(',
    'aiFiltering=Oh(`AI筛选`,e=>{if(e.helper.conf.formData.aiFiltering.enable){if(!e.helper.chatModel.createAgent(e.helper.conf.formData.aiFiltering,`filtering`,{json:!0}))throw new yh(`aiFiltering.model`,`AI筛选模型未配置`);return BHScreenJob}},{state:`ai`,stateMsg:`AI筛选中`});');
  output = replaceOnce(output,
    'Oh(`岗位投递`,()=>async(e,{rawData:t})=>(await uh({securityId:t.jobitem.securityId,encryptJobId:t.jobitem.encryptJobId}),{status:`success`,msg:`投递成功`}))',
    'Oh(`岗位投递`,()=>async(e,BHJob)=>{BHAssertFiltered(e.helper,BHJob);let t=BHJob.rawData;return await uh({securityId:t.jobitem.securityId,encryptJobId:t.jobitem.encryptJobId}),{status:`success`,msg:`投递成功`}})');
  output = replaceOnce(output,
    'aiFiltering:{label:`AI过滤`,"data-help":`根据工作内容让gpt分析过滤，真是太稳健了，不放过任何一个垃圾`}',
    'aiFiltering:{label:`AI筛选`,"data-help":`先判断核心职责，再按匹配分筛选；关键硬性条件未确认时跳过。通过及过滤理由可在日志查看。`}');
  output = replaceOnce(output, 'e.bhStopReason===`communication`?`扩展通信中断`:`平台保护停止`',
    'e.bhStopReason===`communication`?`扩展通信中断`:e.bhStopReason===`ai`?`AI服务停止`:`平台保护停止`');
  output = replaceOnce(output, 'async function BHDirectGenerate(e,t,{timeout:n=9e4,maxOutputTokens:r=8000}={})',
    'async function BHDirectGenerate(e,t,{timeout:n=9e4,maxOutputTokens:r=8000,signal:BHSignal,fast:BHFast=!1}={})');
  output = replaceOnce(output, 'signal:AbortSignal.timeout(n)',
    'signal:BHSignal?AbortSignal.any([AbortSignal.timeout(n),BHSignal]):AbortSignal.timeout(n)');
  output = replaceOnce(output, 'typeof l==`object`&&l&&Object.assign(c,l);let d=e.advanced?.extra_headers',
    'typeof l==`object`&&l&&Object.assign(c,l);BHLimitAIOutput(c,i,r);BHFastAIRequest(c,e,i,BHFast);let d=e.advanced?.extra_headers');
  output = replaceOnce(output, 'if(!h&&g){let e=String(g).match(/\\{[\\s\\S]*\\}/);e&&(h=e[0])}',
    'if(m.choices?.[0]?.finish_reason===`length`||m.status===`incomplete`)throw Error(`AI输出被截断，请检查模型配置或缩短提示词；未使用推理草稿代替最终结果`);');
  output = replaceOnce(output, 'async onMount(t){t||=this.rootVue.$route.path;',
    'async onMount(t){t||=this.rootVue.$route.path;if(BHAssistantIsChat(t)){await Hn();BHAssistantMenu(this,!0);this.initNetConf();await BHAssistantConnect(this).catch(()=>{});return}BHAssistantMenu(this,!1);');
  output = replaceOnce(output, 'this.geek=new tue,await this.geek.connect(),hr(Rm.value',
    'await BHAssistantConnect(this),hr(Rm.value');
  output = replaceOnce(output, '}),await e.onMount()}var n4=', '}),await BHAssistantStart(e),await e.onMount()}var n4=');
  output = replaceOnce(output, 'aiReply:{label:`AI回复`,"data-help":`万一消息太多，回不过来了呢. 功能暂未实现`}',
    'aiReply:{label:`AI回复草稿`,"data-help":`收到新文字消息后起草回复，由本人核对后确认发送。也可在回复助手中手动起草。`}');
  output = replaceOnce(output, 'data:P(n).formData.aiReply,disabled:``,onShow:',
    'data:P(n).formData.aiReply,lock:P(t).workflow?.status.value===`running`,onShow:');
  output = replaceOnce(output, 'H(I1,{label:`AI招呼消息条数`',
    'V(`div`,{style:{display:`flex`,gap:`8px`,margin:`12px 0`}},[H(c,{onClick:()=>BHOpenAssistant(P(t),`resume`)},{default:F(()=>[U(`简历生成提示词`)]),_:1}),H(c,{onClick:()=>BHOpenAssistant(P(t),`replies`)},{default:F(()=>[U(`回复助手`)]),_:1})]),V(`p`,{style:{fontSize:`13px`,margin:`8px 0`}},[U(P(n).formData.aiFiltering.enable?`AI筛选已开启，及格线 `+(P(n).formData.aiFiltering.score??20)+`/100；还须核心职责匹配，关键硬性条件已确认。低于60分的及格线较宽松，可按需要调整。`:`AI筛选已关闭：当前只执行已启用的普通筛选，请先确认再投递。`)]),H(I1,{label:`AI招呼消息条数`');
  assert(!/Ocyss|ocyss|68412205|net-conf\.json|reward\.png|关于&赞赏|greasyfork|feishu\.cn|crxsoso\.com|chromewebstore\.google|microsoftedge\.microsoft\.com|addons\.mozilla/.test(output), 'An original project entry remains in the runtime');
  return output;
}

function personalizeContent(input, resumeFiles, project) {
  let output = replaceOnce(input, 'var content=(function(){', 'var content=(function(){\n' + resumeFiles + '\n');
  output = replaceOnce(output, 'async contentScriptTest(e){',
    'async contentScriptTest(e){if(e===`boss-helper:capabilities:v1`)return ' +
    JSON.stringify({version: project.version, capabilities: ['resumeImport']}) + ';');
  return replaceOnce(output, 'async storageGet(e,t){', 'async extractResume(e){return BHRReadResume(e)}async storageGet(e,t){');
}

module.exports = {personalizeBoss, personalizeContent, replaceOnce};
