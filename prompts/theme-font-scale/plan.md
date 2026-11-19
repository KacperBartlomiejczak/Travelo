# Zadanie: motyw „Ciemny” gubi się po zmianie rozmiaru czcionki (Android)
Status: runda 2 (uwagi CodeRabbit) w toku; nadal czeka usunięcie wpisu home-spend-summary po jej merge'u

## Zrozumienie i założenia
- Objaw (test T4/T9 home-spend-summary, emulator Medium Phone API 37, Android 17): Ustawienia → „Wygląd” → „Motyw” = „Ciemny”, potem `adb shell settings put system font_scale 1.3` (albo 2.0) → wszystkie ekrany w jasnej palecie, a wiersz „Motyw” dalej pokazuje „Ciemny”. Powrót do `font_scale 1.0` przywraca ciemną paletę.
- Błąd nie pochodzi z home-spend-summary (P13 w planie tej funkcji: osobne zadanie). Kod motywu jest taki sam na `main`.
- Jak działa motyw dziś (`src/hooks/usePreferences.ts`, `src/theme/useTheme.ts`, `src/theme/legacy/useTheme.ts`):
  - `applyThemePreference` woła `Appearance.setColorScheme('dark' | 'light' | 'unspecified')`. Na Androidzie RN 0.88 robi to `AppCompatDelegate.setDefaultNightMode(...)`.
  - Oba `useTheme` wybierają paletę wyłącznie z `useColorScheme()`, czyli z tego, co natywny `AppearanceModule` ostatnio wysłał do JS.
- Hipoteza przyczyny (do potwierdzenia w kroku 1):
  - `MainActivity` nie ma `fontScale` ani `density` w `android:configChanges`, więc zmiana rozmiaru czcionki odtwarza aktywność.
  - `AppearanceModule` liczy schemat z `currentActivity ?: reactApplicationContext`. Tryb nocny z `AppCompatDelegate` dotyczy tylko aktywności, nie kontekstu aplikacji. W chwili odtwarzania (brak aktywności) moduł czyta jasny schemat systemu i wysyła „light” do JS. Nowa aktywność nie wywołuje potem `onConfigurationChanged`, więc nikt nie wysyła „dark” z powrotem.
  - To samo może wywołać każda inna zmiana konfiguracji spoza `configChanges` (np. rozmiar wyświetlania / `density`).
- Wpis o tym błędzie w `docs/architecture/known-limitations.md` (sekcja home-spend-summary) jest dziś tylko na gałęzi `feature/home-spend-summary`, której nie ma jeszcze w `main`. Usuwam go tam, gdzie będzie, gdy ta gałąź trafi do `main` (patrz pytanie 2).

## Podejście
Decyzja Kacpra (2026-11-18): opcja A. Rozważane opcje:

- **A (rekomendacja): wybrana preferencja wygrywa w `useTheme`.** Mały wspólny store preferencji motywu w `usePreferences.ts` (`useSyncExternalStore`; `applyThemePreference` zapisuje wartość i powiadamia). Oba `useTheme` biorą „dark”/„light” z preferencji, a `useColorScheme()` tylko przy „Systemowy”. `Appearance.setColorScheme` zostaje (pickery, klawiatura).
  - Plusy: naprawia każdą przyczynę odtworzenia aktywności, nie wymaga przebudowy natywnej, daje prawdziwy test red → green w Jest.
  - Minus: w złym stanie natywne elementy (picker daty, klawiatura) mogą dalej być jasne. Sprawdzi to tester.
- **B: nie odtwarzać aktywności.** Mały config plugin w `plugins/` dodający `fontScale|density` do `android:configChanges` (katalog `android/` jest w `.gitignore`, więc zmiana musi iść przez plugin). RN obsługuje wtedy zmianę czcionki sam (`onConfigurationChanged` z kontekstem aktywności).
  - Plusy: usuwa przyczynę w natywnym kodzie, także dla pickerów.
  - Minusy: wymaga `expo prebuild` i nowego builda na emulatorze, test w Jest sprawdza tylko wynik pluginu (manifest), nie zachowanie; inne zmiany konfiguracji dalej mogą zgubić motyw.

