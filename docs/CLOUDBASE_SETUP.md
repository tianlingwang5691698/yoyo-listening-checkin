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
- `A2/Unlock2/Class Audio`
- `A2/unlock2 第三版/Audio`
- `B1/Unlock3/Class Audio`
- `B2/Unlock4/Class Audio`
- `B2/unlock4 第三版/Audio`
- `_transcripts/A1/peppa`
- `_transcripts/A1/unlock1`
- `_transcripts/A1/songs`
- `_transcripts/A2/unlock2`
- `_transcripts/A2/unlock2-third-edition`
- `_transcripts/B1/unlock3`
- `_transcripts/B2/unlock4`
- `_transcripts/B2/unlock4-third-edition`

要求：

- `Peppa` 每季独立子目录
- 音频 `.mp3` 与对应 `.pdf` 尽量放同目录
- `Unlock1` 音频与脚本 PDF 当前放在 `Unlock1 听口音频 Class Audio` 子目录
- `Unlock2/3/4` 第二版只上传本地 `data/transcript-build/unlock-series/**/upload-audio-list.txt` 中列出的 `>= 60 秒` 音频；第三版按对应清洗任务要求执行，Unlock 2 和 Unlock 4 第三版均全量导入、不做时长过滤
- `Song` 当前从 `A1/Super simple songs` 递归扫描，至少要有可识别音频
- transcript 正式文件统一放在 `_transcripts/<level>/<series>/`

## 线上内容上传铁律

适用范围：听力、阅读、语法、写作、词汇、transcript、题库索引和所有 `_content/` JSON / 音频 / 图片上传。

词汇、词书、音标、释义和例句上传还必须遵循 `docs/VOCABULARY_DATA_RULES.md`。

原则：

- 必须增量上传，线上用户只能看到内容增加。
- 不得覆盖、删除、重命名已有线上可用内容。
- 不得破坏原云函数和旧前端兼容；新增字段必须向后兼容。
- 最终上传的数据结构、路径和字段必须与线上存储现状保持兼容。
- 上传内容不能要求修改云函数或前端才能可用，不能影响线上上一个版本用户。
- 已有 `_id`、`cloudPath`、`audioCloudPath`、题目结构和答案字段默认冻结。
- 新内容必须使用新的稳定 `_id` 和新文件名；音频优先带内容指纹，避免缓存播放旧文件。

上传前必须做：

1. 先下载线上当前 JSON 作为备份。
2. 本地新结果与线上旧结果按 `_id` 合并，只追加新增项。
3. 对旧 `_id` 做 diff 校验：除明确修复并记录原因外，旧记录不得变化。
4. 校验上传后总数 `>=` 上传前总数，旧 `_id` 全部仍存在。
5. 用 HTTPS 验证目标 JSON 返回 200，并抽查旧内容和新增内容都可读。

每次内容上传后必须做页面性能验收：

- 缓存首屏目标 `< 300ms`，冷启动云端返回目标 `< 1200ms`。
- 目录首屏只返回标题、数量和可用状态；不得加载 transcript、学习包或全量任务详情。
- 听力素材上传后必须验证 `getListeningPlanOverview` 不扫描云目录，只读静态 manifest 摘要；用户点进素材后才读任务和 transcript。
- 运行相关结构回归测试和 `pageReadyMs/cacheHit/cloudRefreshMs` 埋点检查；不达标先修复再发布。

禁止：

- 用本地新生成 JSON 直接覆盖线上全量 JSON。
- 因本次清洗没识别出来就删除线上旧内容。
- 复用旧文件名上传不同音频、图片或 transcript。
- 为了新版本前端改接口而让旧版本前端拿不到原有内容。

例外：

- 只有明确修复错误数据时才允许更新旧记录；必须先备份线上文件，记录旧值、新值、影响 `_id`，并确认前端和云函数兼容。

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

日常发版建议：

- 只改前台业务、任务分配、transcript 读取逻辑时，只部署 `yoyo`
- 只有 `Unlock1` 训练池扫描逻辑变化时，才额外部署 `unlock1-preprocess`

## 云函数依赖

- `wx-server-sdk`
- `@cloudbase/manager-node`

当前锁文件已在：

- [cloudfunctions/yoyo/package-lock.json](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/cloudfunctions/yoyo/package-lock.json)

## 跟读评分云环境

`yoyo` 云函数使用腾讯 SOE 新版 WebSocket 口语评测，正式环境必须保留以下变量：

```text
SPEAKING_PRONUNCIATION_PROVIDER=tencent-soe
SPEAKING_CONTENT_SCORE_MODEL=gpt-5.6-terra
SPEAKING_CONTENT_ALLOW_FALLBACK=0
SPEAKING_MODEL_HTTP_TIMEOUT_MS=240000
SPEAKING_MODEL_RETRY_COUNT=1
TENCENT_SOE_ENABLED=1
TENCENT_SOE_VERSION=new
TENCENT_SOE_REGION=ap-guangzhou
TENCENT_SOE_ENGINE=16k_en
TENCENT_SOE_REC_MODE=0
TENCENT_SOE_SCORE_COEFF=1
TENCENT_SOE_APP_ID=<SOE App ID>
TENCENT_SECRET_ID=<Tencent Secret ID>
TENCENT_SECRET_KEY=<Tencent Secret Key>
```

小程序跟读录音固定为 MP3、16kHz、单声道、64kbps。IELTS 回答由腾讯 SOE 评估发音与流利度，`gpt-5.6-terra` 评估内容、语法和反馈；学生写入 `taskAttempts` 并刷新日报，家长仅返回预览评分、不写数据库。

当前正式内容模型路由为：

```text
WRITING_SCORE_MODEL=gpt-5.6-terra
WRITING_SCORE_FALLBACK_MODEL=gpt-5.6-terra
READING_STUDY_MODEL=gpt-5.6-luna
READING_STUDY_FALLBACK_MODEL=gpt-5.6-terra
GRAMMAR_EXPLAIN_MODEL=gpt-5.6-luna
GRAMMAR_EXPLAIN_FALLBACK_MODEL=gpt-5.6-terra
SPEAKING_CONTENT_SCORE_MODEL=gpt-5.6-terra
SPEAKING_CONTENT_SCORE_FALLBACK_MODEL=gpt-5.6-terra
SPEAKING_CONTENT_ALLOW_FALLBACK=0
```

## 数据库集合

- `families`
- `familyMembers`
- `users`
- `children`
- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `subscriptionPreferences`
- `deviceStudySessions`
- `unlock1AudioTrainingPool`
- `ieltsSpeakingPromptAudios`（IELTS 题目共享 TTS 缓存）

## Transcript 正式上传路径

- `run/output/peppa-word-tracks.json` -> `_transcripts/A1/peppa/bundle.json`
- `data/transcript-build/unlock1-word-align/output/unlock1-word-tracks.json` -> `_transcripts/A1/unlock1/bundle.json`
- `Super simple songs` 当前交付包 -> `_transcripts/A1/songs/bundle.json`
- `data/transcript-build/unlock2-third-edition/A2/unlock2/bundle-draft.json` -> `_transcripts/A2/unlock2-third-edition/bundle-wordaligned-v1.json`

说明：

- `bundle.json` 是线上正式源
- `build-status.json` 只作为元信息，不代表质量已通过
- `Songs` 当前按句级上线，不能按“逐词稳定”向审核或用户描述

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
