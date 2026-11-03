# Friend invite (friend code)

Entry: the friends step of the create-trip wizard.

- **Friend lookup** (friend-invite, `ProfileRepository.findByFriendCode`): `FriendCodeInputSchema` first (an invalid code rejects with `ZodError` before any request) → `signedIn()` → `rpc('find_profile_by_friend_code', { code })` → `FoundFriendSchema.array().max(1)` → the friend or `null`. Unreachable → `ServerUnreachableError`. `useFriendLookup(code)` (query key `['friend-lookup', code]`, `retry: false`, `gcTime: 0`, `networkMode: 'always'`) asks once per code.
