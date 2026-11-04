import { NotSignedInError } from '@/data/auth';
import { ServerUnreachableError } from '@/data/errors';
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import { UsernameMismatchError, UsernameTakenError } from '@/data/profile-repository';
import type { ProfileRow } from '@/data/profile-rows';
import { createSupabaseProfileRepository } from '@/data/supabase-profile-repository';
import { ShownProfileSchema, type Profile } from '@/schemas';
import { fakeSignedUrl, fakeSupabase, NETWORK_FAILURE, SIGNED_IN_USER_ID, STORAGE_NETWORK_FAILURE } from '@/test/fake-supabase';
import { openTestDb } from '@/test/node-sqlite';

const NOW = new Date('2026-10-18T10:00:00.000Z');
const BUCKET = 'avatars';
const AVATAR_ID = '00000000-0000-4000-8000-000000000001';
const OLD_AVATAR_ID = '00000000-0000-4000-8000-0000000000aa';
const PREPARED = { file: new Uint8Array([1, 2, 3]), uri: 'file:///cache/avatar-1.jpg' };
const PICKED = 'file:///gallery/me.jpg';
const SETUP = { username: 'kacper', interests: ['museums' as const, 'beaches' as const], avatarUri: PICKED };
const SETUP_WITHOUT_PHOTO = { ...SETUP, avatarUri: null };

const pathOf = (avatarId: string) => `${SIGNED_IN_USER_ID}/${avatarId}.jpg`;

function row(patch: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: SIGNED_IN_USER_ID,
    username: 'kacper',
    friend_code: 'K7M2QX',
    interests: ['museums', 'beaches'],
    avatar_id: AVATAR_ID,
    created_at: '2026-10-18T10:00:00+00:00',
    updated_at: '2026-10-18T10:00:00+00:00',
    ...patch,
  };
}

const profileOf = (patch: Partial<Profile> = {}): Profile => ({
  id: SIGNED_IN_USER_ID,
  username: 'kacper',
  friendCode: 'K7M2QX',
  interests: ['museums', 'beaches'],
  avatarId: AVATAR_ID,
  createdAt: '2026-10-18T10:00:00+00:00',
  updatedAt: '2026-10-18T10:00:00+00:00',
  ...patch,
});

async function setup(extra: Partial<Parameters<typeof createSupabaseProfileRepository>[0]> = {}) {
  const supabase = fakeSupabase();
  const db = openTestDb();
  await migrateLocalDb(db);
  const local = createLocalStore(db);
  const prepare = jest.fn(async (_uri: string) => PREPARED);
  const seed = jest.fn(async (_uri: string, _cacheKey: string) => {});
  const repository = createSupabaseProfileRepository({
    supabase: supabase.client,
    local: Promise.resolve(local),
    now: () => NOW,
    newId: () => AVATAR_ID,
    prepareAvatar: prepare,
    seedImageCache: seed,
    ...extra,
  });
  return { supabase, db, local, repository, prepare, seed };
}

type Setup = Awaited<ReturnType<typeof setup>>;
const calls = (supabase: Setup['supabase'], method: string) => supabase.storageCalls.filter((call) => call.method === method);
const offlineSession = (supabase: Setup['supabase']) => {
  const { AuthRetryableFetchError } = jest.requireActual('@supabase/supabase-js');
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null as never }, error: new AuthRetryableFetchError('Network request failed', 0) });
};

