// Account deletion logic (prompts/profile-settings/plan.md, step 3). No Deno globals and no Supabase client here:
// everything outside goes through `AccountPorts`, so Jest tests it with a fake. index.ts wires the real ones.
import { DeleteAccountInputSchema } from '../../../src/schemas/account.ts';
import type { DeleteAccountError, DeleteAccountResult } from '../../../src/schemas/account.ts';

const TRIP_BUCKET = 'trip-photos';
const AVATAR_BUCKET = 'avatars';
const BATCH_SIZE = 1000;

export type AuthResult =
  | { kind: 'user'; id: string }
  // A validly signed token whose user no longer exists: the earlier call already deleted the account.
  | { kind: 'gone'; id: string }
  | { kind: 'invalid' };

/** Every port throws on an unexpected failure. */
export interface AccountPorts {
  authenticate(jwt: string): Promise<AuthResult>;
  getUsername(userId: string): Promise<string | null>;
  ownedTripIds(userId: string): Promise<string[]>;
  listFolder(bucket: string, folder: string, offset: number, limit: number): Promise<string[]>;
  removeFiles(bucket: string, paths: string[]): Promise<void>;
  deleteUser(userId: string): Promise<'deleted' | 'not_found'>;
}

export interface DeleteAccountRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface DeleteAccountResponse {
  status: number;
  body: DeleteAccountResult | DeleteAccountError;
}

const fail = (status: number, error: DeleteAccountError['error']): DeleteAccountResponse => ({
  status,
  body: { error },
});

/** Removes every file directly in the folder. All names are read before any is removed, since removing shifts offsets. */
async function emptyFolder(ports: AccountPorts, bucket: string, folder: string): Promise<void> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const names = await ports.listFolder(bucket, folder, offset, BATCH_SIZE);
    paths.push(...names.map((name) => `${folder}/${name}`));
    if (names.length < BATCH_SIZE) break;
  }
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    await ports.removeFiles(bucket, paths.slice(i, i + BATCH_SIZE));
  }
}

export async function handleDeleteAccount(
  { method, authorization, body }: DeleteAccountRequest,
  ports: AccountPorts,
): Promise<DeleteAccountResponse> {
  if (method !== 'POST') return fail(405, 'invalid_input');
  const jwt = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (!jwt) return fail(401, 'unauthorized');
  let auth: AuthResult;
  try {
    auth = await ports.authenticate(jwt);
  } catch {
    return fail(500, 'auth_failed');
  }
  if (auth.kind === 'invalid') return fail(401, 'unauthorized');
  if (auth.kind === 'gone') {
    // A retry after a lost response: the account is gone, so only sweep what a late upload may have left. Nothing else.
    try {
      await emptyFolder(ports, AVATAR_BUCKET, auth.id);
    } catch {
      // Ignored on purpose, see above.
    }
    return { status: 200, body: { deleted: true } };
  }

  const input = DeleteAccountInputSchema.safeParse(body);
  if (!input.success) return fail(400, 'invalid_input');

  // The user id comes from the token alone, never from the body.
  const userId = auth.id;
  let folders: Array<[string, string]>;
  try {
    const username = await ports.getUsername(userId);
    if (username === null || username.toLowerCase() !== input.data.confirmUsername.trim().toLowerCase()) {
      return fail(403, 'username_mismatch');
    }
    const tripIds = await ports.ownedTripIds(userId);
    folders = [...tripIds.map((id): [string, string] => [TRIP_BUCKET, id]), [AVATAR_BUCKET, userId]];
    // Files first: Storage refuses to delete a user who still owns objects.
    for (const [bucket, folder] of folders) await emptyFolder(ports, bucket, folder);
  } catch {
    return fail(500, 'storage_failed');
  }

  try {
    await ports.deleteUser(userId); // 'not_found' means a retry finished earlier work: also a success.
  } catch {
    return fail(500, 'auth_failed');
  }

  // A file uploaded from another device while we worked would otherwise stay orphaned. Best effort.
  for (const [bucket, folder] of folders) {
    try {
      await emptyFolder(ports, bucket, folder);
    } catch {
      // Ignored on purpose, the account is already gone.
    }
  }
  return { status: 200, body: { deleted: true } };
}
