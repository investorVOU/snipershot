const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude npm's temporary unpack directories (.ox-*, .staging, etc.) from the
// file watcher — they appear briefly during `npm install` and Metro crashes if
// they're deleted while being watched.
config.resolver.blockList = [
  /node_modules[/\\]\.ox-[^/\\]+[/\\].*/,
  /node_modules[/\\]\.staging[/\\].*/,
];

// Use browser condition first so Solana/Privy packages resolve browser-safe builds
config.resolver.unstable_conditionNames = ['browser', 'react-native', 'require'];

// Remap jose and viem to their CJS builds (Metro can't resolve their exports map)
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    try {
      const josePath = require.resolve('jose/dist/browser/index.js', {
        paths: [context.originModulePath],
      });
      return { filePath: josePath, type: 'sourceFile' };
    } catch {
      // fall through to default
    }
  }
  if (moduleName === 'viem') {
    return { filePath: path.resolve(__dirname, 'node_modules/viem/_cjs/index.js'), type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
