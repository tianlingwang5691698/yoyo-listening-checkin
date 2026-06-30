# 改动记录索引

## 2026-06-30 上海中考英语结构化学习扩展

### 1. 新增学习入口

- `app.json`
  - 注册阅读、语法、素材、写作页面。
- `pages/home/index.js`
- `pages/home/index.wxml`
- `pages/home/completed/index.js`
  - 首页接入新增学习模块和完成记录。

### 2. 阅读模块

- `pages/reading/index.*`
  - 阅读首页和题目入口。
- `pages/reading/detail/index.*`
  - 阅读详情、答题、批改、学习包、历史提交回看。
- `pages/reading/flashcards/index.js`
  - 阅读学习卡片入口。
- `cloudfunctions/yoyo/services/reading.service.js`
  - 阅读题加载、批改、学习包、音频生成。
- `docs/ports/reading-detail.md`
  - 阅读详情端口约束和修改记录。

### 3. 语法模块

- `pages/grammar/index.*`
  - 语法题列表、练习、错题、解析。
- `cloudfunctions/yoyo/services/grammar.service.js`
  - 语法题加载、错题记录、进度记录、解析。
- `data/grammar*/`
  - 语法题结构化数据、主题分类、上传数据。

### 4. 写作模块

- `pages/writing/detail/index.*`
  - 作文题展示、作文提交、批改结果展示。
- `cloudfunctions/yoyo/services/writing.service.js`
  - 作文批改、写作记录保存、历史写作记录查询。
- `pages/record/index.*`
  - 成长页新增作文记录，可展开回看作文原文和批改。
- `data/writing-em1/`
- `data/writing-em2/`
  - 一模、二模写作题数据。

### 5. 素材与目录模块

- `pages/material/index.*`
- `pages/material/detail/index.*`
  - 素材目录和详情页。
- `data/material-index.js`
- `data/material-index.json`
  - 阅读、语法、写作等素材索引。

### 6. 云函数与数据流

- `cloudfunctions/yoyo/index.js`
  - 注册阅读、语法、写作、完成记录等 action。
- `cloudfunctions/yoyo/services/completion.service.js`
  - 学习完成记录保存和查询。
- `cloudfunctions/yoyo/services/speaking.service.js`
- `cloudfunctions/yoyo/lib/speaking-engine.js`
  - 口语评分和兼容调整。
- `cloudfunctions/yoyo/lib/request-context-engine.js`
- `domain/cloud/index.js`
- `utils/store.js`
  - 前后端云调用、缓存、错误处理和接口封装。

### 7. 结构化数据与脚本

- `docs/SHANGHAI_EM2_STRUCTURING_RULES.md`
  - 上海一模/二模结构化规则。
- `scripts/build_*`
- `scripts/extract_*`
- `scripts/classify_*`
- `scripts/regroup_*`
  - 听力、阅读、语法、写作数据抽取、清洗、分类和上传文件生成。
- `data/reading/`
- `data/reading-em1/`
- `data/reading-passages.sample.js`
  - 阅读题数据和样例。

### 8. 项目配置与体积控制

- `.gitignore`
  - 排除 `data/listening-em2/`、`data/imports/` 两个本地大目录。
- `project.config.json`
  - 微信开发者工具忽略大型数据、脚本、云函数等目录。
- `AGENTS.md`
  - 项目内 Codex 简洁模式和结构化任务规则。
- `docs/WECHAT_MINIPROGRAM_UI_FORMAT.md`
- `docs/ports/README.md`
  - 小程序 UI/端口修改约束。

### 9. 后续查找建议

- 查页面入口：先看 `app.json`。
- 查前端云调用：先看 `utils/store.js`。
- 查云函数 action：先看 `cloudfunctions/yoyo/index.js`。
- 查学习内容数据：先看 `data/material-index.json`。
- 查上海一模/二模结构化规则：先看 `docs/SHANGHAI_EM2_STRUCTURING_RULES.md`。
- 查阅读详情改动边界：先看 `docs/ports/reading-detail.md`。
