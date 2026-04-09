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
- `cloudfunctions/unlock1-preprocess`
  - 扫描 `Unlock1` 云端音频
  - 读取音频时长
  - 过滤 30 秒以内短音频
  - 写入听力训练素材池
  - 预留 transcript 对齐 / 生成接口

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

## 首版集合

- `families`
- `familyMembers`
- `children`
- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `subscriptionPreferences`
- `unlock1AudioTrainingPool`

说明：

- 这些集合需要先在 CloudBase 控制台手动创建为空集合。
- 首次云调用会自动写入首批业务数据。
- 如果新环境未先建集合，首页会在 bootstrap 阶段读取失败并回退本地。

## unlock1-preprocess 用法

### 目标目录

- `A1/Unlock1/Unlock1 听口音频 Class Audio`

### 当前行为

- 只扫描 `.mp3`、`.m4a`、`.wav`
- 读取音频时长
- `<= 30s` 写入 `excluded_short_audio`
- `> 30s` 写入 `eligible`
- 写入 collection：`unlock1AudioTrainingPool`

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

### 预留动作

- `alignTranscriptWithAudio`
- `generateTranscriptFromAudio`

这两个动作当前只返回 `not_implemented`，用于后续接入 transcript / ASR 流程。
