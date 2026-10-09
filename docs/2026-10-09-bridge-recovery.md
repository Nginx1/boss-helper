# BOSS Helper 日志修复说明（2026-10-09）

已更新 `D:\Download\boss-helper-0.5.2-edge` 中的 `boss.js`、`content-scripts\content.js` 和 `background.js`。版本号仍为 0.5.2，保留 10 月 8 日的请求超时修复和两条／三条 AI 招呼功能。

## 日志反映的问题

1. 24 次 AI 筛选任务失败，主要错误为 `Provider unavailable: heartbeat check timeout 1000ms.`。每次同时出现“非流式聊天错误”和“任务失败”两条记录，两条记录对应同一次失败。代码与堆栈显示，这是扩展内容脚本联系后台时的心跳失败，再经页面通信桥转发回来。这段日志没有显示 BOSS 返回频率限制、验证码或 HTTP 429。
2. 一批岗位在极短时间内被“无活跃内容”过滤。重新运行时会创建新的岗位数据对象，旧代码发现原始详情已有缓存就直接返回，没有把活跃度、职位描述等字段写回新对象。这能够解释这些重复岗位的过滤现象；真正缺少活跃度数据的岗位仍按原规则处理。
3. 最后一条“投递已停止，未发送后续消息”来自发送前的停止检查。它说明任务此前已经进入停止或错误状态；仅凭这段日志无法确定由手动操作、上限设置还是其他流程触发。原先把这类取消统一命名为“平台保护停止”，并记录为任务执行错误，容易误解。

原心跳先通过定时器发送探测，响应窗口仅 1 秒。日志中多个错误落在相邻分钟的同一秒附近，与浏览器后台定时器节流的行为相符；这只是推断，日志无法证明当时页面可见性或后台进程状态。Chrome 官方说明了特定条件下隐藏页面定时器按分钟检查的机制：[后台定时器节流说明](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/)。

## 本次改动

- 心跳立即发送一次探测，默认等待窗口从 1 秒调整为 10 秒，成功、发送失败和超时都会清理监听器及定时器。
- 内容脚本等待后台转发结果，后台按实际发送页面的标签和框架编号回复，减少页面地址变化造成的回复丢失。
- 后台异步接收使用明确的 `return true` 和 `sendResponse` 保持通信通道。依据：[Chrome 扩展消息通信文档](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)。
- AI 阶段的内部通信失败最多重试一次，沿用 15 秒重试等待；连续失败停止整轮并提示重新加载。后面的岗位不再继续消耗在同类错误上。没有添加岗位投递或消息发送重试。
- 缓存详情每次都会重新填充岗位字段。需要新详情时，改用 Vue 数据监听等待结果，并在完成、失败或超时时清理监听。
- 取消发送显示“任务已停止／待继续”，不再归类为平台限制或任务执行错误；真正的平台限制仍保持整批停止。

发送与翻页间隔参数没有改动，仍使用已经保存的设置。原代码默认开始等待 10 秒、岗位操作间隔 20 秒、翻页等待 90 秒、每条消息发送前等待 5 秒。两条／三条招呼仍先整体生成和校验，再依次发送。

另外，日志里“网络/系统运维+安全专家”的 AI 解释把“CCNP 优先”作为硬性短板扣分，这条评分值得人工复核。本次没有自动放宽或更改岗位筛选标准。

## 如何生效和试用

1. 先停止正在运行的投递任务。
2. 打开 Edge 扩展管理页，在该扩展上点击“重新加载”。
3. 刷新 BOSS 页面，让页面、内容脚本和后台三部分一起使用新代码。
4. 保留现有间隔，先把投递上限设为 5 条并保存；试用时将 BOSS 页面保持在前台。
5. 查看是否还出现心跳超时，以及重复岗位是否仍大批显示“无活跃内容”。连续通信失败时应只停止本轮，并提示重新加载。

## 验证结果

两套离线测试均通过，直接抽取本次更新后的实际脚本进行验证：

- `diagnostics\bridge-recovery.test.cjs`：三个脚本语法、定时器延后到 60 秒时立即探测、后台 2 秒后响应、10 秒超时与监听清理、RPC 回传、运行时确认、实际标签／框架路由、缓存和新详情字段恢复、详情监听清理、一次重试、整批停止、取消与平台限制分类。
- `diagnostics\multi-greeting.test.cjs`：两条／三条招呼、原提示词保留、格式校验、缓存隔离、失败重试、发送顺序及 5 秒等待、停止后不发送剩余消息、筛选流程与既有请求超时修复。

所有请求和发送均为模拟，没有向 BOSS 发出真实请求或发送消息。尚需在重新加载后的 Edge 页面验证实际运行效果。

## 回退到本次修改前

三个脚本都保留了同目录备份，文件名后缀为 `.codex-backup-before-bridge-recovery-20261009`。该备份包含 10 月 8 日的多条招呼改动。

停止任务后，在 PowerShell 执行：

```powershell
Copy-Item -LiteralPath 'D:\Download\boss-helper-0.5.2-edge\boss.js.codex-backup-before-bridge-recovery-20261009' -Destination 'D:\Download\boss-helper-0.5.2-edge\boss.js' -Force
Copy-Item -LiteralPath 'D:\Download\boss-helper-0.5.2-edge\content-scripts\content.js.codex-backup-before-bridge-recovery-20261009' -Destination 'D:\Download\boss-helper-0.5.2-edge\content-scripts\content.js' -Force
Copy-Item -LiteralPath 'D:\Download\boss-helper-0.5.2-edge\background.js.codex-backup-before-bridge-recovery-20261009' -Destination 'D:\Download\boss-helper-0.5.2-edge\background.js' -Force
```

然后重新加载扩展并刷新 BOSS 页面。关键脚本的 SHA-256 与快照来源见 [version-history.json](version-history.json)。
