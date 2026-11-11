# Zadanie: Subskrypcja PRO przez RevenueCat (revenuecat)
Status: w trakcie (krok 2 odblokowany decyzją D5)

Akceptacja: Kacper, 2026-11-11, „Akceptuję” (na pytanie o plan z P1 = gałąź od `fix/profile-pro-badge`).

Gałąź: `feature/revenuecat`, odgałęziona od `fix/profile-pro-badge` (P1); jedyna gałąź zadania.

## Zrozumienie i założenia

Travelo dostaje prawdziwą subskrypcję PRO przez RevenueCat (`react-native-purchases` + `react-native-purchases-ui`). Status PRO = aktywne uprawnienie (entitlement) `travelo_pro`. Produkty: `monthly` i `yearly` w jednej ofercie (offering) z paywallem RevenueCat. „Zrobione” = odznaka PRO i baner w Ustawieniach pokazują prawdziwy status, baner otwiera paywall, PRO ma wiersz „Subskrypcja” z Customer Center, cały zestaw testów, `pnpm typecheck` i `pnpm lint` są zielone, a na emulatorze (dev build) da się kupić PRO w Test Store.

### Decyzje Kacpra (2026-11-11) — nie pytamy ponownie
- **D1. Zakres = infrastruktura.** SDK, logowanie użytkownika do RevenueCat, prawdziwy status `travelo_pro` zamiast stałej `IS_PRO`, baner „Przejdź na PRO” otwiera paywall i znika dla PRO, Customer Center dla PRO. **Żadna funkcja nie jest blokowana** dla kont bez PRO (to osobne zadanie). Bez statusu PRO po stronie serwera (bez webhooka, migracji, RLS).
- **D2. Customer Center = wiersz w Ustawieniach.** Dla PRO baner znika, a w pierwszej karcie wierszy pojawia się „Subskrypcja” → otwiera Customer Center.
- **D3. Offline:** baner i wiersz „Subskrypcja” są wyłączone z powodem pod spodem (jak „Wyloguj się”). Status PRO (odznaka) działa offline z pamięci podręcznej SDK RevenueCat.
- **D5 (P2, 2026-11-11, po zablokowaniu kroku 2).** Gdy `userId` jest znany, a SDK ma już zalogowanego tego samego użytkownika (`Purchases.getAppUserID() === userId`), od razu pokazujemy jego status z pamięci SDK (`getCustomerInfo`, działa offline); `logIn` tylko go odświeża, a jego błąd nie kasuje statusu. Inny użytkownik w SDK → „bez PRO” do odpowiedzi `logIn`.
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

## Ryzyka i otwarte pytania
- **P3 (otwarte).** Czy `PAYWALL_RESULT.NOT_PRESENTED` (np. brak bieżącej oferty w panelu) ma pokazywać Snackbar `settings.pro.error`? Rekomendacja: tak (jedna linia + test).
- **P2 (rozstrzygnięte: D5).** Jak ustalać status PRO, gdy `userId` jest znany, a `logIn` jeszcze nie odpowiedział albo się nie udał (offline / wolna sieć)? Rekomendacja: jeśli SDK ma już zalogowanego tego samego użytkownika (`Purchases.getAppUserID() === userId`), od razu pokazać jego status z pamięci SDK (`getCustomerInfo`, działa offline), a `logIn` tylko go odświeża; dla innego użytkownika czekać na `logIn`. Alternatywa: zostawić „bez PRO” do odpowiedzi `logIn` i zapisać odstępstwo od D3.
- **P1. Skąd odgałęzić `feature/revenuecat`?** Lokalny `main` jest przestarzały, a `fix/profile-pro-badge` ma 3 niewypchnięte commity z poprawką `ProBadge`, który ten plan zmienia. Rekomendacja: odgałęzić od `fix/profile-pro-badge` (po `git pull` na `main` i scaleniu jej do `main` przez PR — wtedy od `main`). Inaczej będzie konflikt w `ProBadge.tsx`.
- R1. Klucz `test_…` (Test Store) nie może trafić do wydania produkcyjnego — RevenueCat odrzuca takie zakupy w produkcji. Do zrobienia przed wydaniem, poza tym zadaniem.
- R2. Moduł natywny: po instalacji trzeba przebudować dev build (`npx expo run:android`); znane problemy z buildem na Windows (`known-limitations.md`: krótka ścieżka, JDK 17).
- R3. Status PRO jest tylko w aplikacji (D1): serwer o nim nie wie, więc przyszłe blokowanie funkcji na serwerze (np. limit Odkryj) będzie wymagało webhooka RevenueCat → Supabase.
- R4. Paywall i Customer Center RevenueCat mają własny wygląd (nie Sunline); kolory paywalla ustawiasz w panelu.
