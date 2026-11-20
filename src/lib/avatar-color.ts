/** Stable palette index for an avatar key ('owner' or a member uuid), via 32-bit FNV-1a. */
export function avatarColorIndex(key: string, paletteSize: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % paletteSize;
}

/** First letter of the trimmed name (first code point, so emoji stay whole); '?' when empty. */
export function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '?';
}
