# 安装与更新

个人版本：boss-helper（我的维护版）0.7.0。

## 在现有安装上更新

本机维护目录为 `D:\Download\boss-helper-0.5.2-edge`。保留目录路径，在 Edge 扩展管理页重新加载这份扩展，可以继续使用原来的配置存储。

1. 先停止正在运行的投递任务。
2. 打开 `edge://extensions`，找到本扩展并点击“重新加载”。
3. 刷新 BOSS 页面。
4. 在版本信息中确认显示 0.7.0 和“我的维护版”。
5. 在岗位页的 AI 配置中打开“简历生成提示词”，或在沟通页右上角个人菜单打开“简历与提示词／回复助手”。

不要同时运行旧版和个人维护版。

## 从安装 ZIP 新装

解压安装 ZIP，打开 Edge 扩展页，启用开发人员模式，点击“加载解压缩的扩展”，选择直接包含 `manifest.json` 的文件夹。

更换加载目录可能产生新的扩展身份和配置存储。需要迁移时，先在旧版导出配置，再在新版导入并手动保存。不要删除旧版，直到新版配置已核对完成。

## 从工程构建

安装 Node.js 22.13 或以上，无需安装 npm 依赖。在项目根目录执行：

```powershell
node scripts/build.cjs
node scripts/test.cjs
node scripts/package.cjs
```

默认构建写入项目根目录，保持原加载路径；也可用 `node scripts/build.cjs --out dist/edge` 生成独立安装目录。打包命令生成 `dist/boss-helper-personal-0.7.0.zip`。

检查只使用模拟请求和消息，不会真实投递。
