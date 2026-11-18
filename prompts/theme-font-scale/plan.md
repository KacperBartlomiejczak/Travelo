# Zadanie: motyw „Ciemny” gubi się po zmianie rozmiaru czcionki (Android)
Status: w trakcie (zaakceptowany 2026-11-18, opcja A)

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
- [ ] 3. [orchestrator] cve-auditor (pełny audyt), potem tester na emulatorze: „Ciemny” + `font_scale` 1.3 i 2.0 → ciemna paleta na Ustawieniach, Głównym i Profilu; picker daty i klawiatura; „Jasny” przy ciemnym systemie; „Systemowy” dalej idzie za telefonem; powrót do 1.0. Na końcu przywrócić `font_scale 1.0`.
- [ ] 4. [orchestrator] Docs: `profile-settings.md`, usunięcie wpisu z `known-limitations.md`; verifier całej gałęzi (z CodeRabbit), PR.

## Dziennik postępu
- Krok 1 (2026-11-18): błąd odtworzony na kodzie `main` (7bff6f1), emulator Medium Phone API 37, Metro z worktree na porcie 8085 (8081 zajęty przez inną sesję; `debug_http_host` przywrócony na `localhost:8081`). „Theme: Dark” → `font_scale 1.3` → logcat pokazuje nowe `Running "main"` w tej samej instancji JS (aktywność odtworzona, moduły JS nie są ładowane od nowa, więc `applyThemePreference` z `_layout.tsx` nie biegnie ponownie) → Główny w jasnej palecie. Odstępstwo od opisu z home-spend-summary: po powrocie do `font_scale 1.0` paleta została jasna. Hipoteza (natywny `AppearanceModule` zgłasza „light”) zgodna z obserwacją; opcja A jej nie wymaga do naprawy. Użyty skill: debugging-and-error-recovery.
- Krok 2 (2026-11-18): testy napisane (red ✓: macierz w `src/theme/__tests__/useTheme.test.ts` dostawała jasną paletę przy preferencji „dark”) · nowy `src/theme/themePreference.ts` (`useSyncExternalStore`, leniwy odczyt `readThemePreference`), `applyThemePreference` zapisuje do niego, oba `useTheme` biorą „dark”/„light” z preferencji, `useColorScheme()` tylko przy „system”; `usePreferences().theme` czyta ten sam store; `settings-list.test.tsx` synchronizuje store z zapisaną wartością · green ✓ (4389 testów, typecheck, lint) · verifier PASS · użyty skill: test-driven-development · odstępstwa: store w `src/theme/themePreference.ts`, nie w `usePreferences.ts` (inaczej motyw importowałby i18n); skutek uboczny przyjęty: na webie wybrany motyw też steruje paletą (wcześniej zawsze szła za przeglądarką), `DateTimeField.web.tsx` dalej idzie za przeglądarką.

## Ryzyka i otwarte pytania
- **Pytanie 1 (rozstrzygnięte 2026-11-18):** opcja A.
- **Pytanie 2 (rozstrzygnięte 2026-11-18):** wpis usuwam po merge'u home-spend-summary do `main` (rebase tej gałęzi, usunięcie w tym PR). Kacper zgodził się też na użycie emulatora w kroku 1.
- Jeśli krok 1 nie potwierdzi hipotezy, wracam z nowym planem przed krokiem 2.
- Emulator może być używany przez inne sesje; przed krokiem 1 i 3 pytam.
