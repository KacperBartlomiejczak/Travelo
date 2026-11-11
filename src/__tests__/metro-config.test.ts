/**
 * @jest-environment node
 */
import path from 'node:path';

// Metro must not crawl or watch git worktrees under .claude/worktrees/ — each holds its own
// node_modules, and watching them makes Metro's file watcher time out on start.
describe('metro.config.js', () => {
  const root = path.resolve(__dirname, '../..');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(path.join(root, 'metro.config.js'));
  const blockList: RegExp[] = [config.resolver.blockList].flat();
  const blocked = (p: string) => blockList.some((re) => re.test(p));

  it('blocks files inside .claude/worktrees', () => {
    expect(
      blocked(path.join(root, '.claude', 'worktrees', 'some-branch', 'node_modules', 'react', 'index.js')),
    ).toBe(true);
  });

  it('does not block app source or dependencies', () => {
    expect(blocked(path.join(root, 'src', 'app', '_layout.tsx'))).toBe(false);
    expect(blocked(path.join(root, 'node_modules', 'react', 'index.js'))).toBe(false);
  });

  it('does not block a project that itself runs from another repo’s worktree', () => {
    const otherWorktree = path.join(path.dirname(root), 'Other', '.claude', 'worktrees', 'x');
    expect(blocked(path.join(otherWorktree, 'src', 'app', '_layout.tsx'))).toBe(false);
    expect(blocked(path.join(otherWorktree, 'node_modules', 'react', 'index.js'))).toBe(false);
  });
});
