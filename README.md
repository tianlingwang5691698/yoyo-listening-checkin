# 佑佑听力打卡

一个基于微信小程序 + CloudBase 的家庭英语听力打卡项目，面向单个孩子的日常音频训练、家庭共享进度和家长日报。

## 当前目标

- 稳定接入正式云环境 `youshengenglish-6glk12rd6c6e719b`
- 以云存储里的真实音频和 PDF 作为任务来源
- 完成真机稳定性验证
- 收口到可提审的小程序基线版本

## 体验版前置门槛

在切体验版或提审包前，必须先满足下面四项：

- `yoyo` 云函数在正式环境中可稳定执行
- 首页 `syncMode = cloud`，不再出现 `cloud-error`
- `Unlock1` 只出现 `>= 60 秒` 的云端音频，且课程页可正常播放
- 当前工程仍允许 `releaseStage = 'internal'` 做排障，但不能把这版直接当体验版发出

## 当前正式配置

- 小程序 AppID：`wx15ab12b0da43128a`
- CloudBase 环境：`youshengenglish-6glk12rd6c6e719b`
- 云存储桶：`796f-youshengenglish-6glk12rd6c6e719b-1419984942`
- 云存储访问域名：`https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la`
- 正式配置源：[data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js)

## 仓库导航

### 代码入口

- [app.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/app.js) / [app.json](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/app.json)：小程序入口与全局配置
- [pages](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/pages)：页面层
- [utils/store.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/utils/store.js)：页面统一数据入口，负责云端调用与 `cloud-error` 错误态
- [domain](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/domain)：业务逻辑分层
- [data](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data)：正式配置、mock、逐句稿、静态目录映射

### 云函数

- [cloudfunctions/yoyo](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/yoyo)：主云函数，负责家庭、任务、进度、日报、云存储任务扫描
- [cloudfunctions/unlock1-preprocess](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/unlock1-preprocess)：Unlock1 音频预处理云函数，负责扫描、时长提取和训练池写库
- [cloudfunctions/README.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/README.md)：云函数部署、集合和手动触发说明

### 辅助资源

- [assets](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/assets)：本地整理素材，不是正式运行时数据源
- [scripts](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/scripts)：逐句稿处理、PDF 提取等辅助脚本
- [docs](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs)：项目文档入口

## 推荐阅读顺序

1. [docs/README.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/README.md)
2. [docs/ARCHITECTURE.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/ARCHITECTURE.md)
3. [docs/CLOUDBASE_SETUP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/CLOUDBASE_SETUP.md)
4. [docs/REAL_DEVICE_TEST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST.md)
5. [docs/RELEASE_SOP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/RELEASE_SOP.md)

## 运行链路

1. 页面层通过 `utils/store` 统一获取数据
2. `utils/store` 调用 `domain/cloud -> wx.cloud.callFunction -> yoyo`
3. `yoyo` 云函数读取 CloudBase 数据库和云存储
4. `unlock1-preprocess` 作为独立预处理链路维护 Unlock1 听力训练池
5. 前台不再回退本地业务数据；云端失败时直接显示 `cloud-error`

## 云存储目录约定

- `A1/Peppa`
- `A1/Unlock1/Unlock1 听口音频 Class Audio`
- `A1/Super simple songs`

说明：

- `Peppa` 建议按季分子目录，音频与该季 PDF 放在一起
- `Unlock1` 音频与脚本 PDF 当前放在 `Unlock1 听口音频 Class Audio` 子目录
- `Song` 当前从 `A1/Super simple songs` 递归扫描；有歌词 PDF 可放在同目录

## CloudBase 集合

- `families`
- `familyMembers`
- `users`
- `children`
- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `subscriptionPreferences`
- `unlock1AudioTrainingPool`

## 开发与部署

- 文档总入口见 [docs/README.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/README.md)
- UI/交互改动前必须先读 [docs/PRODUCT_DESIGN_RULES.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRODUCT_DESIGN_RULES.md) 和 [docs/UI_CHANGE_CHECKLIST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/UI_CHANGE_CHECKLIST.md)
- 云环境部署说明见 [docs/CLOUDBASE_SETUP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/CLOUDBASE_SETUP.md)
- 真机测试清单见 [docs/REAL_DEVICE_TEST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST.md)
- 真机测试记录模板见 [docs/REAL_DEVICE_TEST_LOG_TEMPLATE.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST_LOG_TEMPLATE.md)
- 真机测试记录目录见 [docs/test-runs](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/test-runs)
- 提审上线流程见 [docs/RELEASE_SOP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/RELEASE_SOP.md)
- 提审包收口清单见 [docs/REVIEW_BUILD_CHECKLIST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REVIEW_BUILD_CHECKLIST.md)
- 隐私与提审材料见 [docs/PRIVACY_AND_REVIEW.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRIVACY_AND_REVIEW.md)

## 当前验收口径

- 开发工具和真机都只允许走云端数据
- 云端失败时必须明确显示 `cloud-error`，不能伪装成本地成功
- 真机测试通过的标准不是“页面能打开”，而是关键链路持续走云并成功写回
- 提审版本必须移除开发态调试提示、空资源占位和假数据感知
