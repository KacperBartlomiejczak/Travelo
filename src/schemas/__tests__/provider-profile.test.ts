import {
  ProviderMetadataSchema,
  ProviderProfileSchema,
  providerProfile,
  suggestUsername,
  UsernameSchema,
} from '@/schemas';

const NONE = { suggestedUsername: null, avatarUrl: null };

// Made-up people; the shapes follow what Supabase Auth stores in `user_metadata` for each provider.
const GOOGLE_METADATA = {
  iss: 'https://accounts.google.com',
  sub: '109876543210987654321',
  email: 'jan.kowalski@example.com',
  email_verified: true,
  name: 'Jan Kowalski',
  full_name: 'Jan Kowalski',
  avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocJxAmpleHash123456789=s96-c',
  picture: 'https://lh3.googleusercontent.com/a/ACg8ocJxAmpleHash123456789=s96-c',
  provider_id: '109876543210987654321',
};

const DISCORD_METADATA = {
  iss: 'https://discord.com/api',
  sub: '123456789012345678',
  email: 'ola@example.com',
  email_verified: true,
  name: 'ola_nowak#0',
  full_name: 'ola_nowak',
  custom_claims: { global_name: 'Ola Nowak' },
  avatar_url: 'https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png',
  picture: 'https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png',
  provider_id: '123456789012345678',
};

describe('suggestUsername', () => {
  it.each([
    ['Kacper Bartłomiejczak', 'kacperbartlomiejczak'],
    ['kacper_b.', 'kacper_b'],
    ['Zażółć Gęślą', 'zazolcgesla'],
    ['ŁÓDŹ', 'lodz'],
    ['Jean-Luc Picard', 'jeanlucpicard'],
    ['José Müller', 'josemuller'],
    ['a..b', 'a.b'],
    ['a....b', 'a.b'],
    ['_99kacper', 'kacper'],
    ['🙂kacper🙂', 'kacper'],
    ['  Kacper  ', 'kacper'],
  ])('turns %j into %j', (input, expected) => {
    expect(suggestUsername(input)).toBe(expected);
  });

  it.each([['Ąę'], ['12'], [''], ['   '], ['🙂🙂🙂'], ['_ _ _'], ['9999']])('returns null for %j', (input) => {
    expect(suggestUsername(input)).toBeNull();
  });

  it('cuts a long name to 20 characters', () => {
    expect(suggestUsername('abcdefghijklmnopqrstuvwxy')).toBe('abcdefghijklmnopqrst');
  });

  it('strips a trailing dot left by the 20-character cut', () => {
    expect(suggestUsername('aaaaaaaaaaaaaaaaaaa.bcd')).toBe('aaaaaaaaaaaaaaaaaaa');
  });

  it('always returns a value UsernameSchema accepts, or null', () => {
    const inputs = ['Kacper Bartłomiejczak', '..a..', 'x', 'a.b.c.d.e.f.g.h.i.j.k.l', '١٢٣abc', 'ǅ', '\u0000abc'];
    for (const input of inputs) {
      const result = suggestUsername(input);
      if (result !== null) expect(UsernameSchema.safeParse(result).success).toBe(true);
    }
  });
});

describe('ProviderMetadataSchema', () => {
  it('keeps the four known string fields and ignores unknown keys', () => {
    expect(ProviderMetadataSchema.parse({ ...GOOGLE_METADATA })).toEqual({
      full_name: 'Jan Kowalski',
      name: 'Jan Kowalski',
      avatar_url: GOOGLE_METADATA.avatar_url,
      picture: GOOGLE_METADATA.picture,
    });
  });

  it('treats a field of the wrong type as absent instead of throwing', () => {
    const result = ProviderMetadataSchema.safeParse({ full_name: 5, name: null, avatar_url: {}, picture: ['x'] });
    expect(result.success).toBe(true);
    expect(result.data?.full_name).toBeUndefined();
    expect(result.data?.name).toBeUndefined();
    expect(result.data?.avatar_url).toBeUndefined();
    expect(result.data?.picture).toBeUndefined();
  });
});