describe('myProfile', () => {
  it('reads the profile whose id is the signed-in user, nothing else', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row() });
    await repository.myProfile();
    expect(supabase.queries).toEqual([
      {
        table: 'profiles',
        ops: [
          ['select', ['*']],
          ['eq', ['id', SIGNED_IN_USER_ID]],
          ['maybeSingle', []],
        ],
      },
    ]);
  });

  it('gives the parsed profile with a signed avatar url, not from the cache', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row() });

    const mine = await repository.myProfile();

    expect(mine).toEqual({ profile: { ...profileOf(), avatarUrl: fakeSignedUrl(BUCKET, pathOf(AVATAR_ID)) }, fromCache: false });
    expect(ShownProfileSchema.safeParse(mine?.profile).success).toBe(true);
  });

  it('signs the avatar file <userId>/<avatarId>.jpg in the avatars bucket for one hour', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row() });
    await repository.myProfile();
    expect(supabase.storageCalls).toEqual([{ bucket: BUCKET, method: 'createSignedUrl', args: [pathOf(AVATAR_ID), 3600] }]);
  });

  it('asks Storage for nothing when the profile has no avatar', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row({ avatar_id: null }) });

    const mine = await repository.myProfile();

    expect(supabase.storageCalls).toEqual([]);
    expect(mine?.profile).toEqual(profileOf({ avatarId: null }));
    expect(mine?.profile.avatarUrl).toBeUndefined();
  });

  it('writes the copy on the device, without the signed url, with the time of the read', async () => {
    const { supabase, db, local, repository } = await setup();
    supabase.respond('profiles', { data: row() });

    await repository.myProfile();

    await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    const stored = await db.getFirstAsync<{ profile_json: string; cached_at: string }>('select profile_json, cached_at from my_profile_cache', []);
    expect(stored?.cached_at).toBe(NOW.toISOString());
    expect(stored?.profile_json).not.toContain('token');
    expect(stored?.profile_json).not.toContain('avatarUrl');
  });

  it('still gives the profile, without an avatar url, when signing fails', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('profiles', { data: row() });
    supabase.respondStorage('createSignedUrl', { error: { message: 'Object not found', status: 404 } });

    const mine = await repository.myProfile();

    expect(mine).toEqual({ profile: profileOf(), fromCache: false });
    expect(mine?.profile.avatarUrl).toBeUndefined();
    await expect(local.cachedProfile()).resolves.toEqual(profileOf());
  });

  it('still gives the profile when signing cannot reach Storage or throws', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row() }, { data: row() });
    supabase.respondStorage('createSignedUrl', STORAGE_NETWORK_FAILURE);
    await expect(repository.myProfile()).resolves.toEqual({ profile: profileOf(), fromCache: false });

    jest.mocked(supabase.client.storage.from).mockReturnValueOnce({
      createSignedUrl: () => Promise.reject(new Error('boom')),
    } as never);
    await expect(repository.myProfile()).resolves.toEqual({ profile: profileOf(), fromCache: false });
  });

  it('leaves out a signed url that is not http(s)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row() });
    jest.mocked(supabase.client.storage.from).mockReturnValueOnce({
      createSignedUrl: async () => ({ data: { signedUrl: 'javascript:alert(1)' }, error: null }),
    } as never);

    const mine = await repository.myProfile();

    expect(mine?.profile.avatarUrl).toBeUndefined();
  });

  it('gives null and forgets the copy when the server has no profile for this user', async () => {
    const { supabase, local, repository } = await setup();
    await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
    supabase.respond('profiles', { data: null });

    await expect(repository.myProfile()).resolves.toBeNull();

    await expect(local.cachedProfile()).resolves.toBeNull();
    expect(supabase.storageCalls).toEqual([]);
  });

  describe('not signed in', () => {
    it('rejects with NotSignedInError, sends nothing, and does not hand out a copy', async () => {
      const { supabase, local, repository } = await setup();
      await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
      supabase.storedSession('none');

      await expect(repository.myProfile()).rejects.toBeInstanceOf(NotSignedInError);

      expect(supabase.queries).toEqual([]);
      expect(supabase.storageCalls).toEqual([]);
      await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    });
  });

  describe('offline', () => {
    it('gives the copy, marked as from the cache, when the request cannot reach the server', async () => {
      const { supabase, local, repository } = await setup();
      await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
      supabase.respond('profiles', NETWORK_FAILURE);

      await expect(repository.myProfile()).resolves.toEqual({ profile: profileOf(), fromCache: true });
      expect(supabase.storageCalls).toEqual([]);
    });

    it('rejects with ServerUnreachableError when there is no copy', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', NETWORK_FAILURE);
      await expect(repository.myProfile()).rejects.toBeInstanceOf(ServerUnreachableError);
    });

    it('does not use the copy of another user', async () => {
      const { supabase, local, repository } = await setup();
      await local.cacheProfile(profileOf({ id: '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02' }), '2026-10-17T10:00:00.000Z');
      supabase.respond('profiles', NETWORK_FAILURE);
      await expect(repository.myProfile()).rejects.toBeInstanceOf(ServerUnreachableError);
    });

    it('uses the copy as it is when the session itself cannot be read for lack of connection, and sends nothing', async () => {
      // The stored session is there, but its token cannot be refreshed offline; the copy is the only thing to show, and
      // the user whose copy it is was the one signed in (a new sign-in clears the copy first, D2).
      const { supabase, local, repository } = await setup();
      await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
      offlineSession(supabase);

      await expect(repository.myProfile()).resolves.toEqual({ profile: profileOf(), fromCache: true });
      expect(supabase.queries).toEqual([]);
    });

    it('rejects with ServerUnreachableError when the session cannot be read and there is no copy', async () => {
      const { supabase, repository } = await setup();
      offlineSession(supabase);
      await expect(repository.myProfile()).rejects.toBeInstanceOf(ServerUnreachableError);
      expect(supabase.queries).toEqual([]);
    });

    it('does not take a damaged copy for a profile', async () => {
      const { supabase, db, repository } = await setup();
      await db.runAsync("insert into my_profile_cache (id, profile_json, cached_at) values (1, '{not json', 'x')", []);
      supabase.respond('profiles', NETWORK_FAILURE);
      await expect(repository.myProfile()).rejects.toBeInstanceOf(ServerUnreachableError);
    });
  });

  describe('other failures', () => {
    it("rejects with the server's message and keeps the copy", async () => {
      const { supabase, local, repository } = await setup();
      await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
      supabase.respond('profiles', { error: { message: 'permission denied for table profiles' }, status: 403 });

      const rejected = repository.myProfile();
      await expect(rejected).rejects.toThrow('permission denied');
      await expect(rejected).rejects.not.toBeInstanceOf(ServerUnreachableError);
      await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    });

    it('rejects, and writes no copy, when the row does not match the schema', async () => {
      const { supabase, local, repository } = await setup();
      supabase.respond('profiles', { data: row({ friend_code: 'ab0oil' }) });
      await expect(repository.myProfile()).rejects.toThrow();
      await expect(local.cachedProfile()).resolves.toBeNull();
    });
  });
});

