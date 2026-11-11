import { DeleteAccountErrorSchema, DeleteAccountResultSchema } from '../../../../src/schemas/account';
import { handleDeleteAccount, type AccountPorts } from '../handler';

const USER = 'user-1';
const TRIPS = ['trip-a', 'trip-b'];

type Call = string;

/** A fake of the ports with its folders in memory; every call is logged in order. */
function makePorts(overrides: Partial<AccountPorts> = {}, files: Record<string, string[]> = {}) {
  const calls: Call[] = [];
  const folders: Record<string, string[]> = {
    'trip-photos/trip-a': ['a1.jpg', 'a1_thumb.jpg'],
    'trip-photos/trip-b': ['b1.jpg'],
    [`avatars/${USER}`]: ['av1.jpg'],
    ...files,
  };
  const ports: AccountPorts = {
    authenticate: async () => {
      calls.push('authenticate');
      return { kind: 'user', id: USER };
    },
    getUsername: async () => {
      calls.push('getUsername');
      return 'kasia';
    },
    ownedTripIds: async () => {
      calls.push('ownedTripIds');
      return TRIPS;
    },
    listFolder: async (bucket, folder, offset, limit) => {
      calls.push(`list:${bucket}/${folder}@${offset}`);
      return (folders[`${bucket}/${folder}`] ?? []).slice(offset, offset + limit);
    },
    removeFiles: async (bucket, paths) => {
      calls.push(`remove:${bucket}:${paths.length}`);
      for (const path of paths) {
        const slash = path.lastIndexOf('/');
        const key = `${bucket}/${path.slice(0, slash)}`;
        folders[key] = (folders[key] ?? []).filter((name) => name !== path.slice(slash + 1));
      }
    },
    deleteUser: async () => {
      calls.push('deleteUser');
      return 'deleted';
    },
    ...overrides,
  };
  return { ports, calls, folders };
}

const request = (body: unknown = { confirmUsername: 'kasia' }, authorization: string | null = 'Bearer jwt') => ({
  method: 'POST',
  authorization,
  body,
});
const requestWith = (body: unknown) => ({ method: 'POST', authorization: 'Bearer jwt', body });

const deleted = (calls: Call[]) => calls.filter((call) => call.startsWith('remove') || call === 'deleteUser');

