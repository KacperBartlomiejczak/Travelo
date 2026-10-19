import { createInMemoryProfileRepository, UsernameTakenError } from '@/data/profile-repository';
import { FriendCodeSchema, ShownProfileSchema } from '@/schemas';

const NOW = new Date('2026-10-18T10:00:00.000Z');

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

const setup = (options: Parameters<typeof createInMemoryProfileRepository>[0] = {}) =>
  createInMemoryProfileRepository({ now: () => NOW, newId: sequentialIds(), ...options });

const SETUP = { username: 'kacper', interests: ['museums' as const], avatarUri: null };

describe('in-memory profile repository (tests only)', () => {
  it('has no profile at first', async () => {
    await expect(setup().myProfile()).resolves.toBeNull();
  });

  it('creates a profile with a valid friend code, shown from then on and never from the cache', async () => {
    const repository = setup();
    const created = await repository.createProfile(SETUP);

    expect(ShownProfileSchema.safeParse(created).success).toBe(true);
    expect(FriendCodeSchema.safeParse(created.friendCode).success).toBe(true);
    expect(created).toEqual(
      expect.objectContaining({ username: 'kacper', interests: ['museums'], avatarId: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }),
    );
    expect(created.avatarUrl).toBeUndefined();
    await expect(repository.myProfile()).resolves.toEqual({ profile: created, fromCache: false });
  });

  it('normalises the nick like the form schema does', async () => {
    const created = await setup().createProfile({ ...SETUP, username: '  Kacper.B  ' });
    expect(created.username).toBe('kacper.b');
  });

  it('gives a picked photo an avatar id and a url', async () => {
    const created = await setup().createProfile({ ...SETUP, avatarUri: 'file:///picked/me.jpg' });
    expect(created.avatarId).not.toBeNull();
    expect(created.avatarUrl).toMatch(/^https:\/\//);
    expect(ShownProfileSchema.safeParse(created).success).toBe(true);
  });

  it('rejects a taken nick with UsernameTakenError, whatever its case, and creates nothing', async () => {
    const repository = setup({ takenUsernames: ['kacper'] });
    await expect(repository.createProfile({ ...SETUP, username: 'Kacper' })).rejects.toBeInstanceOf(UsernameTakenError);
    await expect(repository.myProfile()).resolves.toBeNull();
  });

  it('accepts a nick that is not taken', async () => {
    const repository = setup({ takenUsernames: ['someone'] });
    await expect(repository.createProfile(SETUP)).resolves.toEqual(expect.objectContaining({ username: 'kacper' }));
  });

  it.each([
    ['a short nick', { ...SETUP, username: 'ab' }],
    ['an empty nick', { ...SETUP, username: '   ' }],
    ['no interests', { ...SETUP, interests: [] }],
    ['an avatar that is not a file', { ...SETUP, avatarUri: 'https://example.com/me.jpg' }],
  ])('rejects invalid input (%s) with a ZodError and creates nothing', async (_name, input) => {
    const repository = setup();
    await expect(repository.createProfile(input as never)).rejects.toMatchObject({ name: 'ZodError' });
    await expect(repository.myProfile()).resolves.toBeNull();
  });
});
