# Zadanie: Wykres wydatków na ekranie podróży
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-19, P1 i P2 wg rekomendacji)

## Zrozumienie i założenia
Kacper: „na ekranie podróży zamiast obecnej karty budżetu ma być wykres pokazujący, ile kto wydał, oraz ile zostało z budżetu na cały wyjazd”. Potem (2026-11-19): „niech pokazuje tylko i wyłącznie jedną osobę, czyli użytkownika”.

Stan obecny:
- Ekran podróży to Home: `src/features/home/CurrentTrip.tsx`, karta budżetu to funkcja `Budget` (stawka dzienna, suma na wyjazd, „Zmień” tylko dla organizatora, `SyncIndicator`).
- Logika istnieje: `computeExpenseBudget` (`src/lib/expense-budget.ts`) daje na osobę `spentMinor` i `leftMinor` (mój budżet = moja stawka × dni − moje wydatki).
- „Ja” wyznacza się jak w `ExpensesScreen`: organizator = `memberId: null`, podpięty znajomy = jego własny wiersz `members` (`userId === myId`).
- Wydatki są zawsze w walucie bazowej podróży (`ExpenseSchema`, sprawdza repozytorium), więc brak przypadku wielu walut i FX.
- Budżet zawsze istnieje (`dailyBudget` > 0), więc stanu „brak budżetu” nie ma.
- Wydatki czyta `useExpenses(tripId)` z lokalnej bazy, więc offline wykres działa jak zawsze; baner offline Home już istnieje.
- Biblioteki wykresów brak; jest `react-native-svg` 15.16.0, brak `expo-linear-gradient`.

## Podejście
- Nowa biblioteka `react-native-gifted-charts` + jej wymagany gradient `expo-linear-gradient` (A6), po audycie CVE.
- Karta „Budżet” na Home: nagłówek z „Zmień” (organizator), wykres tylko „Ja”, pod nim tekst „Wydałem X · Zostało Y z Z”, `SyncIndicator` (A3).
- Trzy warianty wykresu (A1, A2, A5):
  - **Liniowy (domyślny)**: oś X = dni wyjazdu, oś Y = ile wydałem danego dnia (nie narastająco).
  - **Słupkowy**: dwa słupki: „Wydałem” (cały wyjazd) i szary „Zostało” (z mojego budżetu).
  - **Donut**: segment „Wydałem” + szary „Zostało”, kwota „zostało” w środku.
- Wybór wariantu w Ustawieniach, zapis tylko na telefonie (jak motyw i język, `expo-sqlite/kv-store`).
- Brak moich wydatków: bez wykresu, tekst „Nie masz jeszcze wydatków” + „Twój budżet: Z na wyjazd” (A4).
- Dotknięcie wykresu otwiera zakładkę Budżet (`/expenses`) (A7).
- Dostępność: wykres jest przyciskiem z `accessibilityLabel` „Pokaż budżet” i `accessibilityValue` z kwotami (wydałem / zostało / z ilu); sam rysunek ukryty przed czytnikiem.
- Stany: loading (skeleton w karcie), error wydatków (tekst + „Spróbuj ponownie”), empty (A4), offline (dane lokalne, baner już jest).
- Kolory i rozmiary z tokenów motywu (`brand`, `background.sunken`, `budget.over` przy przekroczeniu), teksty przez i18n PL/EN.

## Struktury danych (Zod)
- `src/schemas/preferences.ts`: `ChartStylePreferenceSchema = z.enum(['line', 'bar', 'donut'])` (domyślnie `'line'`).
- `src/schemas/expense.ts`: `DailySpendSchema = z.object({ spentOn: IsoDateSchema, spentMinor: z.int().nonnegative() })` — punkt wykresu liniowego (wynik czystej funkcji, jak `ExpenseDay`).
- Bez migracji, bez zmian w Supabase.

## Testy
- `src/lib/__tests__/expense-budget.test.ts`: `dailySpend(expenses, memberId, startDate, endDate)` — każdy dzień wyjazdu ma punkt (0 gdy brak), sumuje tylko wydatki tej osoby, pomija usunięte (`deletedAt`), nie liczy wydatków spoza dni wyjazdu (patrz P1).
- `src/data/__tests__/preferences.test.ts`: odczyt/zapis `chartStyle`, nieznana lub brakująca wartość → `'line'`.
- `src/hooks/__tests__/usePreferences.test.ts`: `setChartStyle` zapisuje i zmienia stan.
- `src/features/profile/__tests__/SettingsScreen.test.tsx`: wiersz „Wykres budżetu” pokazuje bieżący wariant, wybór zmienia go.
- `src/features/home/__tests__/TripSpendChart.test.tsx`: dla każdego wariantu renderuje właściwy wykres (biblioteka zamockowana w teście), etykieta dostępności z kwotami, przekroczenie budżetu („Przekroczono o X”), tap wywołuje `onPress`.
- `src/features/home/__tests__/CurrentTrip.test.tsx` (lub istniejący test Home): karta pokazuje wykres zamiast stawki dziennej; empty bez wykresu; loading; error z ponowieniem; „Zmień” tylko organizator; znajomy widzi swoje kwoty; tap → `/expenses`.

