// NFD does not decompose these letters, so they are mapped by hand (Łódź → lodz).
const LETTERS: Record<string, string> = { ł: 'l', ø: 'o', ı: 'i', ð: 'd', đ: 'd', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };

/** Lower-case text without diacritics, for matching ("Kraków" → "krakow"). */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[łøıðđæœßþ]/g, (letter) => LETTERS[letter]);
}