describe('createProfile', () => {
  const insertQuery = (patch: Record<string, unknown> = {}) => ({
    table: 'profiles',
    ops: [
      ['insert', [{ id: SIGNED_IN_USER_ID, username: 'kacper', interests: ['museums', 'beaches'], avatar_id: AVATAR_ID, ...patch }]],
      ['select', ['*']],
      ['single', []],
    ],
  });

  describe('input and session', () => {
    it.each([
      ['an invalid nick', { ...SETUP, username: 'Bad Nick' }],
      ['an empty nick', { ...SETUP, username: '  ' }],
      ['no interest', { ...SETUP, interests: [] }],
      ['an avatar that is not a file', { ...SETUP, avatarUri: 'https://example.com/me.jpg' }],
    ])('rejects %s with a ZodError before any request', async (_name, input) => {
      const { supabase, repository, prepare } = await setup();
      await expect(repository.createProfile(input as never)).rejects.toMatchObject({ name: 'ZodError' });
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      expect(supabase.queries).toEqual([]);
      expect(supabase.storageCalls).toEqual([]);
      expect(prepare).not.toHaveBeenCalled();
    });

    it('rejects with NotSignedInError and sends nothing when nobody is signed in', async () => {
      const { supabase, repository, prepare } = await setup();
      supabase.storedSession('none');
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(NotSignedInError);
      expect(supabase.queries).toEqual([]);
      expect(supabase.storageCalls).toEqual([]);
      expect(prepare).not.toHaveBeenCalled();
    });

    it('rejects as unreachable, before preparing anything, when the session cannot be read for lack of connection', async () => {
      const { supabase, repository, prepare } = await setup();
      offlineSession(supabase);
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(ServerUnreachableError);
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.queries).toEqual([]);
    });

    it('rejects an avatar id that is not a lowercase UUID before preparing or sending anything (Storage paths are case-sensitive)', async () => {
      const { supabase, repository, prepare } = await setup({ newId: () => '00000000-0000-4000-8000-0000000000AA' });
      await expect(repository.createProfile(SETUP)).rejects.toThrow();
      expect(prepare).not.toHaveBeenCalled();
      expect(supabase.storageCalls).toEqual([]);
      expect(supabase.queries).toEqual([]);
    });
  });

  describe('without a photo', () => {
    it('inserts the nick (trimmed, lowercase), the interests and no avatar, and calls Storage not at all', async () => {
      const { supabase, repository, prepare, seed } = await setup();
      supabase.respond('profiles', { data: row({ avatar_id: null }) });

      const created = await repository.createProfile({ ...SETUP_WITHOUT_PHOTO, username: '  Kacper ' });

      expect(supabase.queries).toEqual([insertQuery({ avatar_id: null })]);
      expect(supabase.storageCalls).toEqual([]);
      expect(prepare).not.toHaveBeenCalled();
      expect(seed).not.toHaveBeenCalled();
      expect(created).toEqual(profileOf({ avatarId: null }));
      expect(created.avatarUrl).toBeUndefined();
    });

    it('writes the copy on the device', async () => {
      const { supabase, local, repository } = await setup();
      supabase.respond('profiles', { data: row({ avatar_id: null }) });
      await repository.createProfile(SETUP_WITHOUT_PHOTO);
      await expect(local.cachedProfile()).resolves.toEqual(profileOf({ avatarId: null }));
    });
  });

  describe('with a photo', () => {
    it('prepares the picked photo, uploads it to <userId>/<avatarId>.jpg as a JPEG that must not overwrite, then inserts the row', async () => {
      const { supabase, repository, prepare } = await setup();
      supabase.respond('profiles', { data: row() });

      await repository.createProfile(SETUP);

      expect(prepare).toHaveBeenCalledWith(PICKED);
      expect(calls(supabase, 'upload')).toEqual([
        { bucket: BUCKET, method: 'upload', args: [pathOf(AVATAR_ID), PREPARED.file, { contentType: 'image/jpeg', upsert: false }] },
      ]);
      expect(supabase.sequence).toEqual(['storage.upload', 'from:profiles', 'storage.createSignedUrl']);
    });

    it('inserts exactly id, username, interests and avatar_id: never the friend code or the times', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', { data: row() });

      await repository.createProfile(SETUP);

      expect(supabase.queries).toEqual([insertQuery()]);
      const inserted = (supabase.queries[0].ops[0][1] as Record<string, unknown>[])[0];
      expect(Object.keys(inserted).sort()).toEqual(['avatar_id', 'id', 'interests', 'username']);
    });

    it('gives the profile with a signed avatar url and keeps a copy without it', async () => {
      const { supabase, local, repository } = await setup();
      supabase.respond('profiles', { data: row() });

      const created = await repository.createProfile(SETUP);

      expect(created).toEqual({ ...profileOf(), avatarUrl: fakeSignedUrl(BUCKET, pathOf(AVATAR_ID)) });
      expect(calls(supabase, 'createSignedUrl')).toEqual([{ bucket: BUCKET, method: 'createSignedUrl', args: [pathOf(AVATAR_ID), 3600] }]);
      await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    });

    it('seeds the image cache with the prepared file under avatar:<avatarId>, after the row is in', async () => {
      const { supabase, repository, seed } = await setup();
      supabase.respond('profiles', { data: row() });
      seed.mockImplementation(async () => void supabase.sequence.push('seed'));

      await repository.createProfile(SETUP);

      expect(seed).toHaveBeenCalledTimes(1);
      expect(seed).toHaveBeenCalledWith(PREPARED.uri, `avatar:${AVATAR_ID}`);
      expect(supabase.sequence.at(-1)).toBe('seed');
    });

    it('still resolves when seeding the image cache fails (it only saves a download)', async () => {
      const { supabase, repository, seed } = await setup();
      supabase.respond('profiles', { data: row() });
      seed.mockRejectedValueOnce(new Error('disk full'));
      await expect(repository.createProfile(SETUP)).resolves.toEqual(expect.objectContaining({ username: 'kacper' }));
    });

    it('rejects, inserts nothing and removes nothing when the photo cannot be prepared', async () => {
      const { supabase, repository, prepare } = await setup();
      prepare.mockRejectedValueOnce(new Error('could not read the image'));
      await expect(repository.createProfile(SETUP)).rejects.toThrow('could not read the image');
      expect(supabase.storageCalls).toEqual([]);
      expect(supabase.queries).toEqual([]);
    });
  });

  describe('a taken nick (R10)', () => {
    const TAKEN = {
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_username_key"',
        details: 'Key (username)=(kacper) already exists.',
      },
      status: 409,
    };

    it('rejects with UsernameTakenError, removes the uploaded file, and keeps no copy or image cache', async () => {
      const { supabase, local, repository, seed } = await setup();
      supabase.respond('profiles', TAKEN);

      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(UsernameTakenError);

      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
      expect(seed).not.toHaveBeenCalled();
      await expect(local.cachedProfile()).resolves.toBeNull();
    });

    it('also recognises the constraint when only the details name it', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', {
        error: { code: '23505', message: 'duplicate key value', details: 'Key (username)=(kacper) violates profiles_username_key' },
        status: 409,
      });
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(UsernameTakenError);
    });

    it('needs no removal when there was no photo', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', TAKEN);
      await expect(repository.createProfile(SETUP_WITHOUT_PHOTO)).rejects.toBeInstanceOf(UsernameTakenError);
      expect(supabase.storageCalls).toEqual([]);
    });

    it('still rejects with UsernameTakenError when removing the file fails', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', TAKEN);
      supabase.respondStorage('remove', { error: { message: 'boom', status: 500 } });
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(UsernameTakenError);
    });

    it('does not take another unique violation for a taken nick (R10): a plain error, file removed', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', {
        error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_friend_code_key"' },
        status: 409,
      });

      const rejected = repository.createProfile(SETUP);
      await expect(rejected).rejects.toThrow('profiles_friend_code_key');
      await expect(rejected).rejects.not.toBeInstanceOf(UsernameTakenError);
      expect(calls(supabase, 'remove')).toHaveLength(1);
    });
  });

  describe('a retry after a lost answer that was in fact applied (primary key conflict)', () => {
    const CONFLICT = { error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_pkey"' }, status: 409 };

    it('reads the stored profile and returns it, with the same avatar left in place', async () => {
      const { supabase, local, repository, seed } = await setup();
      supabase.respond('profiles', CONFLICT, { data: row() });

      const created = await repository.createProfile(SETUP);

      expect(created).toEqual({ ...profileOf(), avatarUrl: fakeSignedUrl(BUCKET, pathOf(AVATAR_ID)) });
      expect(supabase.queries[1]).toEqual({
        table: 'profiles',
        ops: [
          ['select', ['*']],
          ['eq', ['id', SIGNED_IN_USER_ID]],
          ['maybeSingle', []],
        ],
      });
      expect(calls(supabase, 'remove')).toEqual([]);
      expect(seed).toHaveBeenCalledWith(PREPARED.uri, `avatar:${AVATAR_ID}`);
      await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    });

    it('removes the new file when the stored profile uses another avatar, and returns the stored one', async () => {
      const { supabase, repository, seed } = await setup();
      supabase.respond('profiles', CONFLICT, { data: row({ avatar_id: OLD_AVATAR_ID }) });

      const created = await repository.createProfile(SETUP);

      expect(created.avatarId).toBe(OLD_AVATAR_ID);
      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
      expect(seed).not.toHaveBeenCalled();
    });

    it('removes the new file when the stored profile has no avatar', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', CONFLICT, { data: row({ avatar_id: null }) });

      const created = await repository.createProfile(SETUP);

      expect(created.avatarId).toBeNull();
      expect(calls(supabase, 'remove')).toHaveLength(1);
    });

    it('returns the stored profile of a retry that has no photo', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', CONFLICT, { data: row({ avatar_id: null }) });
      await expect(repository.createProfile(SETUP_WITHOUT_PHOTO)).resolves.toEqual(profileOf({ avatarId: null }));
      expect(supabase.storageCalls).toEqual([]);
    });

    it('keeps the file when the stored profile cannot be read (it may be the one in use)', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', CONFLICT, NETWORK_FAILURE);
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(ServerUnreachableError);
      expect(calls(supabase, 'remove')).toEqual([]);
    });
  });

  describe('failures', () => {
    it('insert unreachable: rejects as unreachable and keeps the uploaded file (the insert may have been applied)', async () => {
      const { supabase, local, repository, seed } = await setup();
      supabase.respond('profiles', NETWORK_FAILURE);

      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(ServerUnreachableError);

      expect(calls(supabase, 'remove')).toEqual([]);
      expect(seed).not.toHaveBeenCalled();
      await expect(local.cachedProfile()).resolves.toBeNull();
    });

    it.each([500, 502, 503, 504])('insert answered with %i: rejects with the message and keeps the uploaded file (the row may exist)', async (status) => {
      const { supabase, local, repository, seed } = await setup();
      supabase.respond('profiles', { error: { message: 'upstream error' }, status });

      const rejected = repository.createProfile(SETUP);
      await expect(rejected).rejects.toThrow('upstream error');
      await expect(rejected).rejects.not.toBeInstanceOf(UsernameTakenError);

      expect(calls(supabase, 'remove')).toEqual([]);
      expect(seed).not.toHaveBeenCalled();
      await expect(local.cachedProfile()).resolves.toBeNull();
    });

    it('insert answered with a 4xx refusal: still removes the uploaded file', async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', { error: { message: 'bad request', code: '22023' }, status: 400 });

      await expect(repository.createProfile(SETUP)).rejects.toThrow('bad request');

      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
    });

    it("insert refused: rejects with the server's message and removes the uploaded file", async () => {
      const { supabase, repository } = await setup();
      supabase.respond('profiles', {
        error: { code: '42501', message: 'new row violates row-level security policy for table "profiles"' },
        status: 403,
      });

      const rejected = repository.createProfile(SETUP);
      await expect(rejected).rejects.toThrow('row-level security');
      await expect(rejected).rejects.not.toBeInstanceOf(ServerUnreachableError);

      expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
    });

    it('upload refused: rejects with the message and inserts nothing', async () => {
      const { supabase, repository, seed } = await setup();
      supabase.respondStorage('upload', { error: { message: 'The object exceeded the maximum allowed size', status: 413 } });

      await expect(repository.createProfile(SETUP)).rejects.toThrow('maximum allowed size');

      expect(supabase.queries).toEqual([]);
      expect(seed).not.toHaveBeenCalled();
    });

    it('upload unreachable: rejects as unreachable and inserts nothing', async () => {
      const { supabase, repository } = await setup();
      supabase.respondStorage('upload', STORAGE_NETWORK_FAILURE);
      await expect(repository.createProfile(SETUP)).rejects.toBeInstanceOf(ServerUnreachableError);
      expect(supabase.queries).toEqual([]);
    });

    it('a row that does not match the schema rejects, and the file stays (the row exists)', async () => {
      const { supabase, local, repository } = await setup();
      supabase.respond('profiles', { data: row({ friend_code: 'ab0oil' }) });
      await expect(repository.createProfile(SETUP)).rejects.toThrow();
      expect(calls(supabase, 'remove')).toEqual([]);
      await expect(local.cachedProfile()).resolves.toBeNull();
    });
  });
});