## Pliki
- `package.json`, `pnpm-lock.yaml` (krok 1, orchestrator)
- `src/schemas/preferences.ts`, `src/data/preferences.ts`, testy (krok 2)
- `src/schemas/expense.ts`, `src/lib/expense-budget.ts`, testy (krok 3)
- `src/hooks/usePreferences.ts`, `src/features/profile/SettingsScreen.tsx`, `src/i18n/locales/{pl,en}.json`, testy (krok 4)
- `src/features/home/TripSpendChart.tsx` (nowy), `src/i18n/locales/{pl,en}.json`, testy (krok 5)
- `src/features/home/CurrentTrip.tsx`, `src/i18n/locales/{pl,en}.json`, testy (krok 6)
- `docs/architecture/flows/features/trip-home.md`, `profile-settings.md`, `docs/architecture/frontend.md`, `shared.md`, `overview.md` (zależność), `decisions.md` (krok 7)
- `.claude/agents/CveAuditor.md` + wpis w `docs/agents/subagents.md` / `CLAUDE.md` — subagent cve-auditor (commit 0a13250, cherry-pick z `chore/cve-auditor`; Kacper 2026-11-20: część tej zmiany)
- `app.json` (`android.package` `com.baxton.traveling`, `extra.eas.projectId`, `owner` `baxton`), `eas.json` (nowy, profil `development`: debug APK) — wynik `eas init`, potrzebne do dev buildu w chmurze (orchestrator)

## Skille
- test-driven-development — kroki 2–6 — test najpierw, red przed kodem
- security-and-hardening — krok 1 — audyt CVE nowych zależności
- frontend-ui-engineering — kroki 4–6 — dostępność i stany ekranu

