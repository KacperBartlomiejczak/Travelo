# PRO subscription (RevenueCat)

Entry: the „Przejdź na PRO” banner and the „Subskrypcja” row on Settings (`/settings`); the PRO badge on „Profil”. PRO unlocks nothing yet (`prompts/revenuecat/plan.md` D1).

- **SDK setup:** `PurchasesProvider` (`src/providers/Purchases.tsx`, inside `SessionProvider` in `AppProviders`) calls `configurePurchases()` (`src/data/purchases.ts`) once per app run with `EXPO_PUBLIC_REVENUECAT_API_KEY`, validated by `RevenueCatConfigSchema` (`test_` / `appl_` / `goog_` keys only). A missing or invalid key is swallowed by the provider: everyone is non-PRO, nothing crashes.
- **Status:** `useIsPro()` = an active `travelo_pro` entitlement (`hasPro` in `src/lib/pro.ts`) on the RevenueCat `CustomerInfo`. The status lives only in the app (no server copy, no webhook, D1).
- **Identity** (Z1, D5): the session's Supabase user id is the RevenueCat app user id.
  - signed in with a user id: if the SDK already holds that user (`Purchases.getAppUserID()`), its cached `getCustomerInfo()` status shows at once (works offline) and `logIn(userId)` refreshes it; a failed `logIn` keeps it. Another user in the SDK → not PRO until `logIn` answers.
  - signed in without a user id (offline start): the SDK's cached status, but the identity is not confirmed (D7). Once a token refresh gives the session its user id, the path above runs.
  - signed out (also at launch): not PRO, `Purchases.logOut()` (an anonymous-user rejection is ignored).
  - Every SDK answer belongs to the session (status + user id) it started for and is dropped once the session has changed; customer-info listener updates count only while signed in with a confirmed identity or on an offline start.
- **Paywall:** non-PRO users see the banner; a tap calls `RevenueCatUI.presentPaywall()` for the current offering (offering, packages and paywall are set in the RevenueCat dashboard; the app knows only `travelo_pro`). `ERROR` or a rejection → `Snackbar` `settings.pro.error`; other results show nothing, the listener updates the status. A second tap while it is open is ignored. The banner is disabled (and a tap opens nothing) until `useIsProIdentityConfirmed()` is true, i.e. the SDK user is confirmed to match the session user (same SDK user or a successful `logIn`; an offline start does not count, D7) — so a purchase can never be credited to a previous account left in the SDK (D6).
- **Customer Center:** PRO users see „Subskrypcja” (first row of the first card) instead of the banner; a tap calls `RevenueCatUI.presentCustomerCenter()`; a rejection → `settings.subscription.error`. Like the banner, the row is disabled (and a tap opens nothing) until `useIsProIdentityConfirmed()` is true, so Customer Center never manages a previous account left in the SDK (P6); no reason text for this case (Z8).
- **Offline:** banner and row are disabled with a reason under them (D3); the badge still shows from the SDK cache.
- **Tests:** `react-native-purchases` and `react-native-purchases-ui` are mocked globally (`src/test/mock-purchases.ts`, reset after each test in `jest.setup.ts`).

Plan and decisions: `prompts/revenuecat/plan.md`.