describe('findByFriendCode (friend-invite D12)', () => {
  const FOUND = { username: 'ola', interests: ['museums', 'beaches'] };

  it('asks find_profile_by_friend_code for the trimmed, uppercased code, after checking the session', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: [FOUND], error: null, status: 200 });

    await repository.findByFriendCode(' 5zmrx8 ');

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.rpc.mock.calls).toEqual([['find_profile_by_friend_code', { code: '5ZMRX8' }]]);
    expect(supabase.queries).toEqual([]);
  });

  it('gives the nick and interests of the found friend, nothing else', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: [{ ...FOUND, id: SIGNED_IN_USER_ID }], error: null, status: 200 });
    await expect(repository.findByFriendCode('5ZMRX8')).resolves.toEqual(FOUND);
  });

  it('gives null when no account has the code', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: [], error: null, status: 200 });
    await expect(repository.findByFriendCode('5ZMRX8')).resolves.toBeNull();
  });

  it.each([
    ['too short', '5ZMRX'],
    ['too long', '5ZMRX8K'],
    ['a look-alike character', '5ZMRO8'],
    ['empty', '   '],
  ])('rejects an invalid code (%s) with a ZodError before any request', async (_name, code) => {
    const { supabase, repository } = await setup();
    await expect(repository.findByFriendCode(code)).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it.each([
    ['a row with an invalid nick', [{ ...FOUND, username: 'A' }]],
    ['a row without interests', [{ username: 'ola' }]],
    ['a row with no interests chosen', [{ ...FOUND, interests: [] }]],
    ['more than one row', [FOUND, { ...FOUND, username: 'ala' }]],
    ['something that is no list', FOUND],
  ])('rejects a malformed answer (%s)', async (_name, data) => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data, error: null, status: 200 });
    await expect(repository.findByFriendCode('5ZMRX8')).rejects.toThrow();
  });

  it('rejects with ServerUnreachableError when the request gets no answer', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce(NETWORK_FAILURE);
    await expect(repository.findByFriendCode('5ZMRX8')).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it('rejects with ServerUnreachableError when the session cannot be read for lack of connection, and sends nothing', async () => {
    const { supabase, repository } = await setup();
    offlineSession(supabase);
    await expect(repository.findByFriendCode('5ZMRX8')).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects with NotSignedInError and sends nothing when nobody is signed in (it must not read "unknown code")', async () => {
    const { supabase, repository } = await setup();
    supabase.storedSession('none');
    await expect(repository.findByFriendCode('5ZMRX8')).rejects.toBeInstanceOf(NotSignedInError);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects with the server message (not as unreachable) on a server error', async () => {
    const { supabase, repository } = await setup();
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' }, status: 500 });
    const rejection = repository.findByFriendCode('5ZMRX8');
    await expect(rejection).rejects.toThrow('boom');
    await expect(rejection).rejects.not.toBeInstanceOf(ServerUnreachableError);
  });
});

