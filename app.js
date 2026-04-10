const appConfig = require('./data/app-config');

App({
  globalData: {
    brandName: appConfig.brandName
  },
  onLaunch() {}
});