## Kroki
- [x] 1. [orchestrator] Audyt CVE `react-native-gifted-charts` i `expo-linear-gradient`, potem `pnpm expo install` obu; `pnpm typecheck` i testy zielone — skill: security-and-hardening — weryfikacja: znalezisko CVE (EXISTS/UNKNOWN) → pytam Kacpra przed instalacją
- [x] 2. [backend] `ChartStylePreferenceSchema` + odczyt/zapis w `src/data/preferences.ts` — równolegle z 3 — skill: test-driven-development — najpierw testy: `preferences.test.ts` — weryfikacja: verifier, `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [x] 3. [backend] `DailySpendSchema` + `dailySpend()` w `src/lib/expense-budget.ts` — równolegle z 2 — skill: test-driven-development — najpierw testy: `expense-budget.test.ts` — weryfikacja: verifier, j.w.
- [x] 4. [frontend] `usePreferences.chartStyle` + wiersz w Ustawieniach (Liniowy / Słupkowy / Donut) — po 2 — skill: test-driven-development — najpierw testy: `usePreferences.test.ts`, `SettingsScreen.test.tsx` — weryfikacja: verifier, j.w.
- [x] 5. [frontend] `TripSpendChart` (trzy warianty, a11y, tokeny, i18n) — po 1 i 3, równolegle z 4 (klucze i18n w innej sekcji pliku; jeśli kolizja → po 4) — skill: test-driven-development, frontend-ui-engineering — najpierw testy: `TripSpendChart.test.tsx` — weryfikacja: verifier, j.w.
- [x] 6. [frontend] Karta „Budżet” w `CurrentTrip` z wykresem, stanami i tapem do `/expenses` — po 4 i 5 — skill: test-driven-development, frontend-ui-engineering — najpierw testy: test Home — weryfikacja: verifier, j.w.; potem cve-auditor (pełny audyt) i tester na urządzeniu (nowa natywna zależność → nowy dev build)
- [x] 7. [orchestrator] Docs + verifier końcowy gałęzi (CodeRabbit) — weryfikacja: verifier końcowy

Gałąź: jedna, `feature/trip-spend-chart`, commit na krok.

## Dziennik postępu
- Krok 1: `react-native-gifted-charts@1.4.81` (+ `gifted-charts-core@0.1.83`) i `expo-linear-gradient@58.0.3` — przypięte wersje starsze niż 2 tygodnie (1.4.82/1.4.83 wydane 2026-11-17, pominięte). `pnpm audit`: 0 znalezisk przez nowe pakiety (23 istniejące pochodzą z `expo > @expo/cli`, bez zmian) → CLEAN. Suite 220/4383 zielone, typecheck i lint zielone · użyty skill: security-and-hardening · commit 42f9f44
- Krok 2: testy napisane (red ✓: `readChartStylePreference` is not a function) · `ChartStylePreferenceSchema`, klucz `preference.chartStyle`, fallback `'line'` · green ✓ (7/7) · verifier PASS, typecheck i lint ✓ · użyty skill: test-driven-development · commit 1b5f599
- Krok 3: testy napisane (red ✓: 8 nowych testów, `dailySpend` is not a function) · `DailySpendSchema` + `dailySpend()` (dni w UTC, do min(dziś, koniec)) · green ✓ (25/25) · verifier PASS, typecheck i lint ✓ · użyty skill: test-driven-development · commit 211cc69
- Krok 4: testy napisane (red ✓: brak `chartStyle`/`setChartStyle`, brak wiersza) · `usePreferences.chartStyle`, wiersz „Wykres budżetu” między Motyw i Język, arkusz z SegmentedControl; klucze `settings.chartStyle`, `settings.chart.{line,bar,donut}`; zaktualizowany `settings-list.test.tsx` (7 wierszy, bez osłabiania asercji) · green ✓ (850 w hooks/profile/app) · verifier PASS · użyty skill: test-driven-development · commit cc6ed01 (zawiera też klucze `home.*` z kroku 5 — ten sam plik)
- Krok 5: testy napisane (red ✓: brak modułu) · `TripSpendChart` (line/bar/donut, gifted-charts zamockowane w testach) · pierwszy verifier FAIL (szerokość zgadywana z okna → wychodziła poza kartę; zła suma w accessibilityValue przy przekroczeniu; literał grubości linii; braki testów) → poprawki: szerokość z onLayout, suma = wydane + zostało, osobny tekst `home.chartValueOver`, token `iconography.strokeWidth`, +7 testów · green ✓ (84 w home) · verifier PASS · użyte skille: test-driven-development, frontend-ui-engineering · odstępstwo: przekroczenie pokazuje istniejący tekst `budget.over` („X ponad budżet”) zamiast „Przekroczono o X” · commit a3b888c
- Krok 6: karta „Budżet” z `TripSpendChart` (loading skeleton, error + ponów, empty A4, offline z lokalnych danych, tap → `/expenses`, „Zmień” tylko organizator, styl wykresu czytany ponownie przy powrocie na Home) · usunięty nieużywany `home.perDayGroup` · poprawki po audycie: kolejność importów, asercja banera offline w teście offline; testy znajomego/organizatora potwierdzone jako niepuste (ten sam obiekt podróży) · test offline przeszedł od razu (zachowanie już było, red nie widziany) · verifier PASS (suite 221/4422, typecheck i lint ✓) · uwaga verifiera (nieblokująca): `useMemo([focused])` dla `chartStyle` można zastąpić zwykłym odczytem · cve-auditor pełny audyt: CLEAN (23 znaleziska tylko w `expo > @expo/cli`, dev-only; nowe pakiety bez zgłoszeń) · użyte skille: test-driven-development, frontend-ui-engineering · commit d892207
- Test na urządzeniu (po kroku 6): lokalny dev build (`expo run:android` z `C:/tsc`, także przez `subst X:`) padł 3× na tym samym błędzie ninja (`mkdir` w codegen `react-native-gesture-handler`, za długa ścieżka na Windows) → blocked. Kacper (przez sesję nadrzędną, 2026-11-20): budować przez EAS w chmurze. Repo nie ma `eas.json` ani `projectId` → czekam na Kacpra (logowanie EAS, `eas init`). Tester jeszcze nie uruchomiony.
- Krok 7: docs zaktualizowane (`trip-home.md`, `profile-settings.md`, `frontend.md`, `shared.md`, `overview.md`, `decisions.md`) · commit f383e1f · verifier końcowy (Sonnet 5.5, medium) PASS: suite 221/4422, typecheck, lint, lockfile ✓; CodeRabbit 2 znaleziska: 1 potwierdzone drobne (`CveAuditor.md:28` + `.toml` — tryb pakietu nie porównuje wersji docelowej z zakresem podatności; decyzja Kacpra, poza zakresem funkcji), 1 odrzucone (lockfile zgodny)
- EAS (2026-11-20): Kacper zrobił `eas init` → `app.json` dostał `android.package` `com.baxton.traveling`, `extra.eas.projectId`, `owner` `baxton`; nowy `eas.json` z profilem `development` (`distribution: internal`, `:app:assembleDebug`, APK). Zacommitowane razem z tym wpisem (e5066e1). Katalogi `.agents/skills/*` poza zadaniem — Kacper: zostawić niezacommitowane.
- cve-auditor pełny audyt przed testem na urządzeniu (2026-11-20): CLEAN — zależności bez zmian od kroku 6; 23 znaleziska (node-forge, glob, minimatch) tylko w `expo > @expo/cli` / `@expo/fingerprint`, narzędzia build, NOT AFFECTED.
- Dev build EAS (2026-11-20): build 5677423f, 25 min, debug APK zainstalowany na Pixel_10a (`adb install -r`, bez konfliktu podpisu); JS z Metro tego worktree (port 8083).
- Test na urządzeniu (tester, Pixel_10a, 2026-11-20): **FAIL**. Podróż testowa Warsaw → Jakarta (15.07–4.08.2027, jeszcze się nie zaczęła), budżet 10 500 000 IDR.
  - PASS: S4 tap → Budżet; S5 empty (PL/EN); S6 przekroczenie (`budget.over`, kolor, a11y); S7 offline (baner + dane lokalne); S8 EN; wiersz „Wykres budżetu” w Ustawieniach; donut (treść).
  - FAIL [major]: (1) linie siatki i oś X wychodzą poza prawą krawędź karty (wszystkie warianty); (2) Słupkowy: brak słupków, etykiety osi Y w złej kolejności (1035/690/3450/0); (3) Home nie odczytuje `chartStyle` po powrocie na ekran — nowy styl widać dopiero po restarcie aplikacji.
  - FAIL [minor]: (4) donut, przekroczenie: tekst w środku łamie kod waluty („650 000 I / DR”); (5) etykieta w środku donuta dwa razy w drzewie dostępności; (6) linia bez punktów pokazuje domyślne etykiety osi 10/6/3/0.
  - S2 (linia: dni do dziś, wydatki dzienne) nieweryfikowalny — podróż się nie zaczęła; zachowanie przed startem wyjazdu nie jest w planie (pytanie do Kacpra).
  - SyncIndicator w stanie zsynchronizowanym nic nie rysuje (zgodnie z kodem). Brak crashy i błędów w logach urządzenia.
- Uwaga na krok 6: `usePreferences` trzyma wybór w stanie lokalnym, a Home zostaje zamontowany pod zakładkami → Home musi odczytać wybór przy powrocie na ekran (test).

## Ryzyka i otwarte pytania
Decyzje Kacpra (2026-11-19):
- A1: wykres liniowy domyślny; słupkowy do wyboru w Ustawieniach; biblioteka do zainstalowania.
- A2: linia = ile wydałem dziennie (nie narastająco); słupki = „Wydałem” + „Zostało”.
- A3: karta = wykres + „Zmień” + sync; stawka dzienna znika z karty.
- A4: brak wydatków → tekst + kwota budżetu, bez wykresu.
- A5: donut jako trzecia opcja w Ustawieniach.
- A6: biblioteka `react-native-gifted-charts` (+ `expo-linear-gradient`).
- A7: dotknięcie wykresu → zakładka Budżet.
- A8: wykres pokazuje tylko użytkownika („Ja”), „zostało” liczone z mojego budżetu (stawka × dni − moje wydatki).

Do potwierdzenia razem z akceptacją (moja rekomendacja w nawiasie):
- P1: wydatki z datą przed lub po wyjeździe — na linii ich nie ma (dni = dni wyjazdu), ale liczą się do „Wydałem” i „Zostało”. (tak)
- P2: linia w trakcie wyjazdu — wszystkie dni wyjazdu, przyszłe jako 0. (rysować tylko do dzisiaj; po wyjeździe wszystkie dni)

Decyzje Kacpra (2026-11-20):
- A9: przy przekroczeniu zostaje istniejący tekst `budget.over` („X ponad budżet”) zamiast „Przekroczono o X” (odstępstwo z kroku 5 zaakceptowane).
- A10: subagent **cve-auditor** wchodzi w tę zmianę; pełny audyt (`pnpm audit` + werdykt EXISTS / NOT AFFECTED / UNKNOWN) przed każdym testem na urządzeniu; EXISTS/UNKNOWN → pytam Kacpra.

Ryzyka:
- Nowa natywna zależność (`expo-linear-gradient`) wymaga nowego dev buildu przed testem na urządzeniu.
- Konflikt z sesją „budżet solo”: ona zmienia `src/features/expenses/*` i `flows/features/expenses.md`; ten plan ich nie dotyka, więc konfliktu kodu nie ma. Przy solo wykres i tak pokazuje tylko „Ja” — spójne z jej P1.
- Inne równoległe sesje (np. import biletu AI) mogą zmieniać `package.json` / `pnpm-lock.yaml` → możliwy konflikt lockfile przy merge; rozwiązanie: ponowne `pnpm install` po rebase.
- `src/i18n/locales/*.json` zmieniają też inne sesje → możliwe konflikty tekstowe przy merge.
