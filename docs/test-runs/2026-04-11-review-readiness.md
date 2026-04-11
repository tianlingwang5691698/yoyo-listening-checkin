# 2026-04-11 体验版上传前核验记录

## 基线

- 小程序 AppID：`wx15ab12b0da43128a`
- CloudBase 环境：`youshengenglish-6glk12rd6c6e719b`
- 提审配置：`releaseStage = review`
- 调试展示：`showCloudDebug = false`
- 订阅消息：模板 ID 当前为空，日报提醒按可选能力处理，不作为审核必测路径

## 已核验

- 页面数据统一经由 `utils/store` 获取，不直接访问数据库。
- 页面云态字段统一经由 `utils/page` 归一化。
- 训练池已在开发者工具中确认启用，首页显示 `eligible 24 条`。
- `unlock1AudioTrainingPool` 已有 `eligible` 数据。
- 项目未发现手机号、定位、相机、相册、录音等敏感权限调用。
- 上传包忽略开发文档、脚本、`.cloudbase`、本地私有配置和构建中间数据。
- 页面可见文案已移除主要开发态标签和工程化错误说明。

## 上传前仍需人工确认

- 在微信开发者工具重新编译，确认 Console 无阻断性 `Error: timeout`。
- 重新部署 `yoyo` 和 `unlock1-preprocess` 到正式云环境。
- 调用 `unlock1-preprocess.scanUnlock1Audio`，确认 `scannedCount > 0`、`supportedAudioCount > 0`、`upsertedCount > 0`。
- 真机或体验版按审核路径复测：首页今日任务 -> 课程页播放音频 -> 成长页 -> 我的页 -> 家庭页邀请码 -> 家长页日报。
- 微信公众平台确认 CloudBase 或合法域名配置满足音频/PDF 访问。

## 审核说明建议

- 本小程序用于家庭英语听力打卡，用户打开后可查看今日音频任务、播放听力音频、记录完成进度，并由家庭成员共享同一孩子的学习记录。
- 家庭共享通过邀请码加入，不需要账号密码注册。
- 订阅消息如未配置正式模板，可说明日报提醒为后续可选能力，不影响主流程体验。
