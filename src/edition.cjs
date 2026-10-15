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
  output = replaceOnce(output, 'M(P(Rm).hideHeader?`Helper`:`Boss-Helper`)', 'M(P(Rm).hideHeader?BHProject.shortName:BHProject.name)');
  output = replaceOnce(output, 't.value=`https://onlinecalculator.cc/public/favicon.svg`', 't.value=BHProject.maskIcon');
  output = replaceSection(output, 'n[14]||=V(`div`,null,[U(` 使用 {{}}', ',V(`div`,b0,',
    'n[14]||=V(`div`,null,[U(` 使用 {{}} 渲染变量，例如 {{ data.jobName }}、{{ data.salaryDesc }}、{{ data.brandName }}。两条或三条招呼在 AI 配置中选择，详细字段见项目 docs/prompt-variables.md。 `)],-1)');
  output = replaceOnce(output, 'stop(){this.workflow?.stop()}', 'stop(){this.workflow?.stop();this._bhAssistant?.pause()}');
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
    'V(`div`,{style:{display:`flex`,gap:`8px`,margin:`12px 0`}},[H(c,{onClick:()=>BHOpenAssistant(P(t),`resume`)},{default:F(()=>[U(`简历生成提示词`)]),_:1}),H(c,{onClick:()=>BHOpenAssistant(P(t),`replies`)},{default:F(()=>[U(`回复助手`)]),_:1})]),H(I1,{label:`AI招呼消息条数`');
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
