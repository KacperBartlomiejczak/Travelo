/** Supabase could not be reached (no connection or no answer in time); a copy on the device may be shown instead. */
export class ServerUnreachableError extends Error {}

/** `create_trip` refused a friend code that is the organizer's own (SQLSTATE `FI001`, friend-invite D12). */
export class OwnFriendCodeError extends Error {}

/** `create_trip` refused a friend code no account has (SQLSTATE `FI002`, friend-invite D12). */
export class UnknownFriendCodeError extends Error {}

/** `create_trip` refused the same friend twice in one trip (unique violation `trip_members_trip_user_key`, friend-invite D12). */
export class FriendAlreadyAddedError extends Error {}
