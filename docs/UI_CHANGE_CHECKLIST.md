# UI 改动检查清单

每次 UI、交互、字体、页面结构改动前后都必须使用本清单。改动前先阅读 [PRODUCT_DESIGN_RULES.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRODUCT_DESIGN_RULES.md)。

## 改动前

- 已阅读产品设计规则。
- 本次改动只解决一个清晰问题。
- 已确认是否会影响首页、课程页、成长页、家庭共享或 transcript 链路。
- 已确认不引入 TDesign、Vant、WeUI 等依赖。
- 已确认不改云函数业务逻辑，除非任务明确要求。

## 设计自检

- 首屏最多 1 个主标题、1 个副标题、1 个主内容区。
- 首页没有“主按钮 + 同功能列表入口”。
- 单个卡片不超过 1 个主标题、1 行副标题、1 个状态或操作。
- 卡片内说明文案不超过 28 个中文字。
- 每页最多 1 个强按钮。
- 整行可点击时，没有额外“开始”文案。
- 页面没有控制台感、报表感、组件堆叠感。

## 文案扫描

提交前运行：

```sh
rg "控制台|Dashboard|Console|PROGRAM CONSOLE|报表式总览|歌曲" pages/**/*.wxml pages/**/*.wxss app.wxss
rg ">开始<|0/1|font-weight: 900" pages/**/*.wxml pages/**/*.wxss app.wxss
```

允许例外：

- `font-weight: 900` 只允许用于成长页大数字或统计数字。
- “开始”只允许作为唯一强按钮，不允许在同一任务同时存在列表入口。

## 语法检查

提交前运行：

```sh
node -c pages/home/index.js
node -c pages/lesson/index.js
node -c pages/record/index.js
node -c pages/level/index.js
node -c pages/parent/index.js
node -c pages/profile/index.js
node -c pages/family/index.js
node -c pages/identity/index.js
node -c utils/labels.js
```

如果改动 JSON，额外执行 JSON parse 检查。

## 功能回归

- 首页 Peppa / Unlock 1 / Songs 点击进入正确任务。
- 多任务子行进入对应 `taskId`。
- 待准备任务不跳转。
- 课程页播放、回退、倍速、播放结束计数不变。
- transcript 逐词/句级显示不变。
- 成长页追赶入口仍携带 catchup 参数。
- 家庭昵称保存、邀请码刷新、家长日报入口不受影响。

## 提交前

- 已运行必要 JS 语法检查。
- 已运行文案扫描。
- 已说明是否运行微信开发者工具普通编译。
- 未把无关改动混入提交。
- 提交信息按主题命名。

## 最终回复必须包含

- 改了什么。
- 跑了哪些检查。
- 未跑哪些检查。
- 下一步建议。
