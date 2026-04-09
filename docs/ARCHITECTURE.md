# 仓库总览与职责边界

## 一句话架构

微信小程序前端通过 `utils/store` 统一访问业务数据，优先走 CloudBase 云函数 `yoyo`，只有开发态才允许回退本地数据。

## 代码分层

### 页面层 `pages/`

- 负责 UI 展示、交互与页面级状态
- 不直接操作数据库
- 统一从 `utils/store` 获取数据

当前主要页面：

- `home`：今日任务总览
- `level`：当前阶段与分类入口
- `lesson`：音频播放、逐句稿、进度写回
- `record`：成长热力图与累计指标
- `profile`：家庭共享与家长日报入口
- `family`：邀请码与家庭成员管理
- `parent`：家长日报与订阅偏好

### 数据入口层 `utils/store.js`

- 页面唯一推荐数据入口
- 封装云调用与本地 fallback
- 输出统一的 `syncMode` / `syncDebug`

约定：

- 页面不要绕过 `store` 直接访问本地 mock
- 真机验收时，以 `store` 返回的云态结果为准

### 业务域 `domain/`

- `cloud`：`wx.cloud.init`、`callFunction`、`getTempFileURL`
- `progress`：本地进度和 dashboard 逻辑
- `tasks`：任务编排与展示辅助
- `transcript`：逐句稿绑定
- `family`：本地家庭数据 fallback
- `reports`：本地日报 fallback
- `player`：播放时长和进度辅助

### 配置与静态数据 `data/`

- `app-config.js`：正式单一配置源
- `mock.js`：本地 mock 数据
- `transcripts/`：逐句稿数据
- `catalog.js`：目录和数据映射

### 云函数 `cloudfunctions/yoyo`

负责：

- 首次家庭初始化
- 家庭成员加入
- 每日任务分配与进度写回
- 打卡记录与日报聚合
- 云存储目录扫描
- 云端音频地址与 PDF 来源回传

依赖风险点：

- `@cloudbase/manager-node` 扫描目录
- `cloud.getTempFileURL` 生成临时可访问地址
- 首次数据库集合自动写入
- 云存储目录与命名规则一致性

## 正式配置来源

统一只认 [data/app-config.js](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/data/app-config.js)：

- `officialAppId`
- `cloudEnvId`
- `cloudBucket`
- `cloudAssetBaseUrl`
- `subscriptionTemplateIds`

其他文档只引用这份配置，不再重复维护独立环境值。

## 开发态与真机态约定

- 开发工具：
  - 允许本地 fallback
  - 必须显示失败原因
- 真机测试：
  - 首页、课程页、家庭页、家长页、成长页、我的页必须识别为 `syncMode=cloud`
  - 任何关键链路走本地 fallback 都视为未通过
