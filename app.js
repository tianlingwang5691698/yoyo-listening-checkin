const appConfig = require('./data/app-config');

App({
  globalData: {
    brandName: appConfig.brandName,
    identityConfirmed: false
  },
  onLaunch() {}
});