describe('updateProfile', () => {
  const EDIT = { username: '  Ola ', interests: ['museums' as const] };
  const TAKEN = {
    error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_key"', details: 'Key (username)=(ola) already exists.' },
    status: 409,
  };

  it('updates exactly the nick (trimmed, lowercase) and interests of the own row and returns it with the signed avatar url', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: row({ username: 'ola', interests: ['museums'] }) });

    const updated = await repository.updateProfile(EDIT);

    expect(supabase.queries).toEqual([
      {
        table: 'profiles',
        ops: [
          ['update', [{ username: 'ola', interests: ['museums'] }]],
          ['eq', ['id', SIGNED_IN_USER_ID]],
          ['select', ['*']],
          ['single', []],
        ],
      },
    ]);
    expect(updated).toEqual({ ...profileOf({ username: 'ola', interests: ['museums'] }), avatarUrl: fakeSignedUrl(BUCKET, pathOf(AVATAR_ID)) });
  });

  it('writes the answer to the copy on the device, without the signed url', async () => {
    const { supabase, local, repository } = await setup();
    await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
    supabase.respond('profiles', { data: row({ username: 'ola' }) });

    await repository.updateProfile(EDIT);

    await expect(local.cachedProfile()).resolves.toEqual(profileOf({ username: 'ola' }));
  });

  it.each([
    ['an invalid nick', { ...EDIT, username: 'Bad Nick' }],
    ['no interest', { ...EDIT, interests: [] }],
  ])('rejects %s with a ZodError before any request', async (_name, input) => {
    const { supabase, repository } = await setup();
    await expect(repository.updateProfile(input as never)).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    expect(supabase.queries).toEqual([]);
  });

  it('rejects with UsernameTakenError on a taken nick and keeps the copy', async () => {
    const { supabase, local, repository } = await setup();
    await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
    supabase.respond('profiles', TAKEN);
    await expect(repository.updateProfile(EDIT)).rejects.toBeInstanceOf(UsernameTakenError);
    await expect(local.cachedProfile()).resolves.toEqual(profileOf());
  });

  it('does not take another unique violation for a taken nick', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { error: { code: '23505', message: 'violates "profiles_friend_code_key"' }, status: 409 });
    const rejected = repository.updateProfile(EDIT);
    await expect(rejected).rejects.toThrow('profiles_friend_code_key');
    await expect(rejected).rejects.not.toBeInstanceOf(UsernameTakenError);
  });

  it('rejects as unreachable when there is no answer, with the server message on other errors', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', NETWORK_FAILURE, { error: { message: 'boom' }, status: 500 });
    await expect(repository.updateProfile(EDIT)).rejects.toBeInstanceOf(ServerUnreachableError);
    const rejected = repository.updateProfile(EDIT);
    await expect(rejected).rejects.toThrow('boom');
    await expect(rejected).rejects.not.toBeInstanceOf(ServerUnreachableError);
  });

  it('rejects as unreachable and sends nothing when the session cannot be read for lack of connection', async () => {
    const { supabase, repository } = await setup();
    offlineSession(supabase);
    await expect(repository.updateProfile(EDIT)).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.queries).toEqual([]);
  });
});

