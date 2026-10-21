import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  FriendCodeInputSchema,
  FriendCodeSchema,
  FoundFriendSchema,
  ProfileSchema,
  ProfileSetupInputSchema,
  ShownProfileSchema,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  UsernameSchema,
} from '@/schemas';

const UUID = '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b';
const OTHER_UUID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

const PROFILE = {
  id: UUID,
  username: 'kacper_b',
  friendCode: 'K7QX2M',
  interests: ['museums', 'beaches'],
  avatarId: OTHER_UUID,
  createdAt: '2026-10-18T10:00:00+02:00',
  updatedAt: '2026-10-18T10:00:00.123Z',
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('Username', () => {
  it('has the documented limits', () => {
    expect(USERNAME_MIN_LENGTH).toBe(3);
    expect(USERNAME_MAX_LENGTH).toBe(20);
  });

  it.each(['kacper', 'kacper_b', 'k.b.2', 'abc', 'a'.repeat(20)])('accepts %p', (value) => {
    expect(UsernameSchema.parse(value)).toBe(value);
  });

  it.each([
    ['too short', 'ab'],
    ['21 characters', 'a'.repeat(21)],
    ['uppercase', 'Kacper'],
    ['leading digit', '1kacper'],
    ['leading underscore', '_kacper'],
    ['double dot', 'kac..per'],
    ['trailing dot', 'kacper.'],
    ['space', 'kac per'],
    ['non-ASCII letter', 'kacpér'],
    ['emoji', 'kacper\u{1F600}'],
    ['empty', ''],
  ])('rejects %s with the format key', (_name, value) => {
    const result = UsernameSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(['validation.usernameFormat']);
  });

  it('does not trim or lowercase the stored form', () => {
    expect(UsernameSchema.safeParse(' kacper').success).toBe(false);
    expect(UsernameSchema.safeParse('KACPER').success).toBe(false);
  });
});

describe('FriendCode', () => {
  it('has an alphabet of 31 unique characters without 0 O 1 I L', () => {
    expect(FRIEND_CODE_ALPHABET).toHaveLength(31);
    expect(new Set(FRIEND_CODE_ALPHABET).size).toBe(31);
    for (const excluded of '0O1IL') expect(FRIEND_CODE_ALPHABET).not.toContain(excluded);
    expect(FRIEND_CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
  });

  it('is 6 characters long', () => {
    expect(FRIEND_CODE_LENGTH).toBe(6);
  });

  it.each(['K7QX2M', 'ABCDEF', '234567'])('accepts %p', (value) => {
    expect(FriendCodeSchema.parse(value)).toBe(value);
  });

  it('accepts a code made of every alphabet character', () => {
    for (const char of FRIEND_CODE_ALPHABET) {
      expect(FriendCodeSchema.safeParse(char.repeat(FRIEND_CODE_LENGTH)).success).toBe(true);
    }
  });

  it.each([...'0O1IL'])('rejects a code containing %p', (char) => {
    expect(FriendCodeSchema.safeParse(`ABC${char}EF`).success).toBe(false);
  });

  it.each([
    ['lowercase', 'k7qx2m'],
    ['5 characters', 'K7QX2'],
    ['7 characters', 'K7QX2MA'],
    ['empty', ''],
    ['a space', 'K7QX2 '],
    ['a symbol', 'K7QX2-'],
  ])('rejects %s', (_name, value) => {
    expect(FriendCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe('Profile', () => {
  it('accepts a full profile', () => {
    expect(ProfileSchema.parse(PROFILE)).toEqual(PROFILE);
  });

  it('accepts a profile without an avatar', () => {
    expect(ProfileSchema.safeParse({ ...PROFILE, avatarId: null }).success).toBe(true);
  });

  it('rejects an empty interests list', () => {
    const result = ProfileSchema.safeParse({ ...PROFILE, interests: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['interests']);
  });

  it('rejects an unknown interest tag', () => {
    expect(ProfileSchema.safeParse({ ...PROFILE, interests: ['skydiving'] }).success).toBe(false);
  });

  it('rejects a non-uuid avatar id and id', () => {
    expect(ProfileSchema.safeParse({ ...PROFILE, avatarId: 'avatar' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...PROFILE, id: 'me' }).success).toBe(false);
  });

  it('rejects a missing avatarId (it must be an explicit null)', () => {
    const { avatarId: _avatarId, ...withoutAvatar } = PROFILE;
    expect(ProfileSchema.safeParse(withoutAvatar).success).toBe(false);
  });

  it('rejects timestamps without an offset', () => {
    expect(ProfileSchema.safeParse({ ...PROFILE, createdAt: '2026-10-18T10:00:00' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...PROFILE, updatedAt: '2026-10-18' }).success).toBe(false);
  });

  it('rejects a bad username or friend code', () => {
    expect(ProfileSchema.safeParse({ ...PROFILE, username: 'Kacper' }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...PROFILE, friendCode: 'k7qx2m' }).success).toBe(false);
  });
});

describe('ShownProfile', () => {
  it('accepts a profile without a signed URL', () => {
    expect(ShownProfileSchema.parse(PROFILE)).toEqual(PROFILE);
  });

  it('accepts an https avatar URL', () => {
    const shown = {
      ...PROFILE,
      avatarUrl: `https://abc.supabase.co/storage/v1/object/sign/avatars/${UUID}/${OTHER_UUID}.jpg?token=abc`,
    };
    expect(ShownProfileSchema.parse(shown)).toEqual(shown);
  });

  it.each(['ftp://example.com/a.jpg', 'file:///a.jpg', 'javascript:alert(1)', 'not a url'])(
    'rejects the avatar URL %p',
    (avatarUrl) => {
      expect(ShownProfileSchema.safeParse({ ...PROFILE, avatarUrl }).success).toBe(false);
    },
  );
});

describe('ProfileSetupInput', () => {
  const valid = { username: 'kacper', interests: ['museums'], avatarUri: null };

  it('accepts a valid form', () => {
    expect(ProfileSetupInputSchema.parse(valid)).toEqual(valid);
  });

  it('trims and lowercases the nick', () => {
    expect(ProfileSetupInputSchema.parse({ ...valid, username: '  Kacper  ' }).username).toBe('kacper');
  });

  it.each(['', '   '])('reports an empty nick %p as required', (username) => {
    const result = ProfileSetupInputSchema.safeParse({ ...valid, username });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(['validation.usernameRequired']);
    expect(result.error?.issues[0].path).toEqual(['username']);
  });

  it.each(['ab', 'a'.repeat(21), '1kacper', 'kac..per', 'kacper.', 'kac per', 'kacpér'])(
    'reports the nick %p as a format error',
    (username) => {
      const result = ProfileSetupInputSchema.safeParse({ ...valid, username });
      expect(result.success).toBe(false);
      expect(messages(result)).toEqual(['validation.usernameFormat']);
      expect(result.error?.issues[0].path).toEqual(['username']);
    },
  );

  it('requires at least one interest', () => {
    const result = ProfileSetupInputSchema.safeParse({ ...valid, interests: [] });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(['validation.interestsRequired']);
    expect(result.error?.issues[0].path).toEqual(['interests']);
  });

  it('rejects an unknown interest tag', () => {
    const result = ProfileSetupInputSchema.safeParse({ ...valid, interests: ['skydiving'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe('interests');
  });

  it.each(['file:///x.jpg', 'file:///data/user/0/cache/ImagePicker/a b.jpg'])('accepts the picked photo %p', (avatarUri) => {
    expect(ProfileSetupInputSchema.parse({ ...valid, avatarUri }).avatarUri).toBe(avatarUri);
  });

  it.each(['https://example.com/a.jpg', 'content://media/external/images/1', '', 'x.jpg'])(
    'rejects the avatar URI %p',
    (avatarUri) => {
      const result = ProfileSetupInputSchema.safeParse({ ...valid, avatarUri });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(['avatarUri']);
    },
  );

  it('rejects a missing avatarUri', () => {
    expect(ProfileSetupInputSchema.safeParse({ username: 'kacper', interests: ['museums'] }).success).toBe(false);
  });
});

describe('FriendCodeInput (friend-invite)', () => {
  it('trims and uppercases what the user typed', () => {
    expect(FriendCodeInputSchema.parse(' 5zmrx8 ')).toBe('5ZMRX8');
  });

  it.each([
    ['5 characters', '5ZMRX'],
    ['7 characters', '5ZMRX8K'],
    ['an empty string', ''],
    ['a 0', '5ZMRX0'],
    ['an O', '5ZMRXO'],
    ['a 1', '5ZMRX1'],
    ['an I', '5ZMRXI'],
    ['an L', '5ZMRXl'],
  ])('rejects %s', (_, value) => {
    expect(FriendCodeInputSchema.safeParse(value).success).toBe(false);
  });
});

describe('FoundFriend (friend-invite)', () => {
  const found = { username: 'kacper_b', interests: ['museums', 'beaches'] };

  it('accepts what the lookup returns', () => {
    expect(FoundFriendSchema.parse(found)).toEqual(found);
  });

  it('keeps only the nick and interests (never the account id or the friend code)', () => {
    expect(Object.keys(FoundFriendSchema.parse({ ...found, id: UUID, friendCode: 'K7QX2M' })).sort()).toEqual(['interests', 'username']);
  });

  it.each([
    ['an invalid nick', { username: 'Kacper!' }],
    ['no interests', { interests: [] }],
    ['an unknown interest', { interests: ['knitting'] }],
  ])('rejects %s', (_, patch) => {
    expect(FoundFriendSchema.safeParse({ ...found, ...patch }).success).toBe(false);
  });
});