## Struktury danych (Zod)
Bez zmian. `ThemePreferenceSchema` (`src/schemas/preferences.ts`) zostaje jak jest.

## Testy
(dla opcji A)
- `src/__tests__/theme/useTheme.test.tsx` (lub obok istniejącego testu motywu): preferencja „dark”, `useColorScheme` zwraca „light” (tak jak po odtworzeniu aktywności) → `useTheme()` zwraca `darkTheme`. Najpierw czerwony.
- To samo dla „light” przy systemie „dark” oraz dla `legacy/useTheme`.
- „Systemowy” dalej idzie za `useColorScheme()`.
- `usePreferences.test.tsx`: `setTheme('dark')` przełącza paletę we wszystkich komponentach używających `useTheme` (bez przeładowania).

## Pliki
(dla opcji A)
- `src/theme/themePreference.ts` (nowy: store preferencji motywu), `src/hooks/usePreferences.ts`, `src/theme/useTheme.ts`, `src/theme/legacy/useTheme.ts`, testy w `src/__tests__/`.
- Docs: `docs/architecture/flows/features/profile-settings.md` (skąd bierze się paleta), `docs/architecture/known-limitations.md`.

## Skille
- test-driven-development — krok 2 — test odtwarzający błąd przed poprawką
- debugging-and-error-recovery — krok 1 — potwierdzenie przyczyny na emulatorze

## Kroki
- [x] 1. [orchestrator] Potwierdzić błąd na `main` na emulatorze (build debug `com.anonymous.traveling` z Metro tej gałęzi; przed tym pytam, czy emulator jest wolny) i potwierdzić hipotezę w logcat / przez `Appearance.getColorScheme()`. Bez zmian w kodzie. — skill: debugging-and-error-recovery — weryfikacja: zrzut ekranu jasnej palety przy „Ciemny”.
- [x] 2. [frontend] Poprawka wybranej opcji — skill: test-driven-development — najpierw testy: z sekcji „Testy” (red ✓ z powodu jasnej palety) — weryfikacja: cały zestaw testów, `pnpm typecheck`, `pnpm lint` zielone; verifier PASS.
- [x] 3. [orchestrator] cve-auditor (pełny audyt), potem tester na emulatorze: „Ciemny” + `font_scale` 1.3 i 2.0 → ciemna paleta na Ustawieniach, Głównym i Profilu; picker daty i klawiatura; „Jasny” przy ciemnym systemie; „Systemowy” dalej idzie za telefonem; powrót do 1.0. Na końcu przywrócić `font_scale 1.0`.
- [x] 4. [orchestrator] Docs: `profile-settings.md` (oraz `frontend.md`, `overview.md`, `decisions.md`, nowy wpis w `known-limitations.md`); usunięcie wpisu home-spend-summary z `known-limitations.md` odłożone do merge'u tamtej gałęzi (pytanie 2); verifier całej gałęzi (z CodeRabbit), PR.