describe('changeAvatar (A6)', () => {
  const readOld = { data: { avatar_id: OLD_AVATAR_ID } };
  const readQuery = {
    table: 'profiles',
    ops: [
      ['select', ['avatar_id']],
      ['eq', ['id', SIGNED_IN_USER_ID]],
      ['single', []],
    ],
  };
  const updateQuery = {
    table: 'profiles',
    ops: [
      ['update', [{ avatar_id: AVATAR_ID }]],
      ['eq', ['id', SIGNED_IN_USER_ID]],
      ['select', ['*']],
      ['single', []],
    ],
  };

  it('reads the avatar id, uploads under a new id, updates the row, then removes the old file, in that order', async () => {
    const { supabase, repository, prepare } = await setup();
    supabase.respond('profiles', readOld, { data: row() });

    await repository.changeAvatar(PICKED);

    expect(prepare).toHaveBeenCalledWith(PICKED);
    expect(supabase.queries).toEqual([readQuery, updateQuery]);
    expect(supabase.sequence.filter((step) => step !== 'storage.createSignedUrl')).toEqual([
      'from:profiles',
      'storage.upload',
      'from:profiles',
      'storage.remove',
    ]);
    expect(calls(supabase, 'upload')).toEqual([
      { bucket: BUCKET, method: 'upload', args: [pathOf(AVATAR_ID), PREPARED.file, { contentType: 'image/jpeg', upsert: false }] },
    ]);
    expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(OLD_AVATAR_ID)]] }]);
  });

  it('gives the profile with the new signed url, keeps the copy and seeds the image cache', async () => {
    const { supabase, local, repository, seed } = await setup();
    supabase.respond('profiles', readOld, { data: row() });

    const changed = await repository.changeAvatar(PICKED);

    expect(changed).toEqual({ ...profileOf(), avatarUrl: fakeSignedUrl(BUCKET, pathOf(AVATAR_ID)) });
    await expect(local.cachedProfile()).resolves.toEqual(profileOf());
    expect(seed).toHaveBeenCalledWith(PREPARED.uri, `avatar:${AVATAR_ID}`);
  });

  it('removes nothing when there was no avatar before', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: { avatar_id: null } }, { data: row() });
    await repository.changeAvatar(PICKED);
    expect(calls(supabase, 'remove')).toEqual([]);
  });

  it('still resolves when removing the old file fails', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', readOld, { data: row() });
    supabase.respondStorage('remove', { error: { message: 'boom', status: 500 } });
    await expect(repository.changeAvatar(PICKED)).resolves.toEqual(expect.objectContaining({ avatarId: AVATAR_ID }));
  });

  it('still resolves when removing the old file throws', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', readOld, { data: row() });
    const realFrom = jest.mocked(supabase.client.storage.from).getMockImplementation()!;
    jest.mocked(supabase.client.storage.from).mockImplementation((bucket: string) => ({
      ...realFrom(bucket),
      remove: () => Promise.reject(new Error('boom')),
    }) as never);
    await expect(repository.changeAvatar(PICKED)).resolves.toEqual(expect.objectContaining({ avatarId: AVATAR_ID }));
  });

  it('rejects with a ZodError for a picked uri that is not a file, before any request', async () => {
    const { supabase, repository } = await setup();
    await expect(repository.changeAvatar('https://example.com/me.jpg')).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.queries).toEqual([]);
    expect(supabase.storageCalls).toEqual([]);
  });

  it('rejects an avatar id that is not a lowercase UUID before uploading', async () => {
    const { supabase, repository, prepare } = await setup({ newId: () => '00000000-0000-4000-8000-0000000000AA' });
    supabase.respond('profiles', readOld);
    await expect(repository.changeAvatar(PICKED)).rejects.toThrow();
    expect(prepare).not.toHaveBeenCalled();
    expect(supabase.storageCalls).toEqual([]);
  });

  it('rejects, uploads nothing, when the avatar id cannot be read', async () => {
    const { supabase, repository, prepare } = await setup();
    supabase.respond('profiles', NETWORK_FAILURE);
    await expect(repository.changeAvatar(PICKED)).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(prepare).not.toHaveBeenCalled();
    expect(supabase.storageCalls).toEqual([]);
  });

  it('upload refused or unreachable: rejects, updates nothing, removes nothing', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', readOld, readOld);
    supabase.respondStorage('upload', { error: { message: 'too big', status: 413 } }, STORAGE_NETWORK_FAILURE);
    await expect(repository.changeAvatar(PICKED)).rejects.toThrow('too big');
    await expect(repository.changeAvatar(PICKED)).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.queries).toHaveLength(2);
    expect(calls(supabase, 'remove')).toEqual([]);
  });

  it('update refused with a 4xx: removes the new file, keeps the old one, copy untouched', async () => {
    const { supabase, local, repository } = await setup();
    await local.cacheProfile(profileOf({ avatarId: OLD_AVATAR_ID }), '2026-10-17T10:00:00.000Z');
    supabase.respond('profiles', readOld, { error: { message: 'bad request' }, status: 400 });

    await expect(repository.changeAvatar(PICKED)).rejects.toThrow('bad request');

    expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
    await expect(local.cachedProfile()).resolves.toEqual(profileOf({ avatarId: OLD_AVATAR_ID }));
  });

  it('update with no answer: rejects as unreachable and keeps both files (the row may have changed)', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', readOld, NETWORK_FAILURE);
    await expect(repository.changeAvatar(PICKED)).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(calls(supabase, 'remove')).toEqual([]);
  });

  it.each([500, 504])('update answered with %i: rejects and keeps both files', async (status) => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', readOld, { error: { message: 'upstream error' }, status });
    const rejected = repository.changeAvatar(PICKED);
    await expect(rejected).rejects.toThrow('upstream error');
    await expect(rejected).rejects.not.toBeInstanceOf(ServerUnreachableError);
    expect(calls(supabase, 'remove')).toEqual([]);
  });
});

