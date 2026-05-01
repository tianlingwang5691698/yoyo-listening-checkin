const THEME_STORAGE_KEY = 'uiTheme';

const THEMES = [
  { key: 'warm', label: '暖白' },
  { key: 'fresh', label: '清新' },
  { key: 'sky', label: '晴空' }
];

const THEME_MAP = THEMES.reduce((map, item) => {
  map[item.key] = item;
  return map;
}, {});

const WINDOW_COLORS = {
  warm: { backgroundColor: '#FFF8EE', frontColor: '#000000' },
  fresh: { backgroundColor: '#EEF8F4', frontColor: '#000000' },
  sky: { backgroundColor: '#F3F7FF', frontColor: '#000000' }
};

function normalizeTheme(value) {
  return THEME_MAP[value] ? value : 'warm';
}

function getTheme() {
  return normalizeTheme(wx.getStorageSync(THEME_STORAGE_KEY));
}

function setTheme(value) {
  const currentTheme = normalizeTheme(value);
  wx.setStorageSync(THEME_STORAGE_KEY, currentTheme);
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.theme = currentTheme;
  }
  return currentTheme;
}

function getThemeClass(value) {
  return `theme-${normalizeTheme(value)}`;
}

function getThemeLabel(value) {
  return THEME_MAP[normalizeTheme(value)].label;
}

function getThemeOptions() {
  return THEMES.map((item) => Object.assign({}, item));
}

function applyWindowTheme(value) {
  const colors = WINDOW_COLORS[normalizeTheme(value)] || WINDOW_COLORS.warm;
  wx.setNavigationBarColor({
    frontColor: colors.frontColor,
    backgroundColor: colors.backgroundColor
  });
}

function buildThemeData(value) {
  const currentTheme = normalizeTheme(value || getTheme());
  return {
    theme: currentTheme,
    themeClass: getThemeClass(currentTheme),
    themeOptions: getThemeOptions(),
    currentThemeLabel: getThemeLabel(currentTheme)
  };
}

module.exports = {
  normalizeTheme,
  getTheme,
  setTheme,
  getThemeClass,
  getThemeLabel,
  getThemeOptions,
  applyWindowTheme,
  buildThemeData
};
