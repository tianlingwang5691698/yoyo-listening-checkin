const THEME_STORAGE_KEY = 'uiTheme';

const THEMES = [
  { key: 'warm', label: '雾蓝玻璃' },
  { key: 'library', label: '图书馆静谧' }
];

const THEME_MAP = THEMES.reduce((map, item) => {
  map[item.key] = item;
  return map;
}, {});

const WINDOW_COLORS = {
  warm: { backgroundColor: '#F6FBFD', frontColor: '#000000' },
  library: { backgroundColor: '#FAF5EA', frontColor: '#000000' }
};

const SLIDER_COLORS = {
  warm: {
    activeColor: '#86AAA1',
    backgroundColor: 'rgba(141, 183, 212, 0.22)',
    blockColor: '#F6FBFD'
  },
  library: {
    activeColor: '#B89562',
    backgroundColor: 'rgba(184, 149, 98, 0.22)',
    blockColor: '#FAF5EA'
  }
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
  applyWindowTheme(currentTheme);
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

function applyWindowTheme(value, overrides) {
  const currentTheme = normalizeTheme(value);
  const pageColors = WINDOW_COLORS[currentTheme] || WINDOW_COLORS.warm;
  const colors = Object.assign(
    {},
    pageColors,
    overrides || {}
  );
  wx.setNavigationBarColor({
    frontColor: colors.frontColor,
    backgroundColor: colors.backgroundColor
  });
  if (wx.setBackgroundColor) {
    wx.setBackgroundColor({
      backgroundColor: pageColors.backgroundColor,
      backgroundColorTop: pageColors.backgroundColor,
      backgroundColorBottom: pageColors.backgroundColor
    });
  }
}

function buildThemeData(value) {
  const currentTheme = normalizeTheme(value || getTheme());
  return {
    theme: currentTheme,
    themeClass: getThemeClass(currentTheme),
    themeOptions: getThemeOptions(),
    currentThemeLabel: getThemeLabel(currentTheme),
    themeSlider: SLIDER_COLORS[currentTheme] || SLIDER_COLORS.warm
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
