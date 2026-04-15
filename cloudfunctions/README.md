# 云开发接线说明

## 当前已接好的能力

- `cloudfunctions/yoyo`
  - 家庭初始化
  - 邀请码加入
  - 三项任务进度同步
  - 云存储目录自动扫描
  - 家长共享页数据
  - 每日报告文档骨架
  - 订阅偏好存储
  - transcript bundle 按需读取
- `cloudfunctions/unlock1-preprocess`
  - 扫描 `Unlock1` 云端音频
  - 读取音频时长
  - 过滤低于 60 秒的短音频
  - 写入听力训练素材池
  - 预留 transcript 对齐 / 生成接口

## 体验版前必须通过

- `yoyo` 在 `youshengenglish-6glk12rd6c6e719b` 中可稳定执行
- 首页不再出现 `cloud-error`
- `unlock1-preprocess` 已至少手动跑通一次 `scanUnlock1Audio`
- `unlock1AudioTrainingPool` 中已存在 `eligible`
- `Unlock1` 前台只出现 `>= 60 秒` 的云端音频
- `Songs` 如接入体验版，只按句级文本同步验收

## 你在微信开发者工具里需要做的事

1. 用正式小程序 `wx15ab12b0da43128a` 打开这个工程
2. 确认项目已经绑定到云环境 `youshengenglish-6glk12rd6c6e719b`
3. 在 `cloudfunctions/yoyo` 里安装依赖
   - 现在除了 `wx-server-sdk`，还需要 `@cloudbase/manager-node`
4. 上传并部署 `yoyo` 云函数到当前环境
5. 上传并部署 `unlock1-preprocess` 云函数到当前环境
6. 在 CloudBase 控制台先手动创建首版数据库集合
   - `families`
   - `familyMembers`
   - `users`
   - `children`
   - `dailyTaskProgress`
   - `dailyCheckins`
   - `dailyReports`
   - `subscriptionPreferences`
   - `unlock1AudioTrainingPool`
7. 在 CloudBase 控制台确认云存储目录如下
   - `A1/Peppa`
   - `A1/Unlock1/Unlock1 听口音频 Class Audio`
   - `A1/Super simple songs`
   - `_transcripts/A1/peppa`
   - `_transcripts/A1/unlock1`
   - `_transcripts/A1/songs`
8. 在小程序订阅消息里申请模板
9. 把模板 ID 填进：
   - `/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js`

## 当前正式配置

- 正式小程序 AppID
  - `wx15ab12b0da43128a`
- 当前云环境
  - `youshengenglish-6glk12rd6c6e719b`
- 当前云存储桶
  - `796f-youshengenglish-6glk12rd6c6e719b-1419984942`
- 当前云存储访问域名
  - `https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la`
- 当前工程名
  - `佑声英语`

## 云目录约定

云函数会优先扫描下面三个目录：

- `A1/Peppa`
- `A1/Unlock1/Unlock1 听口音频 Class Audio`
- `A1/Super simple songs`

推荐你继续按下面的方式放资料：

- `Peppa`
  - 每一季放在自己的子目录里
  - 音频和该季 script PDF 放在同一个目录
- `Unlock2听力`
  - 音频和 script PDF 当前放在 `Unlock1 听口音频 Class Audio` 子目录
- `Super simple songs`
  - 支持递归扫描子目录；如果以后有歌词 PDF，也可以和音频放在同目录

云函数扫描后会：

- 自动识别 `.mp3`、`.m4a`、`.aac`、`.wav` 作为任务音频
- 自动识别同目录 `.pdf` 作为文本来源
- 优先保留现有本地任务元数据
  - `Peppa` 的集号与标题格式
  - `Unlock 1` 的编号格式
  - 已接好的 `transcriptTrackId`

当前 transcript 正式源：

- `yoyo` 只读取 CloudBase `_transcripts/<level>/<series>/bundle.json`
- `Peppa / Unlock1` 走逐词
- `Songs` 走句级优先
- `build-status.json` 只做元信息，不代表质量已通过

## 首版集合

- `families`
- `familyMembers`
- `users`
- `children`
- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `subscriptionPreferences`
- `unlock1AudioTrainingPool`

说明：

- 这些集合需要先在 CloudBase 控制台手动创建为空集合。
- 首次云调用会自动写入首批业务数据。
- 如果新环境未先建集合，首页会在 bootstrap 阶段读取失败并显示云端错误，不再回退本地数据。
- 如果 `yoyo` 或 `unlock1-preprocess` 未正确部署到当前环境，前台会直接显示 `cloud-error`，此时不能切体验版。

## unlock1-preprocess 用法

### 目标目录

- `A1/Unlock1/Unlock1 听口音频 Class Audio`

### 当前行为

- 只扫描 `.mp3`、`.m4a`、`.wav`
- 读取音频时长
- `< 60s` 写入 `excluded_short_audio`
- `>= 60s` 写入 `eligible`
- 写入 collection：`unlock1AudioTrainingPool`
- `yoyo` 检测到训练池未就绪时，会先回退到经过 `>= 60 秒` 过滤的云端原始目录，保证前台继续可用
- `yoyo` 不会在前台请求里重跑 Unlock1 全量训练池扫描；训练池未就绪时会在调试信息中明确提示需要手动执行 `unlock1-preprocess`
- 手动跑通训练池后，后续首页和详情页会优先切到 `training-pool`

### 手动触发

可以在微信开发者工具云函数测试面板中调用：

```js
{
  "action": "scanUnlock1Audio"
}
```

或在小程序端手动触发：

```js
wx.cloud.callFunction({
  name: 'unlock1-preprocess',
  data: {
    action: 'scanUnlock1Audio'
  }
});
```

### 推荐首次启用顺序

1. 先部署 `unlock1-preprocess`
2. 手动执行一次 `scanUnlock1Audio`
3. 确认 `unlock1AudioTrainingPool` 中已有 `eligible` 记录
4. 再部署 `yoyo`
5. 首页调试信息看到 `Unlock1 训练池已启用`
6. 再切 `releaseStage = 'review'`、`showCloudDebug = false` 并做体验版复测

### 预留动作

- `alignTranscriptWithAudio`
- `generateTranscriptFromAudio`

这两个动作当前只返回 `not_implemented`，用于后续接入 transcript / ASR 流程。
