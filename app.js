const appConfig = require('./app-config');
const theme = require('./utils/theme');
const i18n = require('./utils/i18n');

App({
  globalData: {
    brandName: appConfig.brandName,
    identityConfirmed: false,
    heatmapRefreshToken: 0,
    theme: 'dragon',
    language: 'zh-CN'
  },
  onLaunch() {
    this.globalData.theme = theme.getTheme();
    this.globalData.language = i18n.getLanguage();
  }
});
