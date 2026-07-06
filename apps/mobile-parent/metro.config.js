// Metro для pnpm-монорепо: следим за общими пакетами и резолвим оба node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Следить за всем монорепо (исходники @snr/core, @snr/ui-tokens).
config.watchFolders = [workspaceRoot];

// 2. Резолвить модули из локального и корневого node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Поддержка симлинков workspace и без иерархического подъёма (node-linker=hoisted).
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
