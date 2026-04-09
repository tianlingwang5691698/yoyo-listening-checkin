# 提审包收口清单

## 切换到提审包前

- [data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js) 中：
  - `releaseStage` 改为 `review`
  - `showCloudDebug` 改为 `false`
- 云函数仍然指向正式环境
- 关键真机链路已在内部基线版通过

## 页面文案检查

- 不显示“云环境已连接”
- 不显示“本地回退”
- 不显示 `LOCAL PREVIEW`
- 不显示 `CLOUD SHARED`
- 不显示 `LOCAL`
- 不显示 `SYNCED`

## 业务体验检查

- 首页文案自然
- 课程页无调试信息
- 成长页无调试信息
- 家庭页与家长页的状态徽标为正式用户可理解文案
- `Song` 无资源时展示为自然占位，不像开发占位

## 上传前最后确认

- 真机或体验版复测通过
- 记录最终提审提交号
- 准备好审核路径和截图
