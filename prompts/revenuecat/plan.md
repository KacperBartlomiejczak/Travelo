# Zadanie: Subskrypcja PRO przez RevenueCat (revenuecat)
Status: w trakcie (kroki 6–7 zrobione; krok 5: zostaje sprawdzenie na telefonie; kroki 8–9 w trakcie)

Akceptacja: Kacper, 2026-11-11, „Akceptuję” (na pytanie o plan z P1 = gałąź od `fix/profile-pro-badge`). Kroki 6–7 (D6, Z6–Z8, P5 = bez tekstu): Kacper, 2026-11-12, „Akceptuję”. Kroki 8–9 (D7, Z9–Z10): Kacper, 2026-11-12, „Akceptuję”.

Gałąź: `feature/revenuecat`, odgałęziona od `fix/profile-pro-badge` (P1); jedyna gałąź zadania.

## Zrozumienie i założenia

Travelo dostaje prawdziwą subskrypcję PRO przez RevenueCat (`react-native-purchases` + `react-native-purchases-ui`). Status PRO = aktywne uprawnienie (entitlement) `travelo_pro`. Produkty: `monthly` i `yearly` w jednej ofercie (offering) z paywallem RevenueCat. „Zrobione” = odznaka PRO i baner w Ustawieniach pokazują prawdziwy status, baner otwiera paywall, PRO ma wiersz „Subskrypcja” z Customer Center, cały zestaw testów, `pnpm typecheck` i `pnpm lint` są zielone, a na emulatorze (dev build) da się kupić PRO w Test Store.