describe('removeAvatar (A6)', () => {
  const clearQuery = {
    table: 'profiles',
    ops: [
      ['update', [{ avatar_id: null }]],
      ['eq', ['id', SIGNED_IN_USER_ID]],
      ['select', ['*']],
      ['single', []],
    ],
  };

  it('reads the avatar id, updates the row to null, then removes the file', async () => {
    const { supabase, local, repository } = await setup();
    supabase.respond('profiles', { data: { avatar_id: AVATAR_ID } }, { data: row({ avatar_id: null }) });

    const removed = await repository.removeAvatar();

    expect(supabase.queries[1]).toEqual(clearQuery);
    expect(supabase.sequence).toEqual(['from:profiles', 'from:profiles', 'storage.remove']);
    expect(calls(supabase, 'remove')).toEqual([{ bucket: BUCKET, method: 'remove', args: [[pathOf(AVATAR_ID)]] }]);
    expect(removed).toEqual(profileOf({ avatarId: null }));
    expect(removed.avatarUrl).toBeUndefined();
    await expect(local.cachedProfile()).resolves.toEqual(profileOf({ avatarId: null }));
  });

  it('removes no file when there was none', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: { avatar_id: null } }, { data: row({ avatar_id: null }) });
    await repository.removeAvatar();
    expect(supabase.storageCalls).toEqual([]);
  });

  it('still resolves when removing the file fails', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', { data: { avatar_id: AVATAR_ID } }, { data: row({ avatar_id: null }) });
    supabase.respondStorage('remove', { error: { message: 'boom', status: 500 } });
    await expect(repository.removeAvatar()).resolves.toEqual(profileOf({ avatarId: null }));
  });

  it('a failed update removes no file and leaves the copy', async () => {
    const { supabase, local, repository } = await setup();
    await local.cacheProfile(profileOf(), '2026-10-17T10:00:00.000Z');
    supabase.respond('profiles', { data: { avatar_id: AVATAR_ID } }, NETWORK_FAILURE);
    await expect(repository.removeAvatar()).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.storageCalls).toEqual([]);
    await expect(local.cachedProfile()).resolves.toEqual(profileOf());
  });

  it('rejects as unreachable and updates nothing when the avatar id cannot be read', async () => {
    const { supabase, repository } = await setup();
    supabase.respond('profiles', NETWORK_FAILURE);
    await expect(repository.removeAvatar()).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.queries).toHaveLength(1);
  });
});

