// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Git worktrees under .claude/worktrees/ each carry a full node_modules. Without this,
// Metro crawls and watches them and its file watcher times out on start ("Failed to start watch mode").
config.resolver.blockList = [
  ...[config.resolver.blockList ?? []].flat(),
  /[\\/]\.claude[\\/]worktrees[\\/].*/,
];

module.exports = config;
