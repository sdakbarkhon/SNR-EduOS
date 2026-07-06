// Metro для pnpm-монорепо. Expo SDK 54's getDefaultConfig уже сам детектит
// workspace (nodeModulesPaths/watchFolders для sibling-пакетов), поэтому
// вручную оставлен только disableHierarchicalLookup — без него Metro
// иерархическим поиском залезает в чужие вложенные node_modules
// (например react-native-reanimated/node_modules/react-native) и падает
// на несовместимом коде оттуда. unstable_enableSymlinks убран — hoisted
// линкер pnpm не использует симлинки, настройка была не нужна и добавляла
// нестабильность в native-fingerprint между локальной и EAS-сборкой.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.disableHierarchicalLookup = true;

module.exports = config;
