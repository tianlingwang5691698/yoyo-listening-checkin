# 主题样式模块

- `theme-current.wxss`：主题入口，统一引入全部可切换主题。
- `theme-tabbar.wxss`：底部栏专用主题入口，避免自定义组件引入 `page` 选择器。
- `themes/warm.wxss`：当前高级暖白主题。
- `themes/fresh.wxss`：清新自然主题。
- `themes/sky.wxss`：晴空冷色主题。
- `base.wxss`：页面、卡片、按钮、字体层级等通用结构样式。
- `app.wxss`：只负责引入主题和基础样式。
- `custom-tab-bar/index.wxss`：单独引入当前主题，保证底部栏同步换肤。

页面内切换由 `utils/theme.js` 保存当前主题，页面根节点使用 `theme-{{theme}}` 生效。字体大小、字重和字体族也跟随主题变量变化。
