# CloudBase 环境与部署说明

## 正式环境

- 环境 ID：`youshengenglish-6glk12rd6c6e719b`
- 存储桶：`796f-youshengenglish-6glk12rd6c6e719b-1419984942`
- 访问域名：`https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la`
- 正式 AppID：`wx15ab12b0da43128a`

## 正式素材目录

- `A1/Peppa`
- `A1/Unlock1`
- `A1/Super simple song`

要求：

- `Peppa` 每季独立子目录
- 音频 `.mp3` 与对应 `.pdf` 尽量放同目录
- `Unlock1` 音频与脚本 PDF 同目录
- `Song` 至少有 `.mp3`

## 云函数部署步骤

1. 用正式 AppID 打开工程
2. 在微信开发者工具确认绑定正式云环境
3. 进入 `cloudfunctions/yoyo`
4. 安装依赖
5. 上传并部署 `yoyo`
6. 在云开发控制台确认数据库集合与云存储目录正常

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

说明：

- 首次云调用会尝试写入初始化数据
- 真机首次启动后应检查这些集合是否开始出现正式数据

## 部署后立即验证

- 首页 `syncMode=cloud`
- `getDashboard` 返回真实云任务
- 课程页可以拿到云端音频
- 播放完成后数据库进度发生变化
- 家庭页可以刷新邀请码
- 家长页可读取日报数据
