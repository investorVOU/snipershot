module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { unstable_transformImportMeta: true }],
    ],
    // react-native-reanimated v4 uses react-native-worklets/plugin internally —
    // do NOT add 'react-native-reanimated/plugin' here (it's v3 syntax)
  };
};
