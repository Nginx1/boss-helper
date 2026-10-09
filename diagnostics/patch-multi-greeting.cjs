const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'boss.js');
let source = fs.readFileSync(file, 'utf8');
const original = source;
function replaceOnce(before, after) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0)
    throw new Error('Patch anchor missing or ambiguous: ' + before.slice(0, 90));
  source = source.slice(0, at) + after + source.slice(at + before.length);
}
const helpers = String.raw`
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

`;
replaceOnce('aiGreeting:{enable:!1,prompt:BHGreetingPrompt},',
  'greetingMessageCount:3,aiGreeting:{enable:!1,prompt:BHGreetingPrompt},');
replaceOnce('你正在代替求职者本人，在BOSS直聘上向招聘负责人发送第一句招呼语。',
  '你正在代替求职者本人，在BOSS直聘上向招聘负责人发送一组初次招呼。');
replaceOnce('输出要求：生成一条45至85个汉字的中文招呼语，语气专业自然，内容为礼貌开场、1至2个真实匹配点和沟通意愿。不得使用“精通”“专家”“百分百匹配”“完全胜任”等夸张表达。只输出最终招呼语，不输出分析、标题、引号、Markdown或换行。',
  '输出要求：根据消息条数配置生成2至3条中文招呼语，语气专业自然，依次表达岗位兴趣、1至2个真实匹配点和沟通意愿。不得使用“精通”“专家”“百分百匹配”“完全胜任”等夸张表达。同一组只问候一次，每条内容不同。只输出最终消息的JSON数组，不输出分析、标题、序号或Markdown。');
replaceOnce('最终只输出一条45至85个汉字的招呼语。',
  '最终按消息条数配置输出2至3条招呼语的JSON数组。');
replaceOnce('function BHAssertCanSend(helper) {', helpers + 'function BHAssertCanSend(helper) {');
replaceOnce('async function BHGenerateCachedAI(owner, task, job, config, messages) {\n  const started',
  'async function BHGenerateCachedAI(owner, task, job, config, messages) {\n  const greetingCount = BHGetGreetingCount(owner.ctx.conf?.formData);\n  if (task === "greetings") messages = BHBuildGreetingPrompt(messages, greetingCount);\n  const started');
replaceOnce('const result = await BHDirectGenerate(config, messages, {timeout,',
  'let result = await BHDirectGenerate(config, messages, {timeout,');
replaceOnce('if (task === "filtering") hh(result.text);\n        BHAICacheWrite',
  'if (task === "filtering") hh(result.text);\n        if (task === "greetings") result = {...result, text: JSON.stringify(BHParseGreetingTexts(result.text, greetingCount))};\n        BHAICacheWrite');
replaceOnce('no output generated|AI返回为空|AI筛选返回格式无效|状态码:',
  'no output generated|AI返回为空|AI筛选返回格式无效|AI招呼返回格式无效|状态码:');
replaceOnce('let n=await e.helper.chatModel.chat(`greetings`,t).then(e=>e.text);await e.helper.sendMessage?.(t,n)',
  'let n=await e.helper.chatModel.chat(`greetings`,t).then(e=>e.text),r=BHParseGreetingTexts(n,BHGetGreetingCount(e.helper.conf.formData)).map(content=>({type:`text`,content}));await e.helper.sendMessage?.(t,r)');
replaceOnce('u.parts=[{type:`text`,text:v,state:`done`}],u.metadata=',
  'u.parts=[{type:`text`,text:e===`greetings`?BHParseGreetingTexts(v,BHGetGreetingCount(this.ctx.conf.formData)).join(`\n\n`):v,state:`done`}],u.metadata=');
replaceOnce(']),V(`div`,null,[H(h0,null,{default:F(()=>[H(c,{color:`primary`,"data-help":`配置需要使用的LLM大模型`',
  ']),H(I1,{label:`AI招呼消息条数`,description:`默认3条，依次表达岗位兴趣、真实匹配点和沟通意愿；每条按消息发送延迟依次发送。条数不包含BOSS自带招呼语。`},{default:F(()=>[H(U1,{modelValue:BHGetGreetingCount(P(n).formData),"onUpdate:modelValue":e=>{P(n).formData.greetingMessageCount=BHGetGreetingCount({greetingMessageCount:e});P(n).confSaving()},min:2,max:3,step:1,disabled:P(t).workflowRunning.value},null,8,[`modelValue`,`disabled`])]),_:1}),V(`div`,null,[H(h0,null,{default:F(()=>[H(c,{color:`primary`,"data-help":`配置需要使用的LLM大模型`');
new vm.Script(source, {filename: file});
const backup = file + '.codex-backup-before-multi-greeting-20261008';
fs.writeFileSync(backup, original, {flag: 'wx'});
fs.writeFileSync(file, source, 'utf8');
console.log('Patched multi-message AI greetings; backup: ' + backup);
