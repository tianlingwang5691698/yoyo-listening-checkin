# UI 规则审计记录

本文件记录按 [PRODUCT_DESIGN_RULES.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/PRODUCT_DESIGN_RULES.md) 和 [UI_CHANGE_CHECKLIST.md](/Users/wangtianlong/工作/工作流/微信小程序/佑佑听力打卡/docs/UI_CHANGE_CHECKLIST.md) 执行的项目级扫描结果。

## 2026-04-18 初始扫描

扫描命令：

```sh
rg "控制台|Dashboard|Console|PROGRAM CONSOLE|报表式总览|歌曲" pages/**/*.wxml pages/**/*.wxss app.wxss
rg ">开始<|0/1|font-weight: 900" pages/**/*.wxml pages/**/*.wxss app.wxss
```

结果：

- 页面层未发现 `控制台`、`Dashboard`、`Console`、`PROGRAM CONSOLE`、`报表式总览`、`歌曲`。
- 页面层未发现 `>开始<` 和 `0/1`。
- `font-weight: 900` 仅剩在数字/统计相关样式：
  - `app.wxss` 的 `data-value`
  - `app.wxss` 的 `stat-tile-value`
  - `pages/record/index.wxss` 的成长大数字

结论：

- 当前扫描结果符合“900 只允许用于成长页大数字或统计数字”的例外规则。
- 下一步整改重点不是文案违规，而是继续收敛页面结构，优先处理首页是否使用横向节目卡，以及课程页的说明文案密度。

## 2026-04-18 首页横向节目卡整改

整改内容：

- 删除首页 `today-strip` 独立总进度卡。
- 首页主内容改为原生 `swiper` 横向节目卡。
- Peppa / Unlock 1 / Songs 顺序固定。
- 卡片整张可点击进入当前节目任务。
- 多任务子行使用 `catchtap`，避免冒泡进入父卡任务。

扫描结果：

- 页面层未发现 `控制台`、`Dashboard`、`Console`、`PROGRAM CONSOLE`、`报表式总览`、`歌曲`。
- 页面层未发现 `>开始<` 和 `0/1`。
- `font-weight: 900` 仍仅出现在统计数字和成长大数字例外位置。
