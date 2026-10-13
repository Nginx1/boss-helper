# boss-helper（我的维护版）

Nginx1 的 BOSS 直聘求职助手，当前个人版本 **0.6.0**。支持岗位筛选、AI 分析、两条或三条招呼、配置预设和运行日志。

项目仓库：[Nginx1/boss-helper](https://github.com/Nginx1/boss-helper)。个人维护分支：`personal/edge-0.6.0`；本地版本标签：`v0.6.0-personal.20261013`。

本版使用自己的名称、图标、版本信息、欢迎说明和反馈入口；不读取原作者的公告、问卷或扩展商店更新。“关于&赞赏”标签页已移除。

## 安装

本机现有安装目录仍为 `D:\Download\boss-helper-0.5.2-edge`。停止投递，在 Edge 扩展页重新加载，再刷新 BOSS 页面即可使用新版本。保持原目录有助于沿用现有配置。

安装 ZIP 的新装和配置迁移见 [安装说明](docs/install.md)。

## 构建与检查

需要 Node.js 18 或以上，无需安装第三方构建依赖。

```powershell
node scripts/build.cjs
node scripts/test.cjs
node scripts/package.cjs
```

构建默认更新根目录可加载文件。打包产生 `dist/boss-helper-personal-0.6.0.zip`。离线检查覆盖通信恢复、多条招呼、无外部公告轮询、个人入口、版本和生成物一致性；不会发真实消息。

## 维护

修改名称、版本和项目地址从 `src/project.json` 开始。自己的界面、配置及辅助源码在 `src`；构建和打包工具在 `scripts`；来源记录和冻结运行时在 `vendor`。

本工程是已打包扩展的独立维护工程，冻结运行时仍为编译代码；它不是完整原生 Vue/WXT 源码重写。此前已验证的通信、缓存、超时与多条招呼修复保留在发行版中。详细说明见 [维护文档](docs/maintenance.md)、[更新记录](CHANGELOG.md)、[提示词变量](docs/prompt-variables.md) 和 [数据与网络说明](PRIVACY.md)。

## 来源和许可

基于 Ocyss 的 MIT 开源项目衍生维护。原版权声明、个人维护版权和许可条件见 [LICENSE](LICENSE)，衍生来源见 [NOTICE](NOTICE)。个人版归 Nginx1 独立维护，不声称继承代码全部为原创。

2026-10-09 的维护历史、原有标签和修复记录继续保留，见 `docs/version-history.json`。该文件记录历史快照，不代表本版当前生成文件的哈希；当前安装文件以 `version-info.json` 和 `checksums.json` 为准。
