import { avatarColorIndex, avatarInitial } from '../avatar-color';

describe('avatarColorIndex', () => {
  it('is deterministic', () => {
    expect(avatarColorIndex('owner', 6)).toBe(avatarColorIndex('owner', 6));
  });

  it.each([1, 3, 6, 8])('stays in [0, %i)', (size) => {
    for (let i = 0; i < 100; i++) {
      const idx = avatarColorIndex(`member-${i}`, size);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(size);
    }
  });

  it('spreads 50 uuids over at least 4 of 6 colors', () => {
    const hit = new Set<number>();
    for (let i = 0; i < 50; i++) {
      hit.add(avatarColorIndex(`3f2a9c1e-0000-4000-8000-${String(i).padStart(12, '0')}`, 6));
    }
    expect(hit.size).toBeGreaterThanOrEqual(4);
  });
});

describe('avatarInitial', () => {
  it.each([
    ['kacper', 'K'],
    ['  ola', 'O'],
    ['łukasz', 'Ł'],
    ['', '?'],
    ['   ', '?'],
    ['😀 smile', '😀'],
    ['ßara', 'S'],
  ])('%j -> %j', (name, expected) => {
    expect(avatarInitial(name)).toBe(expected);
  });
});