## Dziennik postępu
- Krok 1 (2026-11-18): błąd odtworzony na kodzie `main` (7bff6f1), emulator Medium Phone API 37, Metro z worktree na porcie 8085 (8081 zajęty przez inną sesję; `debug_http_host` przywrócony na `localhost:8081`). „Theme: Dark” → `font_scale 1.3` → logcat pokazuje nowe `Running "main"` w tej samej instancji JS (aktywność odtworzona, moduły JS nie są ładowane od nowa, więc `applyThemePreference` z `_layout.tsx` nie biegnie ponownie) → Główny w jasnej palecie. Odstępstwo od opisu z home-spend-summary: po powrocie do `font_scale 1.0` paleta została jasna. Hipoteza (natywny `AppearanceModule` zgłasza „light”) zgodna z obserwacją; opcja A jej nie wymaga do naprawy. Użyty skill: debugging-and-error-recovery.
- Krok 2 (2026-11-18): testy napisane (red ✓: macierz w `src/theme/__tests__/useTheme.test.ts` dostawała jasną paletę przy preferencji „dark”) · nowy `src/theme/themePreference.ts` (`useSyncExternalStore`, leniwy odczyt `readThemePreference`), `applyThemePreference` zapisuje do niego, oba `useTheme` biorą „dark”/„light” z preferencji, `useColorScheme()` tylko przy „system”; `usePreferences().theme` czyta ten sam store; `settings-list.test.tsx` synchronizuje store z zapisaną wartością · green ✓ (4389 testów, typecheck, lint) · verifier PASS · użyty skill: test-driven-development · odstępstwa: store w `src/theme/themePreference.ts`, nie w `usePreferences.ts` (inaczej motyw importowałby i18n); skutek uboczny przyjęty: na webie wybrany motyw też steruje paletą (wcześniej zawsze szła za przeglądarką), `DateTimeField.web.tsx` dalej idzie za przeglądarką.
- Krok 3 (2026-11-18): cve-auditor EXISTS (node-forge <=1.4.2 przez `@expo/cli`, glob/minimatch w Jest; tylko narzędzia, nie aplikacja) → Kacper zdecydował: uruchomić testera, CVE naprawia osobna sesja. Tester (Medium Phone API 37, Metro 8085): T1 „Ciemny” + 1.3 PASS, T2 + 2.0 PASS, T3 powrót do 1.0 PASS, T4 PASS z uwagą (paleta ciemna; natywny picker daty i klawiatura jasne), T5 „Jasny” przy ciemnym systemie + 1.3 PASS, T6 „Systemowy” idzie za systemem także przy 1.3 PASS. Poza zakresem: kreator nowej podróży przy 1.3 nie przewija pola „From” nad klawiaturę; przy 2.0 etykieta „Profile” w pigułce ucięta. Sprzątanie: `font_scale 1.0`, `night no`, motyw „Ciemny”, `debug_http_host` = `localhost:8081`. Uwagi zapisane w `known-limitations.md`.
- Krok 4 (2026-11-18): docs zaktualizowane · verifier całej gałęzi PASS (test, typecheck, lint zielone; CodeRabbit: 0 uwag) · PR otwarty.
- Krok 5 (2026-11-19): test `renderToString` w `src/theme/__tests__/themePreference.test.tsx` (red ✓: „Missing getServerSnapshot”) · `getServerThemePreference` zwraca `'system'` jako trzeci argument `useSyncExternalStore` · green ✓ (4391 testów, typecheck, lint) · verifier PASS · użyty skill: test-driven-development · odstępstwo: import `react-dom/server` z `// @ts-expect-error` i opisanym powodem (brak `@types/react-dom`, bez nowych zależności). Nie sprawdzone: prawdziwy `expo export -p web`.
- Krok 6 (2026-11-19): nowy test „the theme store with nothing set yet” w `jest.isolateModules` (zapisany „dark”, system „light” → ciemna paleta w `usePreferences` i obu `useTheme`) · mutacja (`current ??= 'light'`) → nowy test czerwony, po cofnięciu zielony · cały zestaw (4391), lint zielone · verifier PASS · odstępstwa: zapisana wartość przez zmienną `mockSavedTheme` (`jest.doMock` w izolacji nie nadpisał mocka z góry pliku); `react` podmieniony w izolowanym rejestrze na zewnętrzną instancję (inaczej „Invalid hook call”).

## Runda 2: uwagi CodeRabbit do PR #43 (2026-11-19, zaakceptowana przez Kacpra 2026-11-19)
Recenzja CodeRabbit z 2026-11-18 (commit 1ac8780): 1 uwaga do naprawy + 1 nitpick. Obie sprawdzone na kodzie gałęzi i obie aktualne.

- **U1 (Minor, `src/theme/themePreference.ts:24`):** `useThemePreference` woła `useSyncExternalStore` bez `getServerSnapshot`. `app.json` ma `web.output: "static"`, więc przy eksporcie webu render na serwerze rzuca błąd w każdym komponencie z `useTheme` / `usePreferences` (React bez trzeciego argumentu nie renderuje po stronie serwera). Poprawka: trzeci argument zwracający `'system'` bez czytania pamięci. Po hydracji klient przełącza się na zapisaną wartość.
- **U2 (Trivial, `src/hooks/__tests__/usePreferences.test.tsx:32`):** test „starts with the saved values” nie sprawdza odczytu zapisanego motywu: `beforeEach` wstawia `'light'` do store'u, a mock `readThemePreference` też zwraca `'light'`. Test przejdzie, nawet gdy store zignoruje zapisaną wartość. Poprawka: nowy test w `jest.isolateModules` (świeży store), zapisany „dark”, system „light” → preferencja i oba `useTheme` dają ciemną paletę bez `setThemePreference`. Wzorzec `isolateModules` już jest w repo (`src/data/__tests__/supabase.test.ts`).

