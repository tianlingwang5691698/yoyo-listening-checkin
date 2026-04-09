# 佑佑听力打卡

一个基于微信小程序 + CloudBase 的家庭英语听力打卡项目，面向单个孩子的日常音频训练、家庭共享进度和家长日报。

## 当前目标

- 稳定接入正式云环境 `youshengenglish-6glk12rd6c6e719b`
- 以云存储里的真实音频和 PDF 作为任务来源
- 完成真机稳定性验证
- 收口到可提审的小程序基线版本

## 当前正式配置

- 小程序 AppID：`wx15ab12b0da43128a`
- CloudBase 环境：`youshengenglish-6glk12rd6c6e719b`
- 云存储桶：`796f-youshengenglish-6glk12rd6c6e719b-1419984942`
- 云存储访问域名：`https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la`
- 正式配置源：[data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js)

## 目录结构

- [app.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/app.js) / [app.json](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/app.json)：小程序入口与全局配置
- [pages](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/pages)：页面层，负责展示与交互
- [utils/store.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/utils/store.js)：页面统一数据入口，负责云端优先与本地 fallback
- [domain](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/domain)：业务域逻辑
- [data](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data)：静态配置、mock 数据、逐句稿数据
- [cloudfunctions/yoyo](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/yoyo)：主云函数，负责云数据库与云存储接线
- [assets](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/assets)：本地整理素材，不是正式运行时素材来源
- [scripts](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/scripts)：逐句稿处理与辅助脚本
- [docs](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs)：仓库说明、云部署、真机测试、提审与合规材料

## 运行链路

1. 小程序启动时执行 `store.ensureState()`
2. 页面层通过 `utils/store` 统一获取数据
3. `utils/store` 优先调用 `domain/cloud -> wx.cloud.callFunction -> yoyo`
4. `yoyo` 云函数读取 CloudBase 数据库和云存储
5. 只有开发态允许 fallback 到本地数据；真机验收必须看到 `syncMode=cloud`

## 云存储目录约定

- `A1/Peppa`
- `A1/Unlock1`
- `A1/Super simple song`

说明：

- `Peppa` 建议按季分子目录，音频与该季 PDF 放在一起
- `Unlock1` 音频与脚本 PDF 放在同目录
- `Song` 先放音频；有歌词 PDF 时可放在同目录

## 开发与部署

- 云环境部署说明见 [docs/CLOUDBASE_SETUP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/CLOUDBASE_SETUP.md)
- 真机测试清单见 [docs/REAL_DEVICE_TEST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST.md)
- 真机测试记录模板见 [docs/REAL_DEVICE_TEST_LOG_TEMPLATE.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REAL_DEVICE_TEST_LOG_TEMPLATE.md)
- 提审上线流程见 [docs/RELEASE_SOP.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/RELEASE_SOP.md)
- 提审包收口清单见 [docs/REVIEW_BUILD_CHECKLIST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/REVIEW_BUILD_CHECKLIST.md)
- 隐私与提审材料见 [docs/PRIVACY_AND_REVIEW.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRIVACY_AND_REVIEW.md)

## 当前验收口径

- 开发工具中可以出现本地 fallback，但必须明确显示原因
- 真机测试通过的标准不是“页面能打开”，而是关键链路持续走云并成功写回
- 提审版本必须移除开发态调试提示、空资源占位和假数据感知
