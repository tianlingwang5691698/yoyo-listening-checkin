# 项目进度记录

本文件记录项目级 UI/交互调整的变化和结论。每次 UI/交互提交后，应补充本文件，说明做了什么、得出什么结论、下一步是什么。

## 2026-04-18 规则体系落地

提交：

- `4dc649c docs: add minimal product design rules`

变化：

- 新增产品设计规则。
- 新增 UI 改动检查清单。
- 新增 UI 规则审计记录。

结论：

- 后续 UI/交互改动必须先读规则，再实施，再回归，再提交。
- 首页不是报表，课程页不是说明书，成长页承载学习数据。

## 2026-04-18 首页产品语言多轮收敛

相关提交：

- `409e95b refactor: add product UI components and home console`
- `a750a77 refactor: simplify home to minimal check-in`
- `5adba94 refactor: restore home brand title`
- `019c9e6 refactor: remove redundant home actions`
- `85e1b99 refactor: make home programs the primary entry`
- `4c6af7e refactor: replace home report strip with program swiper`
- `c1bb644 refactor: align home subtitle and tab tone`

变化：

- 首页从功能型任务列表逐步收敛为品牌标题 + 学习入口。
- Peppa / Unlock 1 / Songs 顺序固定。
- Songs 改为英文显示。
- 去除重复“开始”。
- 去除 `0/1` 这类后台式节目计数。
- 尝试使用横向节目卡承载首页主入口。
- 底部 tab 选中态从橙色改为深灰，避免导航抢主操作色。

结论：

- 首页不应同时存在主任务按钮和节目入口。
- 首页不应展示独立报表卡。
- “英语小耳朵”是品牌识别，不应降级成副标题。
- 横向节目卡比报表式总进度更符合高级极简方向。

## 2026-04-18 字体语言收敛

提交：

- `e9bf5f7 refactor: define minimal typography system`

变化：

- 新增并开始使用 6 个字体层级：
  - `type-brand`
  - `type-page-title`
  - `type-card-title`
  - `type-section-title`
  - `type-body`
  - `type-caption`
- 降低普通标题字重。

结论：

- 高级感不是靠粗字重和大字号堆出来的。
- 普通标题不应使用 `font-weight: 900`。
- `900` 应保留给成长页大数字或统计数字。

## 2026-04-18 课程页播放区收敛

相关提交：

- `2734785 refactor: simplify lesson playback surface`
- `a2e9140 refactor: remove lesson explainer panels`
- 待本次提交：课程页重复进度与播放控件收敛

变化：

- 普通课程页不再展示 `音频来源`、`播放链路`、`播放状态：已就绪` 等技术链路。
- 删除文本来源、结果、历史等说明卡。
- 播放区和文本区更靠近主流程。
- 删除同屏重复的遍数信息。
- 播放键改为自绘控件，降低真机和调试器样式差异。
- 倍速只显示实际值，不做提醒说明。

结论：

- 课程页当前重点已从“隐藏调试信息”进入“单焦点播放体验”。
- 下一步应在真机确认播放键一致性，并继续评估是否合并顶部信息区和三遍节奏区。

## 2026-04-18 管理页与成长页阶段性整理

相关提交：

- `25fef3a refactor: upgrade lesson and growth dashboards`
- `68cbfad refactor: align secondary pages with minimal panels`
- `9302bb8 refactor: align management pages with product panels`

变化：

- 成长页重构为学习成果方向。
- 我的页、家庭页、身份页进入轻面板结构。
- 家长页、音频页开始接入统一视觉语言。

结论：

- 成长页可以承载数据，但不能变成控制台。
- 管理页应每页最多一个主动作。
- 家庭页仍需继续压缩说明文字和状态密度。

## 当前待办

- 课程页：
  - 去掉重复遍数展示。
  - 播放键改为跨真机/调试器一致的自绘控件。
  - 倍速只显示实际值，如 `×1.0` 或 `×0.9`，不做解释。
  - 文本区减少“文本已就绪”式系统提示。
- 首页：
  - 继续验证横向节目卡真机表现。
  - 如果 swiper 交互不明显，回退为三条极简 cell。
- 成长页：
  - 保留大数字、热力图、追赶、累计四个核心。
  - 删除重复统计和长说明。
- 管理页：
  - 继续压缩表单说明。
  - 保留必要状态和单一主动作。
