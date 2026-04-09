const store = require('./utils/store');
const appConfig = require('./data/app-config');

App({
  globalData: {
    brandName: appConfig.brandName
  },
  onLaunch() {
    store.ensureState().catch(() => {});
  }
});
