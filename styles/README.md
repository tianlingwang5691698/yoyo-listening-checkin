# 主题样式模块

- `theme-current.wxss`：当前整套主题变量，替换主题优先改这里。
- `base.wxss`：页面、卡片、按钮、字体等通用结构样式。
- `app.wxss`：只负责引入主题和基础样式。
- `custom-tab-bar/index.wxss`：单独引入当前主题，保证底部栏同步换肤。

新增主题时，先复制 `theme-current.wxss`，再替换变量值。
