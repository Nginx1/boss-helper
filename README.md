# BOSS Helper 本地维护版

本目录是 Edge 扩展 0.5.2 的已打包文件，使用 Git 管理本地修复。当前维护标签为 `v0.5.2-local.20261009`，扩展自身的 `manifest.json` 版本仍为 0.5.2。

## 版本记录

| 标签 | 用途 |
| --- | --- |
| `v0.5.2-local.20261009` | 当前修复版本：通信恢复、缓存详情恢复、取消状态分类 |
| `v0.5.2-local.20261009-pre-bridge` | 本次通信修复前的恢复快照，包含原有两条／三条招呼和间隔设置 |

历史快照在 2026-10-09 按本地备份重建，三个脚本和旧测试使用同日修复前备份，其余静态资源来自建库时的项目目录。它不是完整的原始上游版本历史。更多内容见 [更新记录](CHANGELOG.md)、[修复说明](docs/2026-10-09-bridge-recovery.md) 和 [快照来源](docs/version-history.json)。

## 加载与验证

在 Edge 扩展页通过“加载解压缩的扩展”选择本目录。修改或切换版本后，先停止投递任务，再重新加载扩展并刷新 BOSS 页面。

本项目没有完整构建源码或安装依赖要求。安装 Node.js 后，可直接运行已有离线测试：

```powershell
node diagnostics\bridge-recovery.test.cjs
node diagnostics\multi-greeting.test.cjs
```

测试不发真实请求、不发送消息。历史恢复快照只包含多条招呼测试；通信测试随修复版本加入。

## 后续改动

在项目目录检查、测试并提交：

```powershell
git status
git diff
node diagnostics\bridge-recovery.test.cjs
node diagnostics\multi-greeting.test.cjs
git add --all
git commit -m "说明本次具体改动"
```

确认版本后创建唯一标签，例如 `git tag -a v0.5.2-local.20261010 -m "版本改动说明"`。同日多个版本在日期后追加序号，保留已经创建的标签。

## 查看和回退

```powershell
git log --oneline --decorate
git tag --list
git diff v0.5.2-local.20261009-pre-bridge v0.5.2-local.20261009 -- boss.js background.js content-scripts/content.js
```

要运行修复前版本，先停止投递任务，提交或保存尚未提交的改动，然后创建回退分支：

```powershell
git switch -c rollback/pre-bridge v0.5.2-local.20261009-pre-bridge
```

要回到当前维护版本：

```powershell
git switch main
```

每次切换后都重新加载扩展、刷新 BOSS 页面。旧的 `*.codex-backup-*` 文件保留在磁盘上，由 `.gitignore` 排除；它们不随仓库复制，测试需要的对照样本已单独纳入版本管理。

仓库保存在本机，未配置远程。提交作者暂设为 `Codex <codex@localhost>`，只影响此仓库；可用 `git config --local user.name` 和 `git config --local user.email` 改为自己的提交身份。
