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

function personalizeBoss(input, {projectConfig, versionPanel, appMenu}) {
  let output = replaceSection(input, ',gF=new Map;', 'var yF=class', ';' + projectConfig + '\n');
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
  assert(!/Ocyss|ocyss|68412205|net-conf\.json|reward\.png|关于&赞赏|greasyfork|feishu\.cn|crxsoso\.com|chromewebstore\.google|microsoftedge\.microsoft\.com|addons\.mozilla/.test(output), 'An original project entry remains in the runtime');
  return output;
}

module.exports = {personalizeBoss, replaceOnce};
