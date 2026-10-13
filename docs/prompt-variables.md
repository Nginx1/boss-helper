# 提示词变量

在提示词中用 `{{ 变量路径 }}` 插入岗位数据。当前岗位列表原始字段位于 `data`，例如：

| 变量 | 内容 |
| --- | --- |
| `{{ data.jobName }}` | 职位名称 |
| `{{ data.salaryDesc }}` | 薪资描述 |
| `{{ data.brandName }}` | 公司名称 |
| `{{ data.jobExperience }}` | 工作经验要求 |
| `{{ data.jobDegree }}` | 学历要求 |
| `{{ data.cityName }}` | 城市 |
| `{{ data.areaDistrict }}` | 行政区 |
| `{{ data.bossName }}` | 招聘者姓名 |
| `{{ data.bossTitle }}` | 招聘者职称 |
| `{{ data.skills }}` | 技能列表 |

可用字段以当前 BOSS 页面实际数据为准。缺失值不会自动补成事实，可通过 Prompt 测试和岗位日志检查。

启用高德距离筛选后，可使用配置面板已经列出的距离变量，例如 `{{ amap.straightDistance }}`。没有初始化地图功能时，不应假设距离数据已存在。

AI 招呼在 AI 配置里选择两条或三条。维护版先整体生成、校验，再依次发送；停止任务后不会继续发送剩余消息。保持简历事实和已有约束，不要让模型补造经历。
