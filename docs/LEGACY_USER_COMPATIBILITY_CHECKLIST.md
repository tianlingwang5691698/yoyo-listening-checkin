# 老用户升级兼容检查清单

## 目标

版本更新后，老用户历史记录必须连续，不允许出现：

- 连续打卡回退
- 累计打卡变少
- 历史日报消失
- 昨日已完成任务重新刷出
- 课程计划跳错、回退或错位

## 必查对象

- 已连续打卡 3 天以上的老用户
- 已存在 `dailyTaskProgress` 但历史字段不完整的老用户
- 已存在 `dailyCheckins` / `dailyReports` 的真实用户
- 曾经历版本切换、规则调整、字段补建的老用户

建议至少准备 2 类样本：

- 样本 A：历史数据完整用户
- 样本 B：历史数据曾缺字段或缺单日 checkin 的用户

## 发版前必须检查

### 1. 连续打卡

- 检查升级前后的 `streakDays`
- 检查最近连续日期是否仍连续
- 检查 `dailyCheckins.streakSnapshot` 是否顺延，不回退

通过标准：

- 昨天连续 4 天，升级后仍显示连续 4 天或按当天真实状态继续增长

### 2. 累计打卡

- 检查 `dailyCheckins` 总数量
- 检查成长页累计打卡值
- 检查升级后累计值不减少

通过标准：

- 升级后累计打卡天数只能持平或增加，不能变少

### 3. 历史日报

- 检查最近 7 天家长日报
- 抽查至少 1 个更早历史日期
- 确认存在真实进度的日期不会显示“无记录”

通过标准：

- 已有真实播放记录的日期，升级后仍能看到对应日报或被稳定重算

### 4. 昨日完成任务延续

- 检查昨天已完成的任务，升级后首页不能重新刷出
- 检查 `dailyTaskProgress` 缺 `completedToday` 时是否仍能被兼容为完成
- 检查缺失单日 `dailyCheckins` 时，是否会自动补齐

通过标准：

- 昨日实际完成的任务，升级后不会重新回到今日待完成列表

### 5. 课程推进正确性

- 检查 `planDayIndex` 是否与历史打卡天数一致
- 检查 `New Concept 1`、`Peppa`、`Unlock1`、`Songs` 是否按既定规则顺延
- 检查不出现“连续天数正确但课程回退”或“课程跳过多天”

通过标准：

- 计划推进与历史完成状态一致，只顺延，不回退，不错位

## 数据库必查集合

- `dailyTaskProgress`
- `dailyCheckins`
- `dailyReports`
- `children`

## 重点字段

### `dailyTaskProgress`

- `date`
- `category`
- `taskId`
- `playCount`
- `repeatTarget`
- `completedToday`
- `textUnlocked`
- `planDayIndex`
- `planRunType`
- `targetDate`

### `dailyCheckins`

- `date`
- `completedAt`
- `completedCategories`
- `planDayIndex`
- `planPhase`
- `planRunType`
- `streakSnapshot`

### `dailyReports`

- `date`
- `completedCategories`
- `totalMinutes`
- `streakSnapshot`
- `items`

## 发现异常时先判断

### 情况 A：日历点亮，但日报无记录

优先检查：

- 是否只有 `dailyCheckins`
- `dailyTaskProgress` 是否缺对应日期
- `dailyTaskProgress.completedToday` 是否仍为 `false`

### 情况 B：日报存在，但日历没点亮

优先检查：

- 是否缺少 `dailyCheckins`
- 是否只存在 `dailyReports`

### 情况 C：连续天数不对

优先检查：

- `dailyCheckins` 是否缺日期
- `streakSnapshot` 是否顺延错误

### 情况 D：课程回退或跳错

优先检查：

- `planDayIndex`
- 历史 `dailyCheckins` 是否缺单日
- 老记录是否存在缺字段兼容问题

## 发版结论

只有下面 5 项全部通过，才允许判定“老用户兼容通过”：

- 连续打卡通过
- 累计打卡通过
- 历史日报通过
- 昨日完成任务延续通过
- 课程推进正确性通过
