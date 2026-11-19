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
- `src/features/home/CurrentTrip.tsx`, testy (krok 6)
- `docs/architecture/flows/features/trip-home.md`, `profile-settings.md`, `docs/architecture/frontend.md`, `shared.md`, `overview.md` (zależność), `decisions.md` (krok 7)

## Skille
- test-driven-development — kroki 2–6 — test najpierw, red przed kodem
- security-and-hardening — krok 1 — audyt CVE nowych zależności
- frontend-ui-engineering — kroki 4–6 — dostępność i stany ekranu

## Kroki
- [ ] 1. [orchestrator] Audyt CVE `react-native-gifted-charts` i `expo-linear-gradient`, potem `pnpm expo install` obu; `pnpm typecheck` i testy zielone — skill: security-and-hardening — weryfikacja: znalezisko CVE (EXISTS/UNKNOWN) → pytam Kacpra przed instalacją
- [ ] 2. [backend] `ChartStylePreferenceSchema` + odczyt/zapis w `src/data/preferences.ts` — równolegle z 3 — skill: test-driven-development — najpierw testy: `preferences.test.ts` — weryfikacja: verifier, `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [ ] 3. [backend] `DailySpendSchema` + `dailySpend()` w `src/lib/expense-budget.ts` — równolegle z 2 — skill: test-driven-development — najpierw testy: `expense-budget.test.ts` — weryfikacja: verifier, j.w.
- [ ] 4. [frontend] `usePreferences.chartStyle` + wiersz w Ustawieniach (Liniowy / Słupkowy / Donut) — po 2 — skill: test-driven-development — najpierw testy: `usePreferences.test.ts`, `SettingsScreen.test.tsx` — weryfikacja: verifier, j.w.
- [ ] 5. [frontend] `TripSpendChart` (trzy warianty, a11y, tokeny, i18n) — po 1 i 3, równolegle z 4 (klucze i18n w innej sekcji pliku; jeśli kolizja → po 4) — skill: test-driven-development, frontend-ui-engineering — najpierw testy: `TripSpendChart.test.tsx` — weryfikacja: verifier, j.w.
- [ ] 6. [frontend] Karta „Budżet” w `CurrentTrip` z wykresem, stanami i tapem do `/expenses` — po 4 i 5 — skill: test-driven-development, frontend-ui-engineering — najpierw testy: test Home — weryfikacja: verifier, j.w.; potem audyt CVE i tester na urządzeniu (nowa natywna zależność → nowy dev build)
- [ ] 7. [orchestrator] Docs + verifier końcowy gałęzi (CodeRabbit) — weryfikacja: verifier końcowy

Gałąź: jedna, `feature/trip-spend-chart`, commit na krok.

## Dziennik postępu

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

Ryzyka:
- Nowa natywna zależność (`expo-linear-gradient`) wymaga nowego dev buildu przed testem na urządzeniu.
- Konflikt z sesją „budżet solo”: ona zmienia `src/features/expenses/*` i `flows/features/expenses.md`; ten plan ich nie dotyka, więc konfliktu kodu nie ma. Przy solo wykres i tak pokazuje tylko „Ja” — spójne z jej P1.
- Inne równoległe sesje (np. import biletu AI) mogą zmieniać `package.json` / `pnpm-lock.yaml` → możliwy konflikt lockfile przy merge; rozwiązanie: ponowne `pnpm install` po rebase.
- `src/i18n/locales/*.json` zmieniają też inne sesje → możliwe konflikty tekstowe przy merge.