### Decyzje Kacpra (2026-11-11) — nie pytamy ponownie
- **D1. Zakres = infrastruktura.** SDK, logowanie użytkownika do RevenueCat, prawdziwy status `travelo_pro` zamiast stałej `IS_PRO`, baner „Przejdź na PRO” otwiera paywall i znika dla PRO, Customer Center dla PRO. **Żadna funkcja nie jest blokowana** dla kont bez PRO (to osobne zadanie). Bez statusu PRO po stronie serwera (bez webhooka, migracji, RLS).
- **D2. Customer Center = wiersz w Ustawieniach.** Dla PRO baner znika, a w pierwszej karcie wierszy pojawia się „Subskrypcja” → otwiera Customer Center.
- **D3. Offline:** baner i wiersz „Subskrypcja” są wyłączone z powodem pod spodem (jak „Wyloguj się”). Status PRO (odznaka) działa offline z pamięci podręcznej SDK RevenueCat.
- **D5 (P2, 2026-11-11, po zablokowaniu kroku 2).** Gdy `userId` jest znany, a SDK ma już zalogowanego tego samego użytkownika (`Purchases.getAppUserID() === userId`), od razu pokazujemy jego status z pamięci SDK (`getCustomerInfo`, działa offline); `logIn` tylko go odświeża, a jego błąd nie kasuje statusu. Inny użytkownik w SDK → „bez PRO” do odpowiedzi `logIn`.
- **D6 (2026-11-12, po uwadze Major od CodeRabbit w PR #39).** Paywall jest zablokowany, dopóki tożsamość w SDK nie jest potwierdzona (użytkownik SDK = użytkownik sesji). Powód: gdy `logOut` przy wylogowaniu A i `logIn(B)` po zalogowaniu B oba się nie udadzą (błędy są dziś połykane), SDK zostaje na koncie A i zakup B trafia na A. Świadomie zmienia D3 / `known-limitations.md:116`: baner jest też wyłączony przez krótką chwilę, póki trwa `logIn` świeżo zalogowanego użytkownika.
- **D7 (2026-11-12, po odpowiedzi CodeRabbit w wątku D6 w PR #39; Kacper: „Tak, dopisz krok”).** Start offline (`userId = null`) **nie** liczy się już jako potwierdzona tożsamość — zastępuje Z6. Po powrocie sieci sesja ma poznać `userId`, a provider przejść zwykłą ścieżkę z porównaniem i `logIn`. Odznaka PRO offline zostaje bez zmian (D3).
- **D4. Klucz:** zmienna `EXPO_PUBLIC_REVENUECAT_API_KEY` (Kacper zmienia nazwę w `.env`; ja dopisuję samą nazwę do `.env.example`). To publiczny klucz SDK, więc może być w aplikacji.

### Co ustaliłem w kodzie (fakty)
- PRO to dziś stała `IS_PRO = true` (`src/features/profile/ProBadge.tsx:9-10`), jedyny odbiorca `<ProBadge />` w `ProfileScreen.tsx:123`. Baner PRO w `SettingsScreen.tsx:92-93`, tap → Snackbar `settings.pro.comingSoon` (`:275`).
- Sesja: `useSession()` daje `signedIn { userId: string | null }` (`null` po starcie offline). Wylogowanie czyści dane w `leave()` (`src/providers/Session.tsx:101-121`).
- Wzorzec konfiguracji: `src/data/supabase.ts` + `SupabaseConfigSchema` (Zod na statycznym `process.env.EXPO_PUBLIC_*`).
- Offline: `useIsOffline()` (`src/providers/BudgetSync.tsx:12-15`).
- `expo-dev-client` nie jest zainstalowany; `android/` i `ios/` są generowane (CNG). Moduł natywny wymaga dev buildu (`npx expo run:android`), Expo Go nie wystarczy.
- Dokumentacja RevenueCat (sprawdzona 2026-11-11): instalacja w Expo przez `npx expo install react-native-purchases react-native-purchases-ui`, potem pełny build natywny; paywall `RevenueCatUI.presentPaywall()` zwraca `PAYWALL_RESULT` (`PURCHASED` / `RESTORED` / `CANCELLED` / `ERROR` / `NOT_PRESENTED`); Customer Center `RevenueCatUI.presentCustomerCenter()`.

### Założenia (potwierdzasz akceptacją planu)
- Z1. **Tożsamość:** `Purchases.configure({ apiKey })` raz przy starcie, potem `Purchases.logIn(userId)` z id użytkownika Supabase po zalogowaniu i `Purchases.logOut()` przy wylogowaniu. Dzięki temu PRO idzie za kontem, a nie za telefonem. Po starcie offline (`userId = null`) nie wołamy `logIn`; SDK pamięta ostatniego użytkownika i jego status.
- Z2. **Bez Zod na obiektach SDK.** `CustomerInfo` to typowany obiekt natywnego SDK, nie surowy JSON; czytamy z niego jedno pole (`entitlements.active.travelo_pro`). Zod waliduje tylko klucz z env (granica konfiguracji).
- Z3. **Bez `expo-dev-client`.** Budujemy dev build jak dotąd przez `npx expo run:android`; `expo-dev-client` dałby tylko menu deweloperskie. Dodamy, jeśli zechcesz.
- Z4. **Produkty, uprawnienie, oferta i paywall konfigurujesz Ty w panelu RevenueCat** (patrz „Konfiguracja panelu”), kod nie zna identyfikatorów `monthly` / `yearly` — paywall pokazuje bieżącą ofertę. Kod zna tylko `travelo_pro`.
- Z5. Po zakupie / przywróceniu status odświeża się sam przez `Purchases.addCustomerInfoUpdateListener`; nie pokazujemy osobnego komunikatu sukcesu (odznaka i wiersz „Subskrypcja” zmieniają się od razu). Anulowanie paywalla nic nie pokazuje.

## Podejście

Cienka warstwa nad SDK, bez własnego ekranu oferty:
1. `src/data/purchases.ts` — konfiguracja SDK z kluczem z env (Zod), `logIn` / `logOut`, odczyt `CustomerInfo` i nasłuch zmian. W testach podmieniane globalnym mockiem `react-native-purchases` w `jest.setup.ts` (wzorzec jak `expo-network` → `src/test/mock-network.ts`).
2. `src/lib/pro.ts` — czysta funkcja `hasPro(customerInfo)` + stała `PRO_ENTITLEMENT = 'travelo_pro'`.
3. `src/providers/Purchases.tsx` — `PurchasesProvider` (wewnątrz `SessionProvider`) synchronizuje tożsamość z sesją i trzyma status; hook `useIsPro()` (`boolean`, `false` póki status nieznany).
4. UI: `ProBadge` czyta `useIsPro()`; Ustawienia pokazują baner (bez PRO) albo wiersz „Subskrypcja” (PRO), oba otwierają odpowiednie ekrany RevenueCatUI.

Odrzucone: własny ekran oferty z `getOfferings()` / `purchasePackage()` — więcej kodu i UI do utrzymania, a paywall RevenueCat robi to samo i da się go zmieniać z panelu bez wydania aplikacji. Webhook RevenueCat → Supabase — niepotrzebny, dopóki serwer niczego nie blokuje dla PRO (D1).

## Struktury danych (Zod)
- `src/schemas/revenuecat-config.ts`: `RevenueCatConfigSchema = z.object({ apiKey: z.string().regex(/^(test|appl|goog)_\w+$/) })`, typ przez `z.infer`. Brak lub zły klucz → błąd z samą nazwą zmiennej (jak w `supabase.ts`).
- Bez zmian w bazie, migracji i typach Supabase.

## Testy (najpierw, red przed green)
- `src/schemas/__tests__/revenuecat-config.test.ts` — klucz `test_…` / `appl_…` / `goog_…` przechodzi; pusty, bez prefiksu, `sb_publishable_…` odrzucony.
- `src/lib/__tests__/pro.test.ts` — `hasPro`: aktywne `travelo_pro` → true; brak, inne uprawnienie, wygasłe (nieaktywne) → false.
- `src/data/__tests__/purchases.test.ts` — `configure` wołane raz z kluczem z env; brak env → czytelny błąd bez wartości.
- `src/providers/__tests__/Purchases.test.tsx` — zalogowanie z `userId` → `logIn(userId)`; wylogowanie → `logOut()`; `userId = null` → bez `logIn`; zdarzenie nasłuchu z aktywnym `travelo_pro` → `useIsPro()` = true; błąd SDK → `useIsPro()` = false, bez wywrotki aplikacji.
- `ProBadge.test.tsx` — odznaka widoczna dla PRO, ukryta bez PRO (zamiast stałej).
- `SettingsScreen.test.tsx` — bez PRO: baner widoczny, tap → `presentPaywall`; PRO: banera brak, wiersz „Subskrypcja” w karcie A, tap → `presentCustomerCenter`; offline: oba wyłączone z powodem; `PAYWALL_RESULT.ERROR` / odrzucony `presentCustomerCenter` → Snackbar z błędem; oba języki.
- Testy, które dziś zakładają „baner dla każdego” / „Wkrótce”, zmieniają się zgodnie z D1–D3 (zmiana wymagań, nie osłabianie testów).

## Teksty (i18n, pl / en) — do akceptacji
| Klucz | pl | en |
|---|---|---|
| `settings.pro.offline` | „Połącz się z internetem, żeby przejść na PRO.” | “Connect to the internet to go PRO.” |
| `settings.pro.error` | „Nie udało się otworzyć oferty. Spróbuj ponownie.” | “Couldn't open the offer. Try again.” |
| `settings.subscription.title` | „Subskrypcja” | “Subscription” |
| `settings.subscription.offline` | „Połącz się z internetem, żeby zarządzać subskrypcją.” | “Connect to the internet to manage your subscription.” |
| `settings.subscription.error` | „Nie udało się otworzyć subskrypcji. Spróbuj ponownie.” | “Couldn't open your subscription. Try again.” |

Klucz `settings.pro.comingSoon` znika. `settings.pro.title` / `subtitle` zostają.

## Pliki
- Nowe: `src/schemas/revenuecat-config.ts`, `src/data/purchases.ts`, `src/lib/pro.ts`, `src/providers/Purchases.tsx`, `src/test/mock-purchases.ts` (+ testy powyżej).
- Zmienione: `package.json`, `pnpm-lock.yaml` (2 zależności), `app.json` (tylko jeśli SDK wymaga pluginu — według dokumentacji nie), `.env.example`, `jest.setup.ts`, `src/schemas/index.ts`, `src/providers/AppProviders.tsx`, `src/features/profile/ProBadge.tsx`, `src/features/profile/SettingsScreen.tsx`, `src/i18n/locales/{pl,en}.json`, odpowiednie testy.
- Dokumenty: `docs/architecture/{overview,frontend,backend,decisions,known-limitations}.md`, `docs/development/commands.md` (dev build), `context/app-context.md` (3.9, roadmapa).

## Skille
- `test-driven-development` — kroki 1–4 — red → green.
- `source-driven-development` — kroki 1–2 — API RevenueCat tylko z aktualnej dokumentacji.
- `frontend-ui-engineering` — kroki 3–4 — stany offline / błędu, dostępność.

## Kroki
- [x] 1. [backend] Instalacja `npx expo install react-native-purchases react-native-purchases-ui` (Kacper już się zgodził w prośbie); `RevenueCatConfigSchema`, `src/lib/pro.ts`, `src/data/purchases.ts`, globalny mock w `jest.setup.ts` + `src/test/mock-purchases.ts`, `.env.example`. — skill: test-driven-development, source-driven-development — najpierw testy: schemat, `hasPro`, `purchases.ts` — weryfikacja: verifier + pełny zestaw, typecheck, lint.
- [x] 2. [backend] `src/providers/Purchases.tsx` (`PurchasesProvider`, `useIsPro`) i wpięcie w `AppProviders.tsx` wewnątrz `SessionProvider`. — skill: test-driven-development — najpierw testy: `Purchases.test.tsx` — weryfikacja: verifier.
- [x] 3. [frontend] `ProBadge` czyta `useIsPro()`, usunięcie `IS_PRO`. — skill: test-driven-development — najpierw testy: `ProBadge.test.tsx`, `ProfileScreen.test.tsx` — weryfikacja: verifier.
- [x] 4. [frontend] Ustawienia: baner tylko bez PRO → `RevenueCatUI.presentPaywall()`; wiersz „Subskrypcja” dla PRO → `RevenueCatUI.presentCustomerCenter()`; offline wyłączone z powodem; błąd → Snackbar; teksty pl/en. — skill: test-driven-development, frontend-ui-engineering — najpierw testy: `SettingsScreen.test.tsx`, `i18n.test.ts` — weryfikacja: verifier.
- [ ] 5. [orkiestrator] Dokumenty (lista w „Pliki”), wpis w roadmapie. Kacper: konfiguracja panelu (niżej) i dev build. — weryfikacja: tester na emulatorze Android: bez PRO baner → paywall → zakup `monthly` w Test Store → odznaka PRO, baner znika, „Subskrypcja” otwiera Customer Center; wylogowanie i logowanie innym kontem → bez PRO; offline → przyciski wyłączone, odznaka zostaje. Na końcu verifier całej gałęzi z CodeRabbit.
- [x] 6. [backend] D6: `PurchasesProvider` wystawia `useIsProIdentityConfirmed()` (stan wiązany z `session.id`). — skill: test-driven-development — najpierw testy: nowe przypadki w `Purchases.test.tsx` (sekcja „Poprawka D6”) — weryfikacja: verifier + pełny zestaw, typecheck, lint.
- [x] 7. [frontend] D6: baner PRO w Ustawieniach wyłączony i `present()` paywalla zablokowane bez potwierdzonej tożsamości. — skill: test-driven-development — najpierw testy: `SettingsScreen.test.tsx` — weryfikacja: verifier; potem dokumenty (orkiestrator), odpowiedź na wątek CodeRabbit w PR #39 i verifier całej gałęzi z CodeRabbit.
- [x] 8. [backend] D7: sesja poznaje `userId` po odświeżeniu tokenu, gdy po starcie offline był `null` (`session-source.ts`, `Session.tsx`). — skill: test-driven-development, source-driven-development (kiedy `auth-js` wysyła `TOKEN_REFRESHED` w React Native) — najpierw testy: `session-source.test.ts`, `Session.test.tsx` — weryfikacja: verifier + pełny zestaw, typecheck, lint.
- [ ] 9. [backend] D7: `PurchasesProvider` nie potwierdza tożsamości przy `userId === null`. — skill: test-driven-development — najpierw testy: `Purchases.test.tsx` — weryfikacja: verifier; potem dokumenty (orkiestrator), odpowiedź w wątku CodeRabbit w PR #39 (po zgodzie Kacpra) i verifier całej gałęzi z CodeRabbit.

### Poprawka D6: paywall tylko przy potwierdzonej tożsamości (kroki 6–7)

**Fakty z kodu (explorer, 2026-11-12):** `Purchases.tsx` trzyma potwierdzenie tożsamości tylko w `useRef` (`live.current.confirmed`, `:32`), a kontekst wystawia samo `boolean` (`useIsPro`, `:9-12`). Po nieudanym `logIn` dla innego użytkownika SDK wynik to „bez PRO”, ale nic nie mówi „tożsamość niepotwierdzona”. `SettingsScreen.tsx:294` włącza baner tylko na podstawie `offline`, a `present()` (`:245-256`) nie sprawdza tożsamości. Customer Center nie wymaga zmian: wiersz renderuje się tylko przy `isPro` (`:301`), a `isPro` = true wymaga potwierdzonej tożsamości.

**Podejście:** `PurchasesProvider` trzyma potwierdzenie tożsamości także w stanie (wiązanym z `session.id`, jak `pro`) i wystawia je hookiem `useIsProIdentityConfirmed(): boolean`. `useIsPro()` bez zmian, więc `ProBadge` i jego testy zostają. W Ustawieniach baner ma `disabled={offline || !confirmed}`, a `present()` dla paywalla nic nie robi bez potwierdzenia (obrona przed szybkim tapnięciem).

**Założenia (potwierdzasz akceptacją):**
- Z6. Start offline z zapamiętaną sesją (`userId = null`) liczy się jako potwierdzony (jak dziś w `Purchases.tsx:52`, Z1/D5). Baner i tak jest wtedy wyłączony przez `offline`.
- Z7. Bez automatycznego ponawiania `logIn`. Po nieudanym `logIn` baner zostaje wyłączony do zmiany sesji albo restartu aplikacji (provider wtedy próbuje znowu). Zapisane w `known-limitations.md`.
- Z8. Wyłączony baner przy niepotwierdzonej tożsamości **nie ma tekstu z powodem** (zwykle trwa to ułamek sekundy po zalogowaniu, tekst by mignął). Patrz P5.

**Testy (najpierw, red przed green):**
- `src/providers/__tests__/Purchases.test.tsx`: inny użytkownik SDK i `logIn` jeszcze trwa → `useIsProIdentityConfirmed()` = false; `logIn` się udał → true; `logIn` się nie udał → false; ten sam użytkownik SDK (`getAppUserID() === userId`) → true od razu; start offline (`userId = null`) → true; zmiana sesji resetuje do false (nie przecieka potwierdzenie poprzedniego konta).
- `src/features/profile/__tests__/SettingsScreen.test.tsx` (mock nowego hooka obok `mockPro`, domyślnie true): niepotwierdzona tożsamość online → baner widoczny, ale wyłączony, tap nie woła `presentPaywall`; brak tekstu `settings.pro.offline`; potwierdzona → jak dotąd.

**Pliki:** `src/providers/Purchases.tsx`, `src/providers/__tests__/Purchases.test.tsx` (krok 6); `src/features/profile/SettingsScreen.tsx`, `src/features/profile/__tests__/SettingsScreen.test.tsx` (krok 7); dokumenty: `docs/architecture/flows/features/subscription.md`, `docs/architecture/known-limitations.md` (zastąpienie wpisu `:116`, nowy wpis o Z7), `docs/architecture/decisions.md` (D6). Bez zmian w Zod, bazie i i18n.

### Poprawka D7: start offline nie potwierdza tożsamości (kroki 8–9)

**Fakty z kodu (orkiestrator, 2026-11-12):**
- `Purchases.tsx:72` ustawia potwierdzenie przy `signedIn` + `userId === null` bez `getAppUserID()`.
- `session-source.ts:86-87` przekazuje dalej tylko `SIGNED_IN` i `SIGNED_OUT`; `TOKEN_REFRESHED` jest pomijany. Po starcie offline `userId` zostaje więc `null` do końca działania aplikacji, także po powrocie sieci. Wpis w dzienniku z przeglądu kroków 6–7 („po powrocie sieci nowy `userId` przechodzi pełną ścieżkę”) był błędny.
- `SettingsScreen.tsx:295`: `disabled={offline || !confirmed}` — po powrocie sieci oba warunki puszczają i paywall otwiera się dla użytkownika zapamiętanego w SDK.
- `Session.tsx:156-162` już obsługuje „sesja `signedIn` z `userId = null` poznaje `userId`” (bez czyszczenia danych) i ignoruje zdarzenie z tym samym `userId`. Ale z `loading` / `error` zdarzenie `signedIn` uruchamia `leave()` i **czyści dane z telefonu** (`:169-171`).

**Podejście:**
- Krok 8: `session-source.ts` przekazuje `TOKEN_REFRESHED` jako **osobny** typ zmiany (nie `signedIn`), a `Session.tsx` reaguje na niego tylko wtedy, gdy stan to `signedIn` z `userId === null` — wtedy ustawia `userId`. W każdym innym stanie nic nie robi, więc odświeżenie tokenu nigdy nie uruchomi `leave()` ani czyszczenia danych.
- Krok 9: z `Purchases.tsx` znika `setConfirmedState({ id, value: true })` w gałęzi startu offline. `live.current.confirmed` dla tej gałęzi zostaje (steruje tylko statusem PRO z pamięci SDK, czyli odznaką offline z D3, nie zakupem).
- `SettingsScreen.tsx` bez zmian.

Odrzucone: przekazać `TOKEN_REFRESHED` jako zwykłe `signedIn` (mniej kodu, ale w stanie `loading` / `error` wyczyściłoby dane z telefonu); samo usunięcie potwierdzenia bez kroku 8 (każdy, kto uruchomił aplikację offline, nie kupi PRO do restartu).

**Założenia (potwierdzasz akceptacją):**
- Z9. Jeśli po powrocie sieci `logIn` się nie uda albo `TOKEN_REFRESHED` nie przyjdzie, baner zostaje wyłączony do zmiany sesji albo restartu, bez tekstu z powodem (jak Z7 / Z8).
- Z10. Bez zmian w i18n, bazie i migracjach. Jeśli `SessionChange` jest schematem Zod, nowy typ zmiany dochodzi najpierw tam.

**Testy (najpierw, red przed green):**
- `src/data/__tests__/session-source.test.ts`: `TOKEN_REFRESHED` z sesją nieanonimową → nowy typ zmiany z `userId`; z sesją anonimową albo bez sesji → nic.
- `src/providers/__tests__/Session.test.tsx`: start offline (`userId = null`) + odświeżenie → `signedIn` z `userId`, bez czyszczenia danych; odświeżenie przy znanym `userId`, w `loading`, `error` i `signedOut` → stan bez zmian, `clearUserData` niewołane.
- `src/providers/__tests__/Purchases.test.tsx`: start offline → `useIsProIdentityConfirmed()` = false, `useIsPro()` nadal z pamięci SDK (zmiana istniejącego testu Z6 — zmiana wymagań, nie osłabienie); start offline, potem `userId` znany i ten sam użytkownik SDK → true; inny użytkownik SDK i nieudany `logIn` → false (scenariusz CodeRabbit).

**Pliki:** krok 8: `src/data/session-source.ts`, `src/providers/Session.tsx`, ewentualnie schemat `SessionChange` w `src/schemas/`, ich testy i atrapy w `src/test/`; krok 9: `src/providers/Purchases.tsx` i jego test. Dokumenty (orkiestrator): `known-limitations.md` (`:118` zastąpiony przez Z9), `decisions.md` (D7), `flows/features/subscription.md`, opis sesji w `docs/architecture/flows/`.

## Konfiguracja panelu RevenueCat (robi Kacper, przed krokiem 5)
1. Projekt → Test Store (klucz `test_…` już masz).
2. **Products:** `monthly` (subskrypcja miesięczna) i `yearly` (subskrypcja roczna) w Test Store.
3. **Entitlements:** `travelo_pro`, dołącz oba produkty.
4. **Offerings:** oferta `default` jako *current*, pakiety `$rc_monthly` → `monthly`, `$rc_annual` → `yearly`.
5. **Paywalls:** paywall dla oferty `default` (szablon do wyboru; teksty pl/en).
6. **Customer Center:** włącz w panelu (Tools → Customer Center).
7. Przed wydaniem: osobne aplikacje App Store / Google Play i ich klucze `appl_…` / `goog_…` (poza tym zadaniem).

## Dziennik postępu
- Krok 1 (2026-11-11): testy napisane (red ✓: brak modułów) · `react-native-purchases` i `react-native-purchases-ui` 11.0.1, `RevenueCatConfigSchema`, `hasPro` / `PRO_ENTITLEMENT`, `configurePurchases()`, globalne mocki SDK (`src/test/mock-purchases.ts`), `.env.example` · green ✓ (4062 testy, typecheck, lint) · verifier PASS · użyty skill: test-driven-development, source-driven-development · odstępstwo: `purchases.ts` eksportuje tylko `configurePurchases()`, krok 2 woła `logIn` / `logOut` / nasłuch bezpośrednio na SDK.

- Krok 2 (2026-11-11): zablokowany po 3 próbach (niezacommitowany). Próba 1: FAIL — wylogowany telefon mógł pokazać PRO poprzedniego konta (SDK pamięta użytkownika). Próba 2: FAIL — późny status z pamięci SDK przeciekał do następnego konta; test zależny od kolejności. Próba 3 (przebudowa na licznik „pokolenia” sesji, 15 testów, 4077 zielonych): FAIL — (a) test „offline start” pada przy losowej kolejności (kolejki `mockReturnValueOnce` nie są czyszczone w `resetPurchasesMocks`), (b) **offline z zapamiętaną sesją (`userId` znany) `logIn` się nie udaje i odznaka PRO znika — sprzeczne z D3**. Odstępstwo TDD w próbie 2: poprawka przed testami, czerwień pokazana mutacją.

- Krok 2, próba 4 (po D5): kod spełnia wymagania (24 testy, 4086 zielonych, 7 losowych kolejności), FAIL verifiera tylko za brak testów dla 4 zabezpieczeń (mutacje przeżywają: sprawdzenie sesji po `logIn` i po `getAppUserID`, pierwszeństwo `logIn` nad pamięcią, strażnik StrictMode). Dopisywanie testów. Start offline (`userId = null`): aktualizacje z SDK przyjmowane bez potwierdzenia tożsamości — zgodne z Z1/D5 (ostatni użytkownik SDK jest zaufany offline).

- Krok 2, próba 5: dopisane 5 testów (29), usunięty strażnik `handledId` (nie dało się zbudować testu, który go wymaga; provider montuje się przy sesji `loading`) · green ✓ (4091 testów, typecheck, lint, 6 losowych kolejności pliku) · verifier PASS (17/20 mutacji zabitych; przeżyły: równoważna, aktualizacja z nasłuchu w oknie `logIn` tego samego użytkownika, odrzucenie `getCustomerInfo` przy starcie offline — drobne) · użyty skill: test-driven-development · uwaga verifiera: cały zestaw z `--randomize --seed=977` ma 8 błędów w niezwiązanych testach (animacje / timery), te same bez zmian tego kroku.

- Krok 3 (2026-11-11): testy (red ✓: odznaka renderowana mimo braku PRO) · `ProBadge` czyta `useIsPro()`, usunięte `IS_PRO` i właściwość `pro`; testy mockują `useIsPro` · green ✓ (4092 testy, typecheck, lint) · verifier PASS (mutacja ignorująca `useIsPro` łapana przez 2 testy) · użyty skill: test-driven-development.

- Krok 4 (2026-11-11): 23 testy (red ✓) · baner tylko bez PRO → `presentPaywall()`, ERROR / odrzucenie → Snackbar; dla PRO wiersz „Subskrypcja” (pierwszy w karcie A, ikona `Crown` — wybór orkiestratora, plan nie określał) → `presentCustomerCenter()`; offline oba wyłączone z powodem; blokada podwójnego tapnięcia (`useRef`); usunięte „Wkrótce” · verifier PASS (luka: brak testu ponownego otwarcia po błędzie — dopisany, red ✓) · green ✓ (4116 testów, typecheck, lint) · użyty skill: test-driven-development, frontend-ui-engineering · do oceny na telefonie: wyłączony baner ma tylko szary tekst (`theme.disabled.foreground`), gradient nie jest przyciemniony.

- Krok 5, część orkiestratora (2026-11-11): dokumenty zaktualizowane — nowy `docs/architecture/flows/features/subscription.md` (+ indeks), `overview.md` (providers, usługi zewnętrzne), `frontend.md`, `decisions.md`, `known-limitations.md` (usunięte wpisy o `IS_PRO` / „Wkrótce”, nowa sekcja PRO), `profile-screen.md`, `profile-settings.md`, `context/app-context.md` (3.9, roadmapa pkt 19). Zostaje: konfiguracja panelu i zmiana nazwy w `.env` (Kacper), dev build, tester na emulatorze, verifier całej gałęzi z CodeRabbit.

- Przegląd całej gałęzi (2026-11-11): verifier (Sonnet 5.5) + CodeRabbit — PASS (4116 testów, typecheck, lint). CodeRabbit: 2 drobne uwagi, zapisane w `known-limitations.md` — `NOT_PRESENTED` bez komunikatu (P3) i baner aktywny, póki `logIn` świeżo zalogowanego użytkownika trwa (zakup idzie przez anonimowego użytkownika SDK, RevenueCat łączy go przy `logIn`).
- Krok 5, dev build (2026-11-11): po drodze naprawione — JDK 17 (Temurin 17.0.21) zamiast JDK 25; `android/` wygenerowany od nowa (`prebuild --clean`, Gradle 9.3.1 → 9.4.1; zmiany prebuild w `package.json` / `app.json` cofnięte); `ANDROID_HOME` zamiast skasowanego `local.properties`; `react-native-purchases` 11.0.1 przy równoległym Gradle zbudował `.jar` bez klas Javy (`cannot find symbol RNPurchasesPackage`) — z `org.gradle.parallel=false` i czystym katalogiem `build` biblioteki się buduje. Blokada w głównym folderze: `react-native-reanimated` pada w `ninja` na limicie 260 znaków mimo `LongPathsEnabled = 1`; `subst T:` nie pomaga (ścieżki rozwijane do `C:\Users\…`). P4 = kopia w `C:\td` (Kacper): istniejąca kopia robocza przełączona na `feature/revenuecat` (odrzucone tylko zmiany prebuild), `.env` skopiowany, `pnpm install`, `prebuild --clean`, build stamtąd — **build przeszedł**. Emulator brał najpierw JS z innego Metro (8081, stary kod) → `adb reverse tcp:8081 tcp:8083`.
- Krok 5, tester (2026-11-11, emulator API 37, konto `baxton`, angielski): start bez crasha, `[RevenueCat] Using a Test Store API key.` ✓; Profil i Ustawienia zgodne (bez PRO: brak odznaki + baner; po zakupie: odznaka + „Subscription” pierwszy w karcie A, bez banera) ✓; zakup `monthly` w Test Store ✓; Customer Center (Monthly, Active) ✓; offline: wiersz wyłączony z powodem, odznaka zostaje ✓; czytelność wyłączonego wiersza w obu motywach ✓. **Uwagi:** (1) raz paywall otworzył się sam ok. 5 s po zamknięciu, nie powtórzyło się — prawdopodobnie spóźnione tapnięcie testera (pierwsze tapnięcia ginęły), do sprawdzenia; (2) zapisany motyw „Ciemny” nie jest stosowany po restarcie aplikacji — niezwiązane z RevenueCat, prawdopodobnie istniało wcześniej; (3) brak opublikowanego paywalla → SDK pokazuje szablon domyślny. Nie sprawdzone: wyłączony baner offline (konto jest już PRO), wylogowanie / zmiana konta. Konto `baxton` zostało z aktywną subskrypcją Test Store.
- Paywall (2026-11-12, Kacper: „Tak, zaprojektuj”): szkic `pw1f69ab4177454172` przez Paywall AI w RevenueCat, podpięty do oferty `default`, **nieopublikowany**. Kremowe tło, gradient koral → złoty z koroną i samolotem, 3 korzyści (bez obiecywania funkcji, D1), roczny „Best value” + miesięczny, pl i en. Braki: brak wersji ciemnej (w trybie ciemnym zostaje jasny), czcionka systemowa zamiast Fraunces / DM Sans, linki Terms / Privacy bez adresów — do publikacji potrzebne adresy (proponowane z `docs/legal/README.md`: GitHub Pages).
- Paywall opublikowany (2026-11-12, Kacper: „Tak, dopnij i publikuj”): linki Terms / Privacy na GitHub Pages (pl i en), wersja ciemna z palety Sunline, `published_at` 2026-11-11T23:02:43Z, rewizja 2, oferta `default`. Czcionka nadal systemowa (Fraunces / DM Sans nie są dodane w RevenueCat).
- Paywall rewizja 4 (2026-11-12, Kacper: „Tak, publikuj”): na iPhonie 17 Pro kafelek z koroną chował się pod Dynamic Island (paywall RevenueCat nie respektuje górnego bezpiecznego obszaru, brak takiego ustawienia) → stały odstęp 72 pt nad kafelkiem; opublikowany 2026-11-11T23:07:46Z. Do sprawdzenia na iPhonie; na ekranach bez wyspy jest więcej miejsca u góry.
- Krok 6 (2026-11-12): 6 testów (red ✓: `useIsProIdentityConfirmed is not a function`) · `IdentityConfirmedContext` + `useIsProIdentityConfirmed()`, stan `{ id, value }` wiązany z `session.id`, ustawiany przy tym samym użytkowniku SDK, po udanym `logIn` i przy starcie offline (Z6); `useIsPro()` bez zmian · green ✓ (4122 testy, typecheck, lint) · verifier PASS (7/7 mutacji złapanych; drobne: brak testu „bez ponawiania” `toHaveBeenCalledTimes(1)` i testu rzucania poza providerem — jak dla `useIsPro`) · użyty skill: test-driven-development.
- Krok 7 (2026-11-12): 1 test (red ✓: baner nie był wyłączony) · `SettingsScreen` czyta `useIsProIdentityConfirmed()`, baner `disabled={offline || !confirmed}`, `onPress` woła paywall tylko przy `confirmed`; Customer Center, tekst offline i i18n bez zmian · green ✓ (4123 testy, typecheck, lint) · verifier PASS (drobne: strażnik `confirmed &&` w `onPress` nie ma osobnego testu, bo `fireEvent.press` respektuje `disabled`; czyta tę samą wartość z renderu co `disabled`) · użyty skill: test-driven-development · dokumenty: `decisions.md`, `flows/features/subscription.md`, `known-limitations.md` (wpis o banerze w trakcie `logIn` zastąpiony D6 / Z7 / Z8). Zostaje: odpowiedź na wątek CodeRabbit i verifier całej gałęzi.
- Przegląd kroków 6–7 (2026-11-12): verifier (Sonnet 5.5) + CodeRabbit — PASS (4123 testy, typecheck, lint). CodeRabbit: 2 uwagi „major”, verifier ich nie potwierdził — (a) `Purchases.tsx:97`: spóźniony `logIn(A)` po wylogowaniu i zalogowaniu B mógłby natywnie przełączyć SDK z powrotem na A (wymaga nakładania się `logIn` / `logOut` w SDK, niesprawdzone; możliwe utwardzenie: kolejkowanie operacji tożsamości); (b) `Purchases.tsx:72`: start offline liczony jako potwierdzony — to zaplanowane Z6, po powrocie sieci nowy `userId` przechodzi pełną ścieżkę. Kacper (2026-11-12, „Wpisz, push, odpowiedz”): obie zapisane w `known-limitations.md`, bez zmian w kodzie; push i odpowiedź w wątku CodeRabbit w PR #39.
- Odpowiedź CodeRabbit w wątku D6 (2026-11-12): start offline nadal potwierdza tożsamość bez porównania. Sprawdzone w kodzie — uwaga słuszna: `session-source.ts` pomijał `TOKEN_REFRESHED`, więc `userId` zostawał `null` także po powrocie sieci, a baner się odblokowywał. Zdanie z przeglądu kroków 6–7 („nowy `userId` przechodzi pełną ścieżkę”) było błędne. Kacper: „Tak, dopisz krok” → D7, kroki 8–9.
- Krok 8 (2026-11-12): testy (red ✓: 5 padło — brak zdarzenia `refreshed`, brak uzupełnienia `userId`, stary kod wołał `leave` przy innym id / `loading` / `error`) · `SessionChange` ma wariant `{ type: 'refreshed'; userId }` dla `TOKEN_REFRESHED` (sesja nieanonimowa); `Session.tsx` ustawia `userId` tylko w stanie `signedIn` z `userId === null`, w każdym innym nic nie robi · green ✓ (4130 testów, typecheck, lint) · verifier PASS (4/4 mutacje złapane, w tym odrzucona alternatywa „zwykłe `signedIn`”; wyścigi z `leave()` sprawdzone) · użyty skill: test-driven-development, source-driven-development · zmiana testu: `TOKEN_REFRESHED` usunięty z listy zdarzeń ignorowanych w `session-source.test.ts` (zmiana wymagań, verifier potwierdził) · **R6 rozstrzygnięte:** `auth-js` wysyła `TOKEN_REFRESHED` po powrocie sieci, zwykle w 30–60 s (tyknięcie co 30 s, blokada po błędzie 60 s), tylko gdy aplikacja jest na pierwszym planie; `SIGNED_IN` w tej sytuacji nie przychodzi · drobne (verifier): `refreshed` użytkownika A czekające w kolejce 0 ms mogłoby uzupełnić świeży stan offline użytkownika B — wymaga wylogowania i nowego startu offline w tym samym tyknięciu, ten sam kształt co istniejące `signedIn`.

## Ryzyka i otwarte pytania
- **P5 (otwarte, krok 7).** Czy wyłączony baner przy niepotwierdzonej tożsamości ma mieć tekst z powodem? Rekomendacja: nie (Z8) — zwykle trwa to ułamek sekundy, a długi stan to rzadki podwójny błąd. Alternatywa: osobny tekst tylko po nieudanym `logIn` (wymaga rozróżnienia „trwa” / „nie udało się” w providerze i nowego klucza i18n pl/en).
- R6 (kroki 8–9). Nie sprawdzone: czy `auth-js` w React Native na pewno wysyła `TOKEN_REFRESHED` po powrocie sieci i kiedy `ensureSession` zwraca błąd sieci. Jeśli zdarzenie nie przychodzi, po kroku 9 baner zostaje wyłączony do restartu (Z9) — bezpieczne, ale gorsze dla użytkownika; krok 8 ma to ustalić z dokumentacji, a jeśli się nie da, wraca jako pytanie.
- R5. Nie sprawdzone w dokumentacji RevenueCat: czy SDK po nieudanym `logIn` zostaje na poprzednim koncie i czy `logOut` wymaga sieci. Poprawka D6 chroni niezależnie od odpowiedzi.
- **P4 (rozstrzygnięte: kopia robocza w `C:\td`).** Jak zbudować dev build mimo limitu ścieżek w Windows.
- **P3 (otwarte).** Czy `PAYWALL_RESULT.NOT_PRESENTED` (np. brak bieżącej oferty w panelu) ma pokazywać Snackbar `settings.pro.error`? Rekomendacja: tak (jedna linia + test).
- **P2 (rozstrzygnięte: D5).** Jak ustalać status PRO, gdy `userId` jest znany, a `logIn` jeszcze nie odpowiedział albo się nie udał (offline / wolna sieć)? Rekomendacja: jeśli SDK ma już zalogowanego tego samego użytkownika (`Purchases.getAppUserID() === userId`), od razu pokazać jego status z pamięci SDK (`getCustomerInfo`, działa offline), a `logIn` tylko go odświeża; dla innego użytkownika czekać na `logIn`. Alternatywa: zostawić „bez PRO” do odpowiedzi `logIn` i zapisać odstępstwo od D3.
- **P1. Skąd odgałęzić `feature/revenuecat`?** Lokalny `main` jest przestarzały, a `fix/profile-pro-badge` ma 3 niewypchnięte commity z poprawką `ProBadge`, który ten plan zmienia. Rekomendacja: odgałęzić od `fix/profile-pro-badge` (po `git pull` na `main` i scaleniu jej do `main` przez PR — wtedy od `main`). Inaczej będzie konflikt w `ProBadge.tsx`.
- R1. Klucz `test_…` (Test Store) nie może trafić do wydania produkcyjnego — RevenueCat odrzuca takie zakupy w produkcji. Do zrobienia przed wydaniem, poza tym zadaniem.
- R2. Moduł natywny: po instalacji trzeba przebudować dev build (`npx expo run:android`); znane problemy z buildem na Windows (`known-limitations.md`: krótka ścieżka, JDK 17).
- R3. Status PRO jest tylko w aplikacji (D1): serwer o nim nie wie, więc przyszłe blokowanie funkcji na serwerze (np. limit Odkryj) będzie wymagało webhooka RevenueCat → Supabase.
- R4. Paywall i Customer Center RevenueCat mają własny wygląd (nie Sunline); kolory paywalla ustawiasz w panelu.