describe('deleteAccount', () => {
  const { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } = jest.requireActual('@supabase/supabase-js');

  it('invokes delete-account with the nick as typed and nothing else, after checking the session', async () => {
    const { supabase, repository } = await setup();
    supabase.invoke.mockResolvedValueOnce({ data: { deleted: true }, error: null });

    await expect(repository.deleteAccount('kacper')).resolves.toBeUndefined();

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.invoke.mock.calls).toEqual([['delete-account', { body: { confirmUsername: 'kacper' } }]]);
  });

  it('rejects an empty nick with a ZodError before any request', async () => {
    const { supabase, repository } = await setup();
    await expect(repository.deleteAccount('')).rejects.toMatchObject({ name: 'ZodError' });
    expect(supabase.invoke).not.toHaveBeenCalled();
  });

  it('rejects as unreachable when the request gets no answer (network failure or timeout)', async () => {
    const { supabase, repository } = await setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('Network request failed')) });
    await expect(repository.deleteAccount('kacper')).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it('rejects as unreachable when the session cannot be read for lack of connection, and sends nothing', async () => {
    const { supabase, repository } = await setup();
    offlineSession(supabase);
    await expect(repository.deleteAccount('kacper')).rejects.toBeInstanceOf(ServerUnreachableError);
    expect(supabase.invoke).not.toHaveBeenCalled();
  });

  it('rejects with NotSignedInError and sends nothing when nobody is signed in', async () => {
    const { supabase, repository } = await setup();
    supabase.storedSession('none');
    await expect(repository.deleteAccount('kacper')).rejects.toBeInstanceOf(NotSignedInError);
    expect(supabase.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ['an HTTP error', () => new FunctionsHttpError({ status: 500 })],
    ['a relay error (the function did not run)', () => new FunctionsRelayError({ status: 502 })],
  ])('rejects with a plain error on %s', async (_name, make) => {
    const { supabase, repository } = await setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: make() });
    const rejected = repository.deleteAccount('kacper');
    await expect(rejected).rejects.toThrow();
    await expect(rejected).rejects.not.toBeInstanceOf(ServerUnreachableError);
  });

  it.each([
    ['no body', null],
    ['a wrong body', { deleted: false }],
    ['text', 'ok'],
  ])('rejects an answer that does not match the schema (%s)', async (_name, data) => {
    const { supabase, repository } = await setup();
    supabase.invoke.mockResolvedValueOnce({ data, error: null });
    await expect(repository.deleteAccount('kacper')).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('rejects with UsernameMismatchError on a 403 username_mismatch answer', async () => {
    const { supabase, repository } = await setup();
    const context = { status: 403, json: async () => ({ error: 'username_mismatch' }) };
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(context) });
    await expect(repository.deleteAccount('kacper')).rejects.toBeInstanceOf(UsernameMismatchError);
  });

  it.each([
    ['403 with another code', 403, async () => ({ error: 'unauthorized' })],
    ['403 with a wrong body', 403, async () => ({ nope: true })],
    ['403 with an unreadable body', 403, async () => Promise.reject(new Error('not json'))],
    ['500 with the mismatch code', 500, async () => ({ error: 'username_mismatch' })],
  ])('keeps a plain error on %s', async (_name, status, json) => {
    const { supabase, repository } = await setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError({ status, json }) });
    const rejected = repository.deleteAccount('kacper');
    await expect(rejected).rejects.toThrow();
    await expect(rejected).rejects.not.toBeInstanceOf(UsernameMismatchError);
  });
});