describe('delete-account handler', () => {
  it('deletes files, then the user, and answers with a schema-valid result', async () => {
    const { ports, calls, folders } = makePorts();
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(200);
    expect(DeleteAccountResultSchema.parse(res.body)).toEqual({ deleted: true });
    expect(Object.values(folders).every((names) => names.length === 0)).toBe(true);
    // Every file removal comes before deleteUser (Storage blocks deleting an owner of objects).
    const userAt = calls.indexOf('deleteUser');
    expect(calls.slice(0, userAt).filter((c) => c.startsWith('remove'))).toHaveLength(3);
  });

  it('removes trip photos before avatars', async () => {
    const { ports, calls } = makePorts();
    await handleDeleteAccount(request(), ports);
    const first = calls.findIndex((c) => c.startsWith('list:avatars'));
    const last = calls.findLastIndex((c, i) => i < calls.indexOf('deleteUser') && c.startsWith('list:trip-photos'));
    expect(calls.findIndex((c) => c.startsWith('list:trip-photos'))).toBeLessThan(first);
    expect(last).toBeLessThan(first);
    expect(first).toBeLessThan(calls.indexOf('deleteUser'));
  });

  it.each([null, '', 'Basic abc', 'Bearer '])('answers 401 and deletes nothing for authorization %p', async (header) => {
    const { ports, calls } = makePorts({
      authenticate: async () => {
        throw new Error('must not be called without a bearer token');
      },
    });
    const res = await handleDeleteAccount(request(undefined, header), ports);
    expect(res.status).toBe(401);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'unauthorized' });
    expect(deleted(calls)).toEqual([]);
  });

  it('answers 401 for a token the auth server rejects', async () => {
    const { ports, calls } = makePorts({ authenticate: async () => ({ kind: 'invalid' }) });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(401);
    expect(deleted(calls)).toEqual([]);
  });

  it('answers 500 auth_failed when the auth server cannot be reached', async () => {
    const { ports, calls } = makePorts({
      authenticate: async () => {
        throw new Error('network');
      },
    });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(500);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'auth_failed' });
    expect(deleted(calls)).toEqual([]);
  });

  it.each([undefined, null, {}, { confirmUsername: '' }, { confirmUsername: 5 }, { confirmUsername: 'x'.repeat(65) }])(
    'answers 400 and deletes nothing for body %p',
    async (body) => {
      const { ports, calls } = makePorts();
      const res = await handleDeleteAccount(requestWith(body), ports);
      expect(res.status).toBe(400);
      expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'invalid_input' });
      expect(deleted(calls)).toEqual([]);
    },
  );

  it('answers 403 and deletes nothing when the username does not match', async () => {
    const { ports, calls } = makePorts();
    const res = await handleDeleteAccount(request({ confirmUsername: 'ktos_inny' }), ports);
    expect(res.status).toBe(403);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'username_mismatch' });
    expect(deleted(calls)).toEqual([]);
  });

  it('answers 403 when the user has no profile', async () => {
    const { ports, calls } = makePorts({ getUsername: async () => null });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(403);
    expect(deleted(calls)).toEqual([]);
  });

  it('ignores case and surrounding spaces when comparing the username', async () => {
    const { ports } = makePorts();
    const res = await handleDeleteAccount(request({ confirmUsername: '  KaSia ' }), ports);
    expect(res.status).toBe(200);
  });

  it('takes the user id from the token only, ignoring ids in the body', async () => {
    const seen: string[] = [];
    const { ports } = makePorts({
      getUsername: async (id) => {
        seen.push(`username:${id}`);
        return 'kasia';
      },
      ownedTripIds: async (id) => {
        seen.push(`trips:${id}`);
        return [];
      },
      deleteUser: async (id) => {
        seen.push(`delete:${id}`);
        return 'deleted';
      },
    });
    await handleDeleteAccount(request({ confirmUsername: 'kasia', userId: 'victim', id: 'victim' }), ports);
    expect(seen).toEqual([`username:${USER}`, `trips:${USER}`, `delete:${USER}`]);
  });

  it('lists a folder by pages and removes in batches of 1000', async () => {
    const names = Array.from({ length: 2500 }, (_, i) => `f${i}.jpg`);
    const { ports, calls } = makePorts({ ownedTripIds: async () => ['big'] }, { 'trip-photos/big': names });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.startsWith('list:trip-photos/big'))).toEqual([
      'list:trip-photos/big@0',
      'list:trip-photos/big@1000',
      'list:trip-photos/big@2000',
      // second, quiet pass
      'list:trip-photos/big@0',
    ]);
    expect(calls.filter((c) => c.startsWith('remove:trip-photos'))).toEqual([
      'remove:trip-photos:1000',
      'remove:trip-photos:1000',
      'remove:trip-photos:500',
    ]);
  });

  it('lists the next page when the first one is exactly full', async () => {
    const names = Array.from({ length: 1000 }, (_, i) => `f${i}.jpg`);
    const { ports, calls } = makePorts({ ownedTripIds: async () => ['full'] }, { 'trip-photos/full': names });
    await handleDeleteAccount(request(), ports);
    expect(calls).toContain('list:trip-photos/full@1000');
  });

  it('answers 500 storage_failed and does not call deleteUser when listing fails', async () => {
    const { ports, calls } = makePorts({
      listFolder: async () => {
        throw new Error('storage down');
      },
    });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(500);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'storage_failed' });
    expect(calls).not.toContain('deleteUser');
  });

  it('answers 500 storage_failed and does not call deleteUser when removing fails', async () => {
    const { ports, calls } = makePorts({
      removeFiles: async () => {
        throw new Error('storage down');
      },
    });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(500);
    expect(calls).not.toContain('deleteUser');
  });

  it('answers 500 storage_failed when reading the owned trips fails', async () => {
    const { ports, calls } = makePorts({
      ownedTripIds: async () => {
        throw new Error('db down');
      },
    });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(500);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'storage_failed' });
    expect(calls).not.toContain('deleteUser');
  });

  it('answers 500 auth_failed when deleteUser fails', async () => {
    const { ports } = makePorts({
      deleteUser: async () => {
        throw new Error('auth down');
      },
    });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(500);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'auth_failed' });
  });

  it('finishes the work when retried after a partial failure', async () => {
    let failOnce = true;
    const { ports, folders } = makePorts();
    const original = ports.removeFiles;
    ports.removeFiles = async (bucket, paths) => {
      if (bucket === 'avatars' && failOnce) {
        failOnce = false;
        throw new Error('flaky');
      }
      return original(bucket, paths);
    };
    expect((await handleDeleteAccount(request(), ports)).status).toBe(500);
    // Trip photos are already gone, the avatar is not.
    expect(folders['trip-photos/trip-a']).toEqual([]);
    expect(folders[`avatars/${USER}`]).toEqual(['av1.jpg']);
    expect((await handleDeleteAccount(request(), ports)).status).toBe(200);
    expect(folders[`avatars/${USER}`]).toEqual([]);
  });

  it('answers 200 when the user is already gone and only sweeps their avatar folder', async () => {
    const { ports, calls, folders } = makePorts({ authenticate: async () => ({ kind: 'gone', id: USER }) });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(200);
    expect(DeleteAccountResultSchema.parse(res.body)).toEqual({ deleted: true });
    expect(calls).not.toContain('deleteUser');
    expect(calls.filter((c) => c.startsWith('list:') || c.startsWith('remove:'))).toEqual([
      `list:avatars/${USER}@0`,
      'remove:avatars:1',
    ]);
    expect(folders[`avatars/${USER}`]).toEqual([]);
    expect(folders['trip-photos/trip-a']).toHaveLength(2);
  });

  it('still answers 200 for a gone user when the avatar sweep fails', async () => {
    const { ports } = makePorts({
      authenticate: async () => ({ kind: 'gone', id: USER }),
      listFolder: async () => {
        throw new Error('storage down');
      },
    });
    expect((await handleDeleteAccount(request(), ports)).status).toBe(200);
  });

  it.each(['GET', 'PUT', 'DELETE', 'OPTIONS'])('answers 405 invalid_input and does nothing for %s', async (method) => {
    const { ports, calls } = makePorts();
    const res = await handleDeleteAccount({ ...request(), method }, ports);
    expect(res.status).toBe(405);
    expect(DeleteAccountErrorSchema.parse(res.body)).toEqual({ error: 'invalid_input' });
    expect(calls).toEqual([]);
  });

  it('answers 200 when deleteUser reports the user is not found', async () => {
    const { ports } = makePorts({ deleteUser: async () => 'not_found' });
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(200);
  });

  it('still succeeds when the second, quiet pass fails', async () => {
    const { ports, calls } = makePorts();
    const list = ports.listFolder;
    ports.listFolder = async (...args) => {
      if (calls.includes('deleteUser')) throw new Error('late failure');
      return list(...args);
    };
    const res = await handleDeleteAccount(request(), ports);
    expect(res.status).toBe(200);
  });

  it('sweeps the same folders again after the user is deleted', async () => {
    const { ports, calls } = makePorts();
    await handleDeleteAccount(request(), ports);
    const after = calls.slice(calls.indexOf('deleteUser') + 1);
    expect(after).toEqual([
      'list:trip-photos/trip-a@0',
      'list:trip-photos/trip-b@0',
      `list:avatars/${USER}@0`,
    ]);
  });
});
