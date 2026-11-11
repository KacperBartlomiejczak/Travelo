// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Git worktrees under .claude/worktrees/ each carry a full node_modules. Without this,
// Metro crawls and watches them and its file watcher times out on start ("Failed to start watch mode").
// Anchored to this project, so Metro started from inside a worktree does not block its own files.
const worktrees = path
  .join(__dirname, '.claude', 'worktrees')
  .split(/[\\/]/)
  .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[\\\\/]');
config.resolver.blockList = [
  ...[config.resolver.blockList ?? []].flat(),
  new RegExp(`^${worktrees}[\\\\/].*`),
];

module.exports = config;
