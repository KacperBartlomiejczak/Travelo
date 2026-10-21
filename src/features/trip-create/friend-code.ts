import { ServerUnreachableError } from '@/data/errors';
import { FRIEND_CODE_LENGTH, FriendCodeInputSchema, type FoundFriend } from '@/schemas';

/** What a friend card's code field is doing (friend-invite D5, D7, D13). */
export type CodeStatus =
  | 'empty'
  | 'incomplete'
  | 'unknown'
  | 'own'
  | 'duplicate'
  | 'offline'
  | 'checking'
  | 'unreachable'
  | 'failed'
  | 'found';

/** The part of a `useFriendLookup` result the status needs. */
export type CodeLookup = { data: FoundFriend | null | undefined; error: unknown; isError: boolean };

type Input = {
  /** The code as typed. */
  text: string;
  /** The card already holds a friend found by its code. */
  linked: boolean;
  offline: boolean;
  /** The organizer's own friend code; undefined while the profile is not known. */
  ownCode: string | undefined;
  /** Codes already found in the other cards. */
  takenCodes: readonly string[];
  /** The answer of the server; leave out to ask only what the phone can decide itself. */
  lookup?: CodeLookup;
};

/**
 * The status of a card's code field, and the normalised `code` when the text is a possible friend code (else null).
 * What the phone can decide comes first, in this order: found, offline, empty, short, not a possible code, own, duplicate.
 * A plain new code is `checking`: that is the only case that asks the server, so without `lookup` it tells the caller
 * to look it up, and with `lookup` it becomes the answer. Look-alike letters and nobody having the code are both `unknown`.
 */
export function friendCodeStatus({ text, linked, offline, ownCode, takenCodes, lookup }: Input): { status: CodeStatus; code: string | null } {
  const trimmed = text.trim();
  const parsed = FriendCodeInputSchema.safeParse(trimmed);
  const code = parsed.success ? parsed.data : null;
  return { status: statusOf(), code };

  function statusOf(): CodeStatus {
    if (linked) return 'found';
    if (offline) return 'offline';
    if (trimmed === '') return 'empty';
    if (trimmed.length < FRIEND_CODE_LENGTH) return 'incomplete';
    if (code === null) return 'unknown';
    if (code === ownCode) return 'own';
    if (takenCodes.includes(code)) return 'duplicate';
    if (!lookup) return 'checking';
    if (lookup.isError) return lookup.error instanceof ServerUnreachableError ? 'unreachable' : 'failed';
    if (lookup.data === undefined) return 'checking';
    return lookup.data === null ? 'unknown' : 'found';
  }
}
