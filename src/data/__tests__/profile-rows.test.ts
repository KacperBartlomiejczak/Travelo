import { profileFromRow, type ProfileRow } from '@/data/profile-rows';

const row: ProfileRow = {
  id: '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d',
  username: 'kacper',
  friend_code: 'K7M2QX',
  interests: ['museums', 'beaches'],
  avatar_id: '6a5d3b0e-2f98-4c0a-b1aa-7e1d5e3d7f06',
  created_at: '2026-10-18T10:00:00+00:00',
  updated_at: '2026-10-18T10:05:00.123456+00:00',
};

describe('profileFromRow', () => {
  it('maps the columns to the entity', () => {
    expect(profileFromRow(row)).toEqual({
      id: row.id,
      username: 'kacper',
      friendCode: 'K7M2QX',
      interests: ['museums', 'beaches'],
      avatarId: row.avatar_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it('keeps a missing avatar as null', () => {
    expect(profileFromRow({ ...row, avatar_id: null }).avatarId).toBeNull();
  });

  it.each([
    ['a nick that breaks the rule', { username: 'Bad Nick' }],
    ['a friend code with a look-alike', { friend_code: 'K7M2Q0' }],
    ['no interests', { interests: [] }],
    ['an unknown interest', { interests: ['quidditch'] }],
    ['an id that is not a UUID', { id: 'me' }],
    ['a time without an offset', { created_at: '2026-10-18T10:00:00' }],
  ])('refuses a row with %s (the server is a boundary)', (_name, patch) => {
    expect(() => profileFromRow({ ...row, ...patch })).toThrow();
  });
});
