const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field resolution — required for
// @supabase/supabase-js v2 and other modern ESM packages.
config.resolver.unstable_enablePackageExports = true;

// Ensure .cjs files are resolved (supabase ships dist/index.cjs)
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Stub out optional/peer dependencies that supabase-js references but
// we don't need in a React Native / Expo app.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@opentelemetry/api': path.resolve(__dirname, 'src/utils/emptyModule.js'),
};

module.exports = config;
