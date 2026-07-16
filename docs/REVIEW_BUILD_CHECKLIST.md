# 提审包收口清单

## 切换到提审包前

- [data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js) 中：
  - `releaseStage` 已为 `review`
  - `showCloudDebug` 已为 `false`
- 云函数仍然指向正式环境
- 关键真机链路已在内部基线版通过
- 上传包配置已忽略 `docs`、`README.md`、`.cloudbase`、`scripts`、`output`、`tmp`、`cloudfunctions`、`cloudfunctions-dev`、`data/dictionary-import` 和本地私有配置
- 主包大小必须低于 2MB；若超限，先检查生成物、导入词典、素材中间产物是否混入，不通过删除业务页面降包
- 上传前使用合法域名校验，避免体验版误带开发态配置

## 页面文案检查

- 不显示“云环境已连接”
- 不显示“本地回退”
- 不显示“云函数”
- 不显示“修复”
- 不显示 `LOCAL PREVIEW`
- 不显示 `CLOUD SHARED`
- 不显示 `LOCAL`
- 不显示 `SYNCED`
- 不显示 `CLOUD ERROR`
- 不显示 `TEXT ON`
- 不显示 `WECHAT AUTO LOGIN`

## 业务体验检查

- 首页文案自然
- 课程页无调试信息
- 成长页无调试信息
- 家庭页与家长页的状态徽标为正式用户可理解文案
- `Song` 无资源时展示为自然占位，不像开发占位

## 上传前最后确认

- 真机或体验版复测通过
- 最终提审提交号：以 `v9.1.0` 标签解析结果为准
- 最终 Git tag：`v9.1.0`
- 最终 `yoyo` 云函数版本：`9.1.0`
- 准备好审核路径和截图
- 审核路径：打开首页今日任务 -> 进入课程页播放音频 -> 查看成长页 -> 进入我的页 -> 打开家庭页查看邀请码 -> 打开家长页查看日报
- 订阅消息模板 ID 当前为空时，不把日报提醒写成审核必测能力
