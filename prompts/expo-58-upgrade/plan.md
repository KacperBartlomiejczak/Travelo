# Zadanie: aktualizacja do Expo SDK 58
Status: w trakcie

## Decyzje Kacpra (2026-11-06)
- Plan zaakceptowany („Akceptuję plan”), razem z rekomendacjami: P1 → a) lokalny dev build `npx expo run:android`; P2 → orkiestrator robi kroki 1 i 5, verifier je sprawdza; P3 → zgoda na podbicie zależności z tabeli.

Gałąź: `feature/expo-58-upgrade` (od `main` @ 6482669), worktree `C:\Users\Baxton\Developer\Travelo-expo58`. Bez pushu.

## Polecenie Kacpra (2026-11-11)
- „w poprzednich sesjach miala byc migracja na expo 58 a nic sie nie zmienilo dalej jestesmy na 57 [...] odpal jeszcze jednego teamleadera ktory to zrobi”. Cel: dokończyć migrację na tej gałęzi, tak żeby była gotowa do merge'a do `main` (161 commitów za `main`). Bez pushu i bez PR.
- Krok 4 (dev build na emulatorze) zostaje zablokowany — limit 260 znaków ścieżki w Windows; nie jest warunkiem tego etapu.

## Zrozumienie i założenia
- Podnosimy aplikację z Expo SDK 57 (RN 0.86.3, React 19.2.3) na **SDK 58 (`expo@58.0.23`, RN 0.88.1, React 19.3.0)**. Diff ograniczony do samej aktualizacji: zależności, poprawki wymuszone przez nowe SDK, dokumentacja. Żadnych nowych funkcji.
- Gotowe = `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone; `npx expo-doctor` czysty; aplikacja startuje na emulatorze Android (`Medium_Phone_API_37.0`), sprawdzone przez `tester`; `docs/development/commands.md` i `docs/architecture/overview.md` mają nowe wersje.
- Bazujemy na `main`, nie na `feature/places-legal-navbar` — gałęzie legal/places będą miały konflikty w `package.json` / `pnpm-lock.yaml` po zmergowaniu tej. Dlatego zmieniam tylko to, co konieczne.
- Node lokalnie: v26.8.1 — spełnia wymaganie SDK 58 (22.13+ / 24.3+ / 26+).
- Źródła: [changelog SDK 58](https://expo.dev/changelog/sdk-58), [migracja expo-router 57→58](https://docs.expo.dev/router/migrate/sdk-57-to-58/), `bundledNativeModules.json` z `expo@58.0.23`.

## Co zmienia SDK 58 i czy dotyczy repo
| Zmiana w SDK 58 | Dotyczy nas? |
|---|---|
| RN 0.87 „Strict TypeScript API”: deep importy `react-native/Libraries/*` to błędy typów, typy refów to instancje (`ScrollViewInstance`, `TextInputInstance`) | **Tak.** `ProfileSetupScreen.test.tsx` używa `typeof import('react-native/Libraries/ReactNative/RendererProxy')`; ~25 testów mockuje `react-native/Libraries/Utilities/useColorScheme` / `useWindowDimensions` (string w `jest.mock` nie jest błędem typów, ale ścieżka musi nadal istnieć w RN 0.88); `useRef<ScrollView>` / `useRef<TextInput>` w 7 plikach może wymagać typów instancji. Zakres poprawek ustalę po `pnpm typecheck` |
| expo-router: przebudowa nawigacji; `usePreventRemove` — zablokowaną akcję powtarza się funkcją `repeat` z callbacku; `navigation.dispatch` kolejkowany po commicie | **Tak.** `src/app/trips/new/_layout.tsx` (strażnik „Odrzucić zmiany?”, D19) zapisuje `data.action` i robi `navigation.dispatch`. Pokryte przez `src/__tests__/app/trips/new/layout.test.tsx` |
| expo-router: `getDrawerStatusFromState` deprecated, wymaga drugiego argumentu (domyślny status) | **Tak.** `src/test/drawer-status.ts` (helper testowy) |
| expo-router: `Tabs`/drawer pokazują tylko ekrany zadeklarowane w layoucie | Nie — `(tabs)/_layout.tsx` deklaruje wszystkie z `NAV_TABS`; sprawdzi to suite |
| expo-router: `initialRouteName`, `redirect`/`initialParams` na `Screen`, `freezeOnBlur`, `createStackNavigator` usunięte | Nie używamy |
| expo-router: `HeaderBackButton`, `useHeaderHeight`, `usePreventRemove`, `NavigationAction` z `expo-router/react-navigation` | Zostają (nie ma ich na liście usuniętych) — potwierdzi typecheck |
| expo-router: `headerTransparent` domyślnie `true` na iOS 26+ i systemowe fonty w nagłówkach | Tylko iOS; testujemy na Androidzie. Zapisuję jako ryzyko, nie ruszam |
| `react-native-gesture-handler` 2.32 → **3.x** (major) | Pośrednio: tylko drawer (`expo-router/drawer`) i `jest.setup.ts` (`react-native-gesture-handler/jestSetup`). Własnych gestów nie mamy |
| `expo-file-system`: `File.write()` asynchroniczne | Nie — tylko czytamy bajty zdjęcia |
| `expo-sqlite`: usunięty libSQL | Nie używamy |
| RN: usunięte `InteractionManager`, `Touchable`, `StatusBar` `translucent`/`backgroundColor`, Modal `animated`; `ImageBackground` deprecated | Nie używamy (StatusBar tylko z `expo-status-bar`, `style`) |
| `@expo/ui`: zmiany w `Host`/`HStack` (iOS) i `RNHostView` `style` (Android) | Używamy tylko pickerów daty/godziny — sprawdzi typecheck i tester |
| `expo-localization`: `supportsRTL` na iOS | Nie dotyczy |
| Android: R8 domyślnie w buildach release | Dotyczy dopiero buildu release (EAS) — ryzyko, nie część tego zadania |
| iOS: SceneDelegate w prebuild | CNG, `ios/` generowany i ignorowany — nic do zrobienia |
| Expo Go dla SDK 58 | Wg Expo „w ciągu kilku tygodni” od premiery; nie potwierdziłem, że jest już w Google Play — patrz pytanie P1 |

## Podbijane zależności (wymaga Twojej zgody)
Przez `npx expo install expo@^58.0.0 --fix` (pnpm). Wersje z `bundledNativeModules.json` dla `expo@58.0.23`:

| Pakiet | Teraz | Po |
|---|---|---|
| `expo` | ~57.0.26 | ~58.0.23 |
| `react` / `react-dom` | 19.2.3 | 19.3.0 |
| `react-native` | 0.86.3 | 0.88.1 |
| `expo-router` | ~57.0.24 | ~58.0.30 |
| `react-native-reanimated` | 4.5.1 | 4.7.1 |
| `react-native-worklets` | 0.10.1 | 0.13.0 |
| `react-native-gesture-handler` | ~2.32.0 | ~3.3.0 (**major**) |
| `react-native-screens` | ~4.26.0 | ~4.30.1 |
| `react-native-safe-area-context` | ~5.7.0 | ~5.11.1 |
| `react-native-svg` | 15.15.4 | 15.16.0 |
| `react-native-web` | ~0.21.0 | ~0.21.4 |
| `lottie-react-native` | ~7.3.8 | ~7.5.0 |
| `@expo/ui` | ~57.0.21 | ~58.0.27 |
| wszystkie `expo-*` (asset, constants, crypto, device, file-system, font, glass-effect, image, image-manipulator, image-picker, linking, localization, network, splash-screen, sqlite, status-bar, symbols, system-ui, web-browser) | ~57.x | ~58.x |
| dev: `jest-expo` | ~57.0.5 | ~58.0.14 |
| dev: `eslint-config-expo` | ~57.0.2 | ~58.0.4 |
| dev: `@types/react` | ~19.2.2 | to, co wskaże `expo install --fix` (pod React 19.3) |

Bez zmian (nie zarządza nimi SDK): `typescript` ~6.0.3, `jest` ~29.7, `@testing-library/react-native` ^14 (router 58 wymaga ≥14 — spełnione), `zod`, `@tanstack/react-query`, `@supabase/supabase-js`, `i18next`, `lucide-react-native`, fonty. Żadnych nowych pakietów.

## Podejście
1. Podbicie zależności `expo install --fix` + `expo-doctor`, potem uruchomienie suite/typecheck/lint jako „red” — lista realnych błędów po aktualizacji.
2. Naprawiam tylko to, co się sypie (typecheck, testy, lint, doctor) i to, co SDK 58 oznacza jako deprecated w naszym kodzie (`getDrawerStatusFromState`). Strażnik `usePreventRemove` zmieniam na `repeat` tylko jeśli test lub tester pokaże, że stary sposób już nie działa — inaczej zostawiam (minimalny diff).
3. Test na emulatorze przez dev build (patrz P1), potem dokumentacja.

Odrzucona alternatywa: ręczne podbijanie wersji w `package.json` — `expo install --fix` daje dokładnie wersje zgodne z SDK i jest zalecane w docs.

## Struktury danych (Zod)
Brak zmian. Aktualizacja nie dotyka schematów, migracji ani tabel.

## Testy
To aktualizacja, nie nowe zachowanie, więc „red” to istniejąca suite po podbiciu zależności:
- Krok 1: po `expo install --fix` uruchamiam `pnpm test`, `pnpm typecheck`, `pnpm lint` i zapisuję w dzienniku każdy błąd (to jest red dla kroków 2–3).
- Krok 2 (drawer helper): istniejące testy szuflady (`drawer.test.tsx` itd., 9 wywołań `drawerStatus`) muszą przejść z nowym podpisem `getDrawerStatusFromState`.
- Krok 3 (strażnik kreatora): `src/__tests__/app/trips/new/layout.test.tsx` — „Odrzuć” wychodzi z kreatora, „Zostań” / tap obok / Android back zostają, drugi zamiar wyjścia nie dubluje dialogu. Jeśli po aktualizacji jest czerwony → poprawka na `repeat`. Jeśli zielony, ale tester pokaże błąd na urządzeniu → najpierw dopisuję test, który go odtwarza.
- Krok 3 (typy RN 0.88): typecheck jako test; poprawki typów refów / deep importów w testach bez osłabiania asercji. Nie usuwam ani nie pomijam żadnego testu.

## Pliki
- `package.json`, `pnpm-lock.yaml` (krok 1)
- ewentualnie `app.json` — tylko jeśli `expo-doctor` lub prebuild tego wymaga (krok 1)
- `src/test/drawer-status.ts` (krok 2)
- ewentualnie `jest.setup.ts` (jeśli ścieżka `react-native-gesture-handler/jestSetup` zmieniła się w v3) (krok 2)
- `src/app/trips/new/_layout.tsx` — tylko jeśli test/urządzenie pokaże błąd (krok 3)
- pliki z błędami typów po RN 0.88 — lista dopiero po kroku 1 (prawdopodobnie `src/features/auth/__tests__/ProfileSetupScreen.test.tsx`, może pliki z `useRef<ScrollView|TextInput>`) (krok 3)
- `docs/development/commands.md`, `docs/architecture/overview.md`, `docs/architecture/decisions.md` (jeśli P1 zmieni sposób testowania), `docs/architecture/known-limitations.md` (ryzyka iOS/R8) (krok 5)

## Skille
- `migrate-to-strict-api` (dodany na prośbę Kacpra 2026-11-06) — krok 3 — typy `*Instance` dla refów i deep importy po RN 0.88
- `expo-upgrade` (dodany na prośbę Kacpra 2026-11-06) — krok 5 — kontrolna lista „Housekeeping” przed końcowym verifierem
- `deprecation-and-migration` — kroki 2–3 — migracja z API oznaczonych jako deprecated/usunięte w SDK 58
- `source-driven-development` — kroki 1–3 — każda poprawka oparta o oficjalne docs SDK 58 (`docs.expo.dev/versions/v58.0.0/`), nie o pamięć
- `test-driven-development` — kroki 2–3 — red (suite po aktualizacji) → green

## Kroki
- [x] 1. [tooling — orkiestrator, patrz P2] `npx expo install expo@^58.0.0 --fix`, `npx expo-doctor@latest`; zapis błędów suite/typecheck/lint — skill: source-driven-development — najpierw testy: suite po podbiciu (red) — weryfikacja: diff `package.json` = tabela wyżej, doctor czysty lub lista uwag, verifier
- [x] 2. [backend] `src/test/drawer-status.ts` → nowy podpis `getDrawerStatusFromState`; `jest.setup.ts` jeśli gesture-handler 3 zmienił `jestSetup` — skill: deprecation-and-migration, test-driven-development — najpierw testy: istniejące testy szuflady (red po kroku 1) — weryfikacja: pełna suite + typecheck + lint, verifier
- [x] 3. [frontend] poprawki w `src/` (poza warstwą danych) wymuszone przez RN 0.88 / expo-router 58: typy refów, deep importy w testach, ewentualnie strażnik kreatora (`repeat`) — skill: deprecation-and-migration, test-driven-development — najpierw testy: czerwone testy/typecheck z kroku 1 — weryfikacja: pełna suite + typecheck + lint, verifier
- [ ] 4. [tester] dev build na emulatorze `Medium_Phone_API_37.0` (Metro bez `CI=1`), scenariusze ręczne poniżej — skill: brak — weryfikacja: raport PASS/FAIL testera
- [x] 6. [tooling — orkiestrator] merge `main` → `feature/expo-58-upgrade` (merge, nie rebase); konflikty `package.json`/`pnpm-lock.yaml`: zostają wersje SDK 58, nowe pakiety z `main` przez `expo install`; `pnpm install`, `pnpm dlx expo install --fix`, `pnpm dlx expo-doctor` — skill: expo-upgrade — weryfikacja: doctor czysty lub lista uwag z powodem
- [x] 7. [backend/frontend] poprawki kodu z `main` (discover/places, karuzela zdjęć, pill nav, strony legal, profil/ustawienia, wydatki) wymuszone przez SDK 58 / RN 0.88 strict API / expo-router 58 — skill: migrate-to-strict-api, test-driven-development — najpierw testy: czerwone testy/typecheck/lint po merge'u — weryfikacja: pełna suite + typecheck + lint, verifier
- [x] 5. [docs — orkiestrator] `commands.md` (tabela „Project tooling”: SDK 58, RN 0.88, React 19.3; `react-native-gesture-handler` 3), `overview.md` (wersje w stacku), ewentualnie `decisions.md` / `known-limitations.md` — skill: documentation-and-adrs — weryfikacja: verifier końcowy (Sonnet) z CodeRabbit na całej gałęzi, `expo-doctor` jeszcze raz

### Scenariusze ręczne (krok 4)
1. Aplikacja startuje, animowany splash (Lottie) i ekran powitalny bez czerwonego ekranu / crasha.
2. Logowanie (sesja testowa) → ekran główny; pigułka nawigacji przełącza 5 zakładek, wskaźnik animuje się (Reanimated).
3. Szuflada podróży otwiera się gestem i przyciskiem, zamyka tapnięciem obok (gesture-handler 3).
4. Kreator nowej podróży: wpisz nazwę → wstecz → dialog „Odrzucić?”; „Zostań” zostaje, „Odrzuć” wychodzi.
5. Picker daty/godziny (`@expo/ui`) w kroku lotów otwiera się i zapisuje wartość.
6. Wybór okładki/zdjęcia z galerii (`expo-image-picker`) i podgląd (`expo-image`).
7. Tryb ciemny: przełączenie motywu w ustawieniach.

## Dziennik postępu
- Krok 1: `pnpm install` + `npx expo install expo@^58.0.0 --fix` · zmienione: `package.json`, `pnpm-lock.yaml`, `app.json`, `pnpm-workspace.yaml` · `expo-doctor@1.21.6`: 20/20 ✓ · użyty skill: source-driven-development · odstępstwa:
  - `expo install --fix` dał `expo: ^58.0.23` i `react-native-web: ^0.21.4` — poprawione ręcznie na `~` jak reszta.
  - `jest` 29.7 → **30.5.2**, `@types/jest` 29.5.14 → **30.0.0** (poza tabelą). `expo-doctor` zgłasza Jest 29 jako major mismatch. Kacper (2026-11-06): **Jest 30**.
  - SDK 58 doniósł `@parcel/watcher` ze skryptem build → `pnpm install` kończył się `ERR_PNPM_IGNORED_BUILDS`. Kacper: `allowBuilds: "@parcel/watcher": false` w `pnpm-workspace.yaml` (jak `unrs-resolver`).
  - `expo install --fix` sam dopisał do `app.json` pluginy `expo-asset`, `expo-font`, `expo-image`, `expo-status-bar`, `expo-web-browser` (SDK 58 wymaga ich jawnie; doctor czysty z nimi). Zostawione.
  - Verifier (Haiku): PASS — diff zgodny z tabelą i odstępstwami, frozen install ✓, doctor 20/20 ✓, lint ✓, `src/` bez zmian.
  - Red (Jest 30): `pnpm lint` ✓; `pnpm typecheck` — 71 błędów; `pnpm test` — 51 suite / 747 testów czerwonych. Na Jest 29 było 49 / 671, więc to głównie SDK, nie Jest.
- Krok 2 (backend + orkiestrator): red = suite po kroku 1 · zmienione: `package.json` (`jest.resolver: "react-native-reanimated/jest/resolver"` — oficjalny setup Reanimated 4.7; jego `mock.js` ładuje `initializers.native`, który rzucał `setCSSEventHandler`, przez co mock nie miał hooków), `jest.setup.ts` (mock `expo-router/testing-library` zwraca opakowaną bibliotekę), `src/test/settle-gate.ts` (`renderRouter` w routerze 58 to getter-only — przypisanie nic nie robiło; helper zwraca kopię z opakowanym `renderRouter`, który jest zwykłą obietnicą), `src/test/auth-email-flow.tsx` (`await renderRouter`), `src/test/drawer-status.ts` (`getDrawerStatusFromState(state, 'closed')`), `src/data/__tests__/supabase-trip-repository.test.ts` (14× `toMatchObject({constructor: …})` → `toHaveProperty('constructor.name', X)`; Jest 30 nie dopasowuje już dziedziczonego `constructor` — ta sama siła asercji) · gesture-handler 3 `jestSetup` działa bez zmian (rzucał tylko przez Reanimated) · green: `src/test|data|lib|providers|schemas` 60/60 suite ✓, lint ✓; cała suite 51/747 → 22/440 czerwonych (reszta = krok 3) · odstępstwo: backend dał obejście (stub `initializers.native.ts`), orkiestrator zamienił je na oficjalny resolver — wynik identyczny · verifier (Haiku): PASS · skill: deprecation-and-migration, test-driven-development
- Krok 1 — główne przyczyny red: (1) mock Reanimated w `jest.setup.ts` — `useSharedValue` / `useAnimatedStyle is not a function` (~1300 wystąpień), `setCSSEventHandler is not available in JSReanimated`; (2) `react-native-gesture-handler/jestSetup` (v3) rzuca przy imporcie; (3) typy: `renderRouter` zwraca teraz `Promise<RenderRouterResult>` bez `getPathname`/`getSegments`/`getSearchParams` na obietnicy (44), refy `ScrollView`/`TextInput` jako typy instancji (`scrollTo`, `focus`, `getNativeScrollRef`), `BottomTabBarProps` bez `navigation`, `getDrawerStatusFromState` wymaga 2 argumentów, brak `react-native/Libraries/ReactNative/RendererProxy`; (4) pojedyncze: `ServerUnreachableError` vs `Network request failed` (updateDetails offline), timeouty `useTripPhotos`, `settle-gate` („gate is still loading”).
- Kacper przesłał oficjalny przewodnik aktualizacji SDK 58 (2026-11-06). Porównanie z repo: `expo install --fix` + `expo-doctor` zrobione. `android/`/`ios/` nie istnieją (CNG, nic do kasowania). Brak `expo-router/unstable-native-tabs`, `ScreenOrientation`, `requireFullScreen`, `enableSceneSupport`, `eas.json`. `web.output` już `"static"`, brak plików `+api`/`+html`, więc `apiRoutes` niepotrzebne. Link do Strict TypeScript API guide przekazany subagentowi frontend (krok 3). Skilli `expo-upgrade` / `migrate-to-strict-api` nie instaluję bez zgody Kacpra. → Kacper: „dodaj te skille” — dodane (commit dee2bcf), wpisane w `docs/agents/skills.md` i sekcję Skille.
- Krok 3 (frontend): red = 22 suite / 440 testów, 69 błędów typów · zmienione (37 plików w `src/`):
  - A: testy `await renderRouter(...)` i czytają `getPathname`/`getRouterState` z wyniku.
  - B (prawdziwe błędy aplikacji po routerze 58): `(drawer)/_layout.tsx` deklaruje `<Drawer.Screen name="(tabs)" />` (bez tego szuflada nic nie renderowała); `Stack.Protected` w `_layout.tsx` dostały `redirectTo` (wylogowany lądował na „Unmatched Route”); `(auth)/_layout.tsx` `unstable_settings = { anchor: 'welcome' }` (po wylogowaniu lądował na `/email`); `PillTabBar` używa `emitter.emit` + `navigateToTab` (`BottomTabBarProps` bez `navigation`).
  - B (fixture'y): mocki `expo-status-bar` z `requireActual`, `Drawer.Screen` zachowany w mocku szuflady, `import * as AuthLayout` (żeby router widział `anchor`).
  - C: refy `ScrollViewInstance` / `TextInputInstance`, `findNodeHandle != null`, typ `RendererProxy` → `Pick<typeof import('react-native'), 'findNodeHandle'>`, `StyleSheet.flatten(...) ?? {}` w teście.
  - D: `CoverImage.test.tsx` — expo-image 58 mapuje `aria-hidden` na `accessibilityElementsHidden`; asercja `isHiddenFromAccessibility(...)` (ta sama intencja).
  - E: strażnik kreatora (`trips/new/_layout.tsx`) — test „Odrzuć” był czerwony; teraz `usePreventRemove` zapamiętuje pierwszy `repeat`, „Odrzuć” ustawia `leaving` i woła `repeat()`. Zachowanie D19 bez zmian.
  - green: 158/158 suite, 3346/3346 testów, typecheck 0, lint ✓ · skill: migrate-to-strict-api, deprecation-and-migration, test-driven-development · verifier (Haiku): PASS (liczba `it`/`expect` bez zmian w 25 plikach testów, brak `any`/`@ts-*`).
  - Uwagi verifiera (nieblokujące, poza zakresem): `jest.mock('react-native/Libraries/ReactNative/RendererProxy')` w `ProfileSetupScreen.test.tsx` zostaje (działa w RN 0.88; skill każe nie ruszać mocków-stringów); test „jeden dialog” nie sprawdza, która akcja zostaje zapamiętana.
- Krok 4 (w trakcie, zablokowany): lokalny `npx expo run:android` pada na kompilacji C++ — ninja z CMake 3.22.1 (Android SDK) nie obsługuje ścieżek > 260 znaków, a `LongPathsEnabled` w Windows = 0.
  - Próba 1: ścieżka 280 znaków w `react-native-worklets`, bo pnpm 12 ignoruje `node-linker` w `.npmrc` (na `main` tak samo). Kacper: `nodeLinker: hoisted` w `pnpm-workspace.yaml` (commit 6d4f04f; lockfile bez zmian, suite 158/158 ✓, typecheck ✓, lint ✓).
  - Próba 2: worklets przechodzi, `react-native-reanimated` pada (CMake dubluje pełną ścieżkę projektu w katalogu obiektów).
  - Próba 3: `subst T:` — autolinking Expo nie działa w katalogu głównym dysku, a przy `T:\Travelo-expo58` Node rozwija `subst` do `C:\…` i Gradle ma „different roots”.
  - Próba 4: jednorazowy worktree `C:\t58` (detached @ 6d4f04f) — pada codegen `react-native-gesture-handler` 3 (`shared/shadowNodes/react/renderer/components/rngesturehandler_codegen`, ~300 znaków). Krótsza ścieżka projektu już nie pomoże.
  - Zmiany `expo prebuild` w `app.json` (`android.package`, `ios.infoPlist`) i `package.json` (skrypty `android`/`ios`) cofnięte — to artefakty prebuild, nie część zadania.
- Krok 6 (2026-11-11): merge `main` (161 commitów) → `407183a`. Konflikty: `package.json`/lockfile (wersje SDK 58 + nowe `@formatjs/intl-pluralrules`), `docs/agents/skills.md` (obie linie), 3 testy (`await renderRouter` z 58 + mocki z `main`), `AuthFormScreen`/`WizardScreen` (`ScrollViewInstance` + nowe propsy/eksport z `main`). `pnpm install`, `expo install --fix` (bez zmian), `expo-doctor` 20/20 ✓. Kod z `main` nie używa innych API usuniętych w SDK 58 (grep). skill: expo-upgrade.
- Krok 7 (2026-11-11, frontend): po merge'u 11 błędów typecheck i 8 czerwonych testów. Poprawki: `await renderRouter` w 4 testach; `useRef<ScrollViewInstance>` w `trips/new/budget.tsx` i `home/BudgetSheet.tsx`; `StyleSheet.flatten(...)?.borderWidth` w `PillNav.tsx`; mock `Linking.openURL` zwraca `void`; `profile.test.tsx` — w expo-router 58 `useRouter()` nie zwraca singletonu `router`, więc `jest.spyOn(router, 'push')` nie widzi wywołania → test sprawdza przejście przez stub trasy `avatar` (ta sama liczba `it`/`expect`). green: 194/194 suite, 3928/3928 testów, typecheck ✓, lint ✓ · verifier (Haiku): PASS.
- Krok 5: `commands.md` — SDK 58, RN 0.88, React 19.3, lottie 7.5; `overview.md` nie podaje wersji — bez zmian. Krok 4 nadal zablokowany (ścieżki > 260 znaków).

## Ryzyka i otwarte pytania
- **P1 — jak testujemy na emulatorze?** Expo Go dla SDK 58 może jeszcze nie być w Google Play (obsługuje tylko SDK 58). Opcje:
  a) **lokalny dev build `npx expo run:android`** (generuje `android/`, ignorowany przez git; wymaga JDK + Android SDK, które już są) — **rekomenduję**, bo i tak cel to dev buildy;
  b) Expo Go, jeśli wersja SDK 58 jest już w sklepie;
  c) dev build przez EAS (`eas build --profile development`) — wolniej, zużywa limit EAS.
- **P2 — kto robi krok 1 i 5?** `package.json` / lockfile i `docs/` nie należą do żadnego subagenta (backend: `src/schemas|data|lib|providers|test`, `supabase/`; frontend: reszta `src/`). Proponuję, żeby orkiestrator zrobił krok 1 (same komendy `expo install`/`doctor`, zero kodu) i krok 5 (docs i tak są tylko jego), a verifier sprawdził oba. Alternatywa: delegować krok 1 do backendu z rozszerzonymi uprawnieniami.
- **P3 — zgoda na podbicie zależności** z tabeli wyżej, w tym major `react-native-gesture-handler` 2 → 3 (wymagany przez SDK 58, używa go tylko drawer).
- Ryzyko: konflikty w `package.json` / `pnpm-lock.yaml` z gałęziami legal/places — rozwiązanie przy ich merge'u: zostawić wersje SDK 58, dodać ich nowe pakiety przez `npx expo install`.
- Ryzyko (nie w zakresie): iOS 26+ — przezroczyste nagłówki i systemowe fonty w nagłówkach; Android release — R8 domyślnie włączony (Supabase/Lottie mogą potrzebować reguł keep). Zapiszę w `known-limitations.md`, sprawdzimy przy pierwszym buildzie iOS / release.
- Ryzyko: deep importy `react-native/Libraries/Utilities/*` w mockach testów mogą przestać istnieć w RN 0.88 → wtedy przenoszę mock na publiczne API (`jest.spyOn` na `react-native`), bez osłabiania asercji.
