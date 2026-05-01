# 主题样式模块

- `theme-current.wxss`：当前启用主题入口，默认引入 `themes/warm.wxss`。
- `themes/warm.wxss`：当前高级暖白主题。
- `themes/fresh.wxss`：清新自然主题。
- `themes/night.wxss`：夜间沉浸主题。
- `base.wxss`：页面、卡片、按钮、字体层级等通用结构样式。
- `app.wxss`：只负责引入主题和基础样式。
- `custom-tab-bar/index.wxss`：单独引入当前主题，保证底部栏同步换肤。

切换主题时，修改 `theme-current.wxss` 的引入文件。字体大小、字重和字体族也跟随主题变量变化。
