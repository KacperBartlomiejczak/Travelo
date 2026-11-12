# Sign-in, sign-out and gate flow

- Sign-in and gate (auth-onboarding):
  - **Session** (`SessionProvider` over `SessionSource`):
    - `current()` first signs out locally any leftover anonymous session (D2). Then it reads the stored session: none → `signedOut`; a user → `signedIn`.
    - When the token cannot be refreshed offline → `signedIn` with `userId: null`.
    - `onChange` maps `SIGNED_IN` / `SIGNED_OUT`, and `TOKEN_REFRESHED` to a separate `refreshed` change. `refreshed` only fills in the `userId` of a `signedIn` session that has none (offline start); in every other state it does nothing and never clears (revenuecat D7). auth-js sends it within about 30–60 s after the network returns, only while the app is in the foreground. It is deferred with `setTimeout`, because of Supabase's deadlock warning about calling the client inside its callback.
  - **Leaving (D14).** Every path to `signedOut` goes through `leave()`:
    1. close the user epoch;
    2. `clearUserData()`;
    3. clear the query cache;
    4. then `signedOut`.
    - A failed clear shows "Spróbuj ponownie", never the welcome screen. A `SIGNED_IN` arriving in any state other than `signedOut` clears first.
    - After a sign-in, the budget sync and the trip / profile refetch run.
  - **Sign-out button (profile-screen D16, A7).** `useSession().signOut` → `SessionSource.signOut()` → `auth.signOut({ scope: 'local' })`. On success auth-js fires `SIGNED_OUT` and the app leaves through `leave()` as above. On a failed request auth-js still removes the stored session and fires `SIGNED_OUT`, then returns the error; the source throws it, `useSignOut` swallows it, and Settings shows no error (the gate moves to the welcome screen anyway). Unsent budget changes are erased with the user data; the dialog warns first.
  - **Background check (D22, D23).** After the gate opens `signedIn` with a known user, `checkStoredSession()` runs once per start, never awaited:
    1. it captures the stored session's user id and token, then calls `getUser(token)` (`GET /user`, a network call) on `sessionCheckSupabase`, a separate client that stores nothing, so whatever auth-js does on that client never touches the app's stored session (coderabbit-pr21-fixes A1). Not `getClaims`: with the `crypto.subtle` polyfill it would try a local JWT check with `importKey` / `verify`, which the polyfill does not have (pkce-sha256);
    2. `session_not_found` (the session is gone) or `user_not_found` (a deleted account): the app calls `signOut({ scope: 'local' })` on the app client, but only if the stored session still has the same user id;
    3. every other result, including offline, changes nothing.
  - **Gate** (`useGateView` + `Stack.Protected` in the root layout):
    - session unknown, or signed in with the profile unknown → the animated splash stays (splash-animation; spinner under the logo once the animation has ended);
    - `signedOut` → the `(auth)` group;
    - signed in, no profile → `onboarding`;
    - signed in with a profile → the app;
    - a failed session or profile read → a full-screen error with a retry (never the setup form).
  - **OAuth** (`signInWithProvider`, Google or Discord):
    1. `signInWithOAuth({ provider, redirectTo, skipBrowserRedirect: true })`;
    2. `WebBrowser.openAuthSessionAsync(url, redirectTo)`;
    3. only `code` / `error` are read from the returned URL;
    4. `exchangeCodeForSession(code)`.
    - `cancel` / `dismiss` → `'cancelled'`. `redirectTo` = `Linking.createURL('auth/callback')`.
    - The sheet shows fixed copy per provider, never the error's message.
  - **E-mail code:**
    - `sendEmailCode`: `signInWithOtp`, `shouldCreateUser: true`;
    - `verifyEmailCode`: `verifyOtp`, `type: 'email'`; `otp_expired` → `InvalidCodeError`; retryable → `ServerUnreachableError`.
    - The address lives in `EmailSignInContext` in the `(auth)` layout, never in the URL.
    - The code screen sends the code on the 6th digit. The resend is available after 60 s.
  - **Local store safety (D15).** expo-sqlite does not keep the order of async calls, so `createLocalStore` runs every method through one serial JS queue. The user epoch is captured at the start of each repository operation. The six writes that add user data are refused unless that epoch is still current, so nothing of a signed-out user is written after the clear.