describe('providerProfile', () => {
  describe('google', () => {
    it('suggests a nick and a 512 px photo', () => {
      expect(providerProfile('google', GOOGLE_METADATA)).toEqual({
        suggestedUsername: 'jankowalski',
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocJxAmpleHash123456789=s512-c',
      });
    });

    it('prefers full_name over name', () => {
      const result = providerProfile('google', { ...GOOGLE_METADATA, full_name: 'Zofia Nowak', name: 'Someone Else' });
      expect(result.suggestedUsername).toBe('zofianowak');
    });

    it('falls back to name when full_name is absent', () => {
      const { full_name: _fullName, ...rest } = GOOGLE_METADATA;
      expect(providerProfile('google', rest).suggestedUsername).toBe('jankowalski');
    });

    it('falls back to picture when avatar_url is absent', () => {
      const { avatar_url: _avatarUrl, ...rest } = GOOGLE_METADATA;
      expect(providerProfile('google', rest).avatarUrl).toBe(
        'https://lh3.googleusercontent.com/a/ACg8ocJxAmpleHash123456789=s512-c',
      );
    });

    it('replaces a size suffix without the crop flag', () => {
      const result = providerProfile('google', { avatar_url: 'https://lh3.googleusercontent.com/a/xyz=s64' });
      expect(result.avatarUrl).toBe('https://lh3.googleusercontent.com/a/xyz=s512-c');
    });

    it('appends the size suffix when there is none', () => {
      const result = providerProfile('google', { avatar_url: 'https://lh3.googleusercontent.com/a/xyz' });
      expect(result.avatarUrl).toBe('https://lh3.googleusercontent.com/a/xyz=s512-c');
    });

    it('gives a photo but no nick when the name cannot make a valid nick', () => {
      const result = providerProfile('google', { ...GOOGLE_METADATA, name: '李', full_name: '李' });
      expect(result.suggestedUsername).toBeNull();
      expect(result.avatarUrl).not.toBeNull();
    });

    it('gives a nick and no photo when the metadata has no photo', () => {
      expect(providerProfile('google', { full_name: 'Jan Kowalski' })).toEqual({
        suggestedUsername: 'jankowalski',
        avatarUrl: null,
      });
    });
  });

  describe('discord', () => {
    it('suggests the Discord username and a 512 px png', () => {
      expect(providerProfile('discord', DISCORD_METADATA)).toEqual({
        suggestedUsername: 'ola_nowak',
        avatarUrl:
          'https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png?size=512',
      });
    });

    it('requests an animated gif avatar as png', () => {
      const url = 'https://cdn.discordapp.com/avatars/123456789012345678/a_0123456789abcdef0123456789abcdef.gif';
      const result = providerProfile('discord', { ...DISCORD_METADATA, avatar_url: url, picture: url });
      expect(result.avatarUrl).toBe(
        'https://cdn.discordapp.com/avatars/123456789012345678/a_0123456789abcdef0123456789abcdef.png?size=512',
      );
    });

    it('replaces an existing query', () => {
      const url = 'https://cdn.discordapp.com/avatars/1/abc.png?size=64&foo=bar';
      expect(providerProfile('discord', { avatar_url: url }).avatarUrl).toBe(
        'https://cdn.discordapp.com/avatars/1/abc.png?size=512',
      );
    });

    it('ignores the default avatar', () => {
      const url = 'https://cdn.discordapp.com/embed/avatars/3.png';
      const result = providerProfile('discord', { ...DISCORD_METADATA, avatar_url: url, picture: url });
      expect(result.avatarUrl).toBeNull();
      expect(result.suggestedUsername).toBe('ola_nowak');
    });

    it('takes the nick from name before # when full_name is absent', () => {
      const { full_name: _fullName, ...rest } = DISCORD_METADATA;
      expect(providerProfile('discord', rest).suggestedUsername).toBe('ola_nowak');
    });

    it('does not use the display name', () => {
      expect(providerProfile('discord', { custom_claims: { global_name: 'Ola Nowak' } })).toEqual(NONE);
    });

    it('falls back to picture when avatar_url is absent', () => {
      const { avatar_url: _avatarUrl, ...rest } = DISCORD_METADATA;
      expect(providerProfile('discord', rest).avatarUrl).toBe(
        'https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png?size=512',
      );
    });
  });

  describe('other providers', () => {
    it.each([['email'], ['github'], [''], [undefined], [null], [42], [{}], [['google']]])(
      'gives nothing for provider %j',
      (provider) => {
        expect(providerProfile(provider, GOOGLE_METADATA)).toEqual(NONE);
      },
    );
  });

  describe('untrusted avatar URLs', () => {
    const goodPath = '/avatars/1/abc.png';
    it.each([
      ['http instead of https', 'http://cdn.discordapp.com' + goodPath],
      ['another host', 'https://example.com' + goodPath],
      ['a look-alike subdomain suffix', 'https://cdn.discordapp.com.evil.com' + goodPath],
      ['a look-alike prefix', 'https://evilcdn.discordapp.com' + goodPath],
      ['credentials in front of the host', 'https://evil.com@cdn.discordapp.com' + goodPath],
      ['the host used as credentials', 'https://cdn.discordapp.com@evil.com' + goodPath],
      ['backslash trick', 'https://evil.com\\@cdn.discordapp.com' + goodPath],
      ['a non-default port', 'https://cdn.discordapp.com:8443' + goodPath],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a data: URL', 'data:image/png;base64,AAAA'],
      ['a relative path', goodPath],
      ['not a URL', 'not a url'],
      ['the Google host under Discord', 'https://lh3.googleusercontent.com/a/xyz=s96-c'],
    ])('discord: %s gives no photo', (_label, url) => {
      expect(providerProfile('discord', { full_name: 'ola_nowak', avatar_url: url, picture: url })).toEqual({
        suggestedUsername: 'ola_nowak',
        avatarUrl: null,
      });
    });

    it.each([
      ['http instead of https', 'http://lh3.googleusercontent.com/a/xyz=s96-c'],
      ['another host', 'https://example.com/a/xyz=s96-c'],
      ['a look-alike host', 'https://lh3.googleusercontent.com.evil.com/a/xyz=s96-c'],
      ['credentials', 'https://evil.com@lh3.googleusercontent.com/a/xyz=s96-c'],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['the Discord host under Google', 'https://cdn.discordapp.com/avatars/1/abc.png'],
    ])('google: %s gives no photo', (_label, url) => {
      expect(providerProfile('google', { full_name: 'Jan Kowalski', avatar_url: url, picture: url })).toEqual({
        suggestedUsername: 'jankowalski',
        avatarUrl: null,
      });
    });

    it('does not fall back to picture when avatar_url is present but unsafe', () => {
      const result = providerProfile('google', {
        avatar_url: 'https://example.com/x',
        picture: 'https://lh3.googleusercontent.com/a/xyz=s96-c',
      });
      expect(result.avatarUrl).toBeNull();
    });
  });

  describe('garbage metadata', () => {
    it.each([[null], [undefined], [42], ['text'], [[]], [true], [{}], [{ full_name: 5, avatar_url: {} }]])(
      'never throws and gives nothing for %j',
      (metadata) => {
        for (const provider of ['google', 'discord', 'email']) {
          expect(providerProfile(provider, metadata)).toEqual(NONE);
        }
      },
    );

    it('returns a result that passes ProviderProfileSchema for every fixture', () => {
      const results = [
        providerProfile('google', GOOGLE_METADATA),
        providerProfile('discord', DISCORD_METADATA),
        providerProfile('email', {}),
        providerProfile('discord', { avatar_url: 'http://cdn.discordapp.com/avatars/1/a.png' }),
        providerProfile('google', { name: 'x', avatar_url: 'garbage' }),
      ];
      for (const result of results) expect(ProviderProfileSchema.safeParse(result).success).toBe(true);
    });
  });
});

