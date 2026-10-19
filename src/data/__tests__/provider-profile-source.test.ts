import { readProviderProfile, type ProviderProfileAuth } from '@/data/provider-profile-source';

// Recorded shapes of a Supabase session after a Google and a Discord sign-in (made-up people), see
// prompts/theme-split-and-profile-prefill/plan.md, step 5 source check.
const GOOGLE_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: {
    full_name: 'Anna Nowak',
    name: 'Anna Nowak',
    avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocAnnaNowakPhoto=s96-c',
    picture: 'https://lh3.googleusercontent.com/a/ACg8ocAnnaNowakPhoto=s96-c',
    email: 'anna.nowak@example.com',
  },
};
const DISCORD_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  app_metadata: { provider: 'discord', providers: ['discord'] },
  user_metadata: {
    full_name: 'jan_kowalski',
    name: 'jan_kowalski#0',
    avatar_url: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdef0123456789.png',
    custom_claims: { global_name: 'Jan K.' },
  },
};
const EMAIL_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { email: 'ewa@example.com', email_verified: true },
};

const NOTHING = { suggestedUsername: null, avatarUrl: null };

function authWith(user: unknown) {
  const getSession = jest.fn(async () => ({ data: { session: user ? { user } : null }, error: null }));
  return { auth: { getSession } as unknown as ProviderProfileAuth, getSession };
}

describe('readProviderProfile', () => {
  it('maps a Google session to a nick and the 512 px photo', async () => {
    const { auth } = authWith(GOOGLE_USER);
    await expect(readProviderProfile(auth)).resolves.toEqual({
      suggestedUsername: 'annanowak',
      avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocAnnaNowakPhoto=s512-c',
    });
  });

  it('maps a Discord session to a nick and the 512 px photo', async () => {
    const { auth } = authWith(DISCORD_USER);
    await expect(readProviderProfile(auth)).resolves.toEqual({
      suggestedUsername: 'jan_kowalski',
      avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdef0123456789.png?size=512',
    });
  });

  it('gives nothing for an e-mail session', async () => {
    const { auth } = authWith(EMAIL_USER);
    await expect(readProviderProfile(auth)).resolves.toEqual(NOTHING);
  });

  it('reads the stored session only, with no network call of its own', async () => {
    const { auth, getSession } = authWith(GOOGLE_USER);
    expect(Object.keys(auth)).toEqual(['getSession']);
    await readProviderProfile(auth);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('gives nothing without a session', async () => {
    const { auth } = authWith(null);
    await expect(readProviderProfile(auth)).resolves.toEqual(NOTHING);
  });

  it('gives nothing when the session has no metadata at all', async () => {
    const { auth } = authWith({ id: 'x' });
    await expect(readProviderProfile(auth)).resolves.toEqual(NOTHING);
  });

  it('gives nothing when reading the session answers with an error', async () => {
    const auth = { getSession: jest.fn(async () => ({ data: { session: null }, error: new Error('storage broken') })) };
    await expect(readProviderProfile(auth as unknown as ProviderProfileAuth)).resolves.toEqual(NOTHING);
  });

  it('gives nothing when reading the session throws', async () => {
    const auth = { getSession: jest.fn(async () => Promise.reject(new Error('boom'))) };
    await expect(readProviderProfile(auth as unknown as ProviderProfileAuth)).resolves.toEqual(NOTHING);
  });

  it('gives nothing for garbage metadata instead of throwing', async () => {
    const { auth } = authWith({ id: 'x', app_metadata: 'google', user_metadata: 42 });
    await expect(readProviderProfile(auth)).resolves.toEqual(NOTHING);
  });
});
