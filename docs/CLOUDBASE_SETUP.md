# CloudBase 环境与部署说明

## 正式环境

- 环境 ID：`youshengenglish-6glk12rd6c6e719b`
- 存储桶：`796f-youshengenglish-6glk12rd6c6e719b-1419984942`
- 访问域名：`https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la`
- 正式 AppID：`wx15ab12b0da43128a`

## 体验版前置门槛

- `yoyo` 已部署到当前环境且首页不再报云错误
- `unlock1-preprocess` 已部署且至少手动执行过一次 `scanUnlock1Audio`
- `unlock1AudioTrainingPool` 中已有 `eligible`
- `Unlock1` 前台只出现 `>= 60 秒` 的音频
- [data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js) 仍保持 `internal` 直到云端主链完全通过；通过后再切 `review`

## 正式素材目录

- `A1/Peppa`
- `A1/Unlock1/Unlock1 听口音频 Class Audio`
- `A1/Super simple songs`

要求：

- `Peppa` 每季独立子目录
- 音频 `.mp3` 与对应 `.pdf` 尽量放同目录
- `Unlock1` 音频与脚本 PDF 当前放在 `Unlock1 听口音频 Class Audio` 子目录
- `Song` 当前从 `A1/Super simple songs` 递归扫描，至少要有可识别音频

## 云函数部署步骤

1. 用正式 AppID 打开工程
2. 在微信开发者工具确认绑定正式云环境
3. 进入 `cloudfunctions/yoyo`
4. 安装依赖
5. 上传并部署 `yoyo`
6. 进入 `cloudfunctions/unlock1-preprocess`
7. 安装依赖
8. 上传并部署 `unlock1-preprocess`
9. 在云开发控制台先手动创建首版数据库集合
10. 在云开发控制台确认云存储目录正常

## 云函数依赖

- `wx-server-sdk`
- `@cloudbase/manager-node`

当前锁文件已在：

- [cloudfunctions/yoyo/package-lock.json](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/yoyo/package-lock.json)

## 数据库集合

- `families`
- `familyMembers`
- `children`
- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `subscriptionPreferences`
- `unlock1AudioTrainingPool`

说明：

- 这些集合需要先在 CloudBase 控制台创建为空集合
- 首次云调用会尝试写入首批初始化业务数据
- 如果集合没建，首页会在 bootstrap 阶段读取失败并显示云端错误，不再回退本地数据
- 真机首次启动后应检查这些集合是否开始出现正式数据

## Unlock1 预处理云函数

- 云函数目录：`cloudfunctions/unlock1-preprocess`
- 扫描目录：`A1/Unlock1/Unlock1 听口音频 Class Audio`
- 结果表：`unlock1AudioTrainingPool`

当前支持动作：

- `scanUnlock1Audio`
- `alignTranscriptWithAudio`（占位）
- `generateTranscriptFromAudio`（占位）

当前接线策略：

- `yoyo` 优先读取 `unlock1AudioTrainingPool` 中的 `eligible` 记录
- 如果训练池未就绪，前台会先回退到经过 `>= 60 秒` 过滤的云端原始目录，避免打断现有业务
- `yoyo` 不会在前台请求里自动重跑 Unlock1 全量训练池扫描；调试信息会明确提示你手动执行 `unlock1-preprocess`
- 补建成功后，后续请求自动切到 `training-pool`
- 当前前台不再回退本地业务数据；云端失败时直接显示 `cloud-error`

手动触发示例：

```js
wx.cloud.callFunction({
  name: 'unlock1-preprocess',
  data: {
    action: 'scanUnlock1Audio'
  }
});
```

推荐首次启用顺序：

1. 部署 `unlock1-preprocess`
2. 手动触发一次 `scanUnlock1Audio`
3. 在 `unlock1AudioTrainingPool` 中确认已出现 `eligible`
4. 再部署 `yoyo`
5. 首页调试信息应显示 `Unlock1 训练池已启用`

## 部署后立即验证

- 首页 `syncMode=cloud`
- `getDashboard` 返回真实云任务
- 课程页可以拿到云端音频
- 播放完成后数据库进度发生变化
- 家庭页可以刷新邀请码
- 家长页可读取日报数据
- 若首页仍显示云错误，不要切体验版或 `review` 包态
