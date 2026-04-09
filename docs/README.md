# 文档导航

这里是仓库文档入口，按“先理解项目，再部署验证，再提审上线”的顺序组织。

## 先看哪些文档

1. [README.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/README.md)
   - 仓库总入口、正式环境、目录导航
2. [ARCHITECTURE.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/ARCHITECTURE.md)
   - 代码分层、运行链路、职责边界
3. [CLOUDBASE_SETUP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/CLOUDBASE_SETUP.md)
   - 正式云环境、云函数部署、集合和云存储目录

## 开发与验证

- [REAL_DEVICE_TEST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST.md)
  - 真机测试清单和通过标准
- [REAL_DEVICE_TEST_LOG_TEMPLATE.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST_LOG_TEMPLATE.md)
  - 空白测试记录模板
- [test-runs](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/test-runs)
  - 已执行的测试记录

## 提审与上线

- [RELEASE_SOP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/RELEASE_SOP.md)
  - 提审前固定顺序
- [REVIEW_BUILD_CHECKLIST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REVIEW_BUILD_CHECKLIST.md)
  - 提审包切换与文案检查
- [PRIVACY_AND_REVIEW.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRIVACY_AND_REVIEW.md)
  - 隐私、权限、审核材料

## 云函数和数据相关

- [../cloudfunctions/README.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/README.md)
  - `yoyo` 和 `unlock1-preprocess` 的部署、触发和集合说明

## 当前正式资源与集合

- 云存储目录
  - `A1/Peppa`
  - `A1/Unlock1/Unlock1 听口音频 Class Audio`
  - `A1/Super simple songs`
- 数据库集合
  - `families`
  - `familyMembers`
  - `children`
  - `dailyTaskProgress`
  - `dailyCheckins`
  - `dailyReports`
  - `subscriptionPreferences`
  - `unlock1AudioTrainingPool`
