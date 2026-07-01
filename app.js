const appConfig = require('./data/app-config');
const theme = require('./utils/theme');

App({
  globalData: {
    brandName: appConfig.brandName,
    identityConfirmed: false,
    heatmapRefreshToken: 0,
    theme: 'warm'
  },
  onLaunch() {
    this.globalData.theme = theme.getTheme();
  }
});
