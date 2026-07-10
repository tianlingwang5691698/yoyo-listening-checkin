# 图书馆静谧主题设计总览

第二套可切换主题：`library / 图书馆静谧`。当前阶段只完成设计规范与视觉评审稿，未修改运行时代码。

## 视觉基准

- [首页基准图](./home-reference.png)
- [全局设计规范](../../LIBRARY_THEME_DESIGN_SPEC.md)

## 九个模块

| 模块 | 逐页规范 | 视觉板 | 专属呈现 |
| --- | --- | --- | --- |
| 听力 | [listening.md](./listening.md) | [listening-board.png](./listening-board.png) | 声音书签、黄铜时间轴、套卷唱针 |
| 阅读 | [reading.md](./reading.md) | [reading-board.png](./reading-board.png) | 馆藏目录、跨栏书页、页边批注 |
| 语法 | [grammar.md](./grammar.md) | [grammar-board.png](./grammar-board.png) | 句法字模、校样台、解析边栏 |
| 词汇 | [vocabulary.md](./vocabulary.md) | [vocabulary-board.png](./vocabulary-board.png) | 词典书脊、索引抽屉、抽认签 |
| 写作 | [writing.md](./writing.md) | [writing-board.png](./writing-board.png) | 稿纸、编辑批注、校对回函 |
| 口语 | [speaking.md](./speaking.md) | [speaking-board.png](./speaking-board.png) | 阅览室口语角、黄铜麦克风、声纹批注 |
| 音频 | [audio.md](./audio.md) | [audio-board.png](./audio-board.png) | 唱片目录、章节索引、桌面唱机 |
| 成长 | [growth.md](./growth.md) | [growth-board.png](./growth-board.png) | 借阅记录册、日期索引、成长档案 |
| 我的 | [profile.md](./profile.md) | [profile-board.png](./profile-board.png) | 读者证、藏书票、家庭档案夹 |

## 实施顺序

1. 先接入 `library` 主题注册、全局 token、顶部与底部导航，并保留雾蓝玻璃默认主题。
2. 按“首页与我的 → 听力与音频 → 阅读、语法、词汇 → 写作、口语 → 成长与日报”逐组实现，每组复用现有业务与数据链路。
3. 全页面、全状态验收后再开放主题切换；不得出现只换颜色、主体仍沿用雾蓝玻璃结构的页面。

## 实施约束

- 页面可以使用独立 WXML 呈现分支，但请求、计算、提交、缓存、路由和云端字段必须共用。
- 加载、空、正常、完成、错误和离线状态都要进入主题验收。
- 视觉板中的示例文字和数字仅用于布局评审，不进入运行代码。
- 本目录已由 `project.config.json` 排除，不进入小程序上传包。
