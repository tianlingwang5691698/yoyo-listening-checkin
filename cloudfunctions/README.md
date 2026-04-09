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

## 你在微信开发者工具里需要做的事

1. 用正式小程序 `wx15ab12b0da43128a` 打开这个工程
2. 确认项目已经绑定到云环境 `english-6gm2vya9fc58a273`
2. 在 `cloudfunctions/yoyo` 里安装依赖
   - 现在除了 `wx-server-sdk`，还需要 `@cloudbase/manager-node`
3. 上传并部署 `yoyo` 云函数
4. 在小程序订阅消息里申请模板
5. 把模板 ID 填进：
   - `/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js`

## 当前正式配置

- 正式小程序 AppID
  - `wx15ab12b0da43128a`
- 当前云环境
  - `english-6gm2vya9fc58a273`
- 当前工程名
  - `佑声英语`

## 云目录约定

云函数会优先扫描下面三个目录：

- `audio/Peppa`
- `audio/Unlock2听力`
- `audio/Super simple song`

推荐你继续按下面的方式放资料：

- `Peppa`
  - 每一季放在自己的子目录里
  - 音频和该季 script PDF 放在同一个目录
- `Unlock2听力`
  - 音频和 script PDF 放在同一个目录
- `Super simple song`
  - 先放音频；如果以后有歌词 PDF，也可以放在同目录

云函数扫描后会：

- 自动识别 `.mp3` 作为任务音频
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

云函数首次写入时会自动创建这些集合对应的数据。
