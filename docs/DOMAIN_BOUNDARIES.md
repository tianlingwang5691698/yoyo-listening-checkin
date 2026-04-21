# 领域边界

本文件用于明确当前项目的领域划分，避免后续功能继续混写到同一层。

目标：

- 让新增逻辑优先落到正确领域
- 让 `services / facades / lib/*-engine / repositories` 的职责更稳定
- 为后续继续拆 `shared.service.js` 和 catalog 相关逻辑提供边界依据

## 1. Study 域

职责：

- 今日任务生成
- 课程详情
- 播放进度
- 打卡推进
- transcript 按需加载
- 首页首屏任务分组

当前主要入口：

- `cloudfunctions/yoyo/services/dashboard.service.js`
- `cloudfunctions/yoyo/services/task.service.js`
- `cloudfunctions/yoyo/services/level.service.js`
- `cloudfunctions/yoyo/services/transcript.service.js`
- `cloudfunctions/yoyo/facades/study.facade.js`

当前主要规则层：

- `cloudfunctions/yoyo/lib/dashboard-engine.js`
- `cloudfunctions/yoyo/lib/task-engine.js`
- `cloudfunctions/yoyo/lib/plan-engine.js`
- `cloudfunctions/yoyo/lib/checkin-engine.js`
- `cloudfunctions/yoyo/lib/request-context-engine.js`

边界规则：

- 任务推进、播放遍数、计划日、课程页行为都属于 Study 域
- Study 域可以读取家庭当前身份，但不负责变更家庭绑定关系
- Study 域不得直接写 family 成员绑定规则

## 2. Family 域

职责：

- 家庭成员
- 孩子 ID 加入
- 退出孩子记录
- 切换学生/家长设备
- 孩子资料更新
- 当前微信与记录的绑定关系

当前主要入口：

- `cloudfunctions/yoyo/services/family.service.js`
- `cloudfunctions/yoyo/services/identity.service.js`
- `cloudfunctions/yoyo/facades/family.facade.js`

当前主要规则层：

- `cloudfunctions/yoyo/lib/family-engine.js`
- `cloudfunctions/yoyo/lib/bootstrap-engine.js`
- `cloudfunctions/yoyo/lib/identity.js`

边界规则：

- 谁属于哪个家庭、谁是 owner、是否回到原记录，属于 Family 域
- Family 域可以影响 `studyRole`，但不负责当天任务生成
- Family 域不得直接决定补卡、日报、任务推进规则

## 3. Report 域

职责：

- 日报
- 最近 7 天
- 成长页单日详情
- 月热力图
- catchup 入口数据

当前主要入口：

- `cloudfunctions/yoyo/services/report.service.js`

当前主要规则层：

- `cloudfunctions/yoyo/lib/report-engine.js`

依赖关系：

- Report 依赖 Study/Plan 计算结果
- Report 可以读取 `catchupState`
- Report 不负责修改成员关系

边界规则：

- 报表是“展示口径层”，不是“主推进层”
- 报表可以使用任务结果，不负责推进任务

## 4. Identity 域

职责：

- 当前微信登录态
- bootstrap 初始化
- openId -> user/member/family/child 上下文
- 身份确认

当前主要入口：

- `cloudfunctions/yoyo/services/identity.service.js`
- `cloudfunctions/yoyo/lib/bootstrap-engine.js`
- `cloudfunctions/yoyo/lib/request-context-engine.js`

边界规则：

- Identity 负责“我是谁 / 我属于哪份记录”
- Identity 不负责“今天该做什么任务”

## 5. Catalog / Resource 域

职责：

- 云存储扫描
- 训练池状态
- 静态任务与云素材融合
- runtime catalog cache
- resource debug

当前主要位置：

- `cloudfunctions/yoyo/services/shared.service.js`

说明：

- 这是当前仍然偏大的剩余块
- 后续若继续拆分，优先单独形成 `catalog-engine`

边界规则：

- Catalog 负责“有哪些素材”
- Plan/Study 负责“今天用哪些素材”

## 6. Repository 边界

职责：

- 只做数据存取

当前目录：

- `cloudfunctions/yoyo/repositories/*`

规则：

- Repository 不做任务推进判断
- Repository 不做补卡判断
- Repository 不做家庭绑定业务判断
- Repository 只负责查、增、改、删、upsert

## 7. 当前建议的调用方向

建议长期维持：

```text
pages -> utils/store -> cloud function services -> facades -> engines/lib -> repositories/adapters
```

不建议：

```text
pages -> 直接写业务规则
service -> 直接堆大量领域判断
repository -> 混入业务判断
```

## 8. 新需求归属判断

判断方式：

1. 改“谁绑定谁” -> Family
2. 改“今天做什么 / 怎么推进” -> Study
3. 改“热力图 / 日报怎么看” -> Report
4. 改“当前微信身份和上下文” -> Identity
5. 改“有哪些素材 / 从云端读什么” -> Catalog

如果一个需求跨多个领域：

- 先确定主领域
- 其他领域只提供依赖，不反向承载主逻辑
