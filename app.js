const appConfig = require('./data/app-config');

App({
  globalData: {
    brandName: appConfig.brandName,
    identityConfirmed: false,
    heatmapRefreshToken: 0
  },
  onLaunch() {}
});
