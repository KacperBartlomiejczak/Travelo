import { placeCategory } from '../plan-categories';

describe('placeCategory', () => {
  it.each([
    [['restaurant', 'point_of_interest'], 'food'],
    [['cafe'], 'food'],
    [['night_club', 'bar'], 'nightlife'],
    [['art_museum'], 'museum'],
    [['park'], 'outdoor'],
    [['beach'], 'outdoor'],
    [['tourist_attraction'], 'other'],
    [[], 'other'],
  ])('%j -> %s', (types, expected) => {
    expect(placeCategory(types)).toBe(expected);
  });

  it('the first matching type wins on mixed types', () => {
    expect(placeCategory(['establishment', 'museum', 'restaurant'])).toBe('museum');
    expect(placeCategory(['bar', 'restaurant'])).toBe('nightlife');
  });
});