describe('ProviderProfileSchema', () => {
  it.each([
    [NONE],
    [{ suggestedUsername: 'kacper_b', avatarUrl: null }],
    [{ suggestedUsername: null, avatarUrl: 'https://lh3.googleusercontent.com/a/xyz=s512-c' }],
    [{ suggestedUsername: 'ola_nowak', avatarUrl: 'https://cdn.discordapp.com/avatars/1/abc.png?size=512' }],
  ])('accepts %j', (value) => {
    expect(ProviderProfileSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ['http', { suggestedUsername: null, avatarUrl: 'http://cdn.discordapp.com/avatars/1/abc.png' }],
    ['another host', { suggestedUsername: null, avatarUrl: 'https://example.com/a.png' }],
    ['a look-alike host', { suggestedUsername: null, avatarUrl: 'https://cdn.discordapp.com.evil.com/a.png' }],
    ['credentials', { suggestedUsername: null, avatarUrl: 'https://evil.com@cdn.discordapp.com/a.png' }],
    ['a bad nick', { suggestedUsername: 'Kacper B', avatarUrl: null }],
    ['a too short nick', { suggestedUsername: 'ab', avatarUrl: null }],
    ['a missing nick', { avatarUrl: null }],
    ['a missing url', { suggestedUsername: null }],
    ['an empty url', { suggestedUsername: null, avatarUrl: '' }],
  ])('rejects %s', (_label, value) => {
    expect(ProviderProfileSchema.safeParse(value).success).toBe(false);
  });
});