### Testy (runda 2)
- U1: `src/theme/__tests__/themePreference.test.tsx` (nowy): `renderToString` z `react-dom/server` (jest w zależnościach) komponentu z `useThemePreference` → nie rzuca, zwraca `'system'`, `readThemePreference` nie wywołane. Red: dziś rzuca „Missing getServerSnapshot”.
- U2: sam test. Dowód, że coś łapie: verifier na chwilę podmienia `getThemePreference` na zwracanie `'light'` i widzi czerwony nowy test (bez commitowania tej podmiany).

### Kroki (runda 2)
- [x] 5. [frontend] U1 — skill: test-driven-development — najpierw test z „Testy (runda 2)”, red z powodu braku `getServerSnapshot` — pliki: `src/theme/themePreference.ts`, `src/theme/__tests__/themePreference.test.tsx` — weryfikacja: cały zestaw, `pnpm typecheck`, `pnpm lint`; verifier PASS.
- [x] 6. [frontend] U2 (równolegle z 5, inne pliki) — plik: `src/hooks/__tests__/usePreferences.test.tsx` — pozostałe testy dalej seedują store przez `setThemePreference` — weryfikacja jak wyżej + mutacja z „Testy (runda 2)”; verifier PASS.
- [ ] 7. [orchestrator] Odpowiedź w wątku CodeRabbit przy U1 i w PR (co i w którym commicie), verifier całej gałęzi (z CodeRabbit), push na `feature/theme-font-scale`. Tester i cve-auditor bez ponownego uruchomienia: zmiany nie dotykają Androida (U1 działa tylko przy renderze serwerowym, U2 to sam test). Docs bez zmian, chyba że verifier wskaże inaczej.

### Inne otwarte punkty (raport explorera, 2026-11-19)
- Usunięcie wpisu home-spend-summary z `known-limitations.md`: dalej czeka na merge tamtej gałęzi (pytanie 2). Na tej gałęzi wpisu nie ma.
- CVE (node-forge przez `@expo/cli`, glob/minimatch w Jest): nienaprawione. `prompts/zod-cve-fix/plan.md` wprost je pomija. To osobne zadanie, nie ten PR.
- Uwaga testera z kroku 3 („Profile” w pigułce ucięte przy `font_scale 2.0`) nie ma osobnego wpisu w `known-limitations.md`. Jest tylko ogólna uwaga R1. Pytanie 3 poniżej.
- Werdykt PASS z kroku 4 („CodeRabbit: 0 uwag”) poprzedził recenzję CodeRabbit na PR, która znalazła U1 i U2. Krok 7 powtarza verifiera całej gałęzi.
- Drobna rozbieżność: sekcja „Testy” wymienia `src/__tests__/theme/useTheme.test.tsx`, a faktyczny plik to `src/theme/__tests__/useTheme.test.ts`.

## Ryzyka i otwarte pytania
- **Pytanie 3 (rozstrzygnięte 2026-11-19):** dopisać ucięte „Profile” przy `font_scale 2.0` jako osobny wpis w `known-limitations.md` w kroku 7? Kacper: tak, dopisane w kroku 7.
- **Pytanie 1 (rozstrzygnięte 2026-11-18):** opcja A.
- **Pytanie 2 (rozstrzygnięte 2026-11-18):** wpis usuwam po merge'u home-spend-summary do `main` (rebase tej gałęzi, usunięcie w tym PR). Kacper zgodził się też na użycie emulatora w kroku 1.
- Jeśli krok 1 nie potwierdzi hipotezy, wracam z nowym planem przed krokiem 2.
- Emulator może być używany przez inne sesje; przed krokiem 1 i 3 pytam.
