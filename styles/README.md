# 主题样式模块

- `theme-current.wxss`：当前统一主题入口，只引入线上主主题。
- `theme-tabbar.wxss`：旧版底部栏专用主题入口，暂保留兼容。
- `themes/warm.wxss`：当前高级暖白主题。
- `themes/fresh.wxss`：清新自然主题。
- `themes/sky.wxss`：晴空冷色主题。
- `base.wxss`：页面、卡片、按钮、字体层级等通用结构样式。
- `app.wxss`：只负责引入主题和基础样式。
- `custom-tab-bar/index.wxss`：引入当前主题，保证底部栏同步统一主题。

页面内切换由 `utils/theme.js` 保存当前主题，页面根节点使用 `theme-{{theme}}` 生效。字体大小、字重和字体族也跟随主题变量变化。
