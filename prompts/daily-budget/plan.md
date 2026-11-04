# Zadanie: dzienny budżet na osobę (razem / osobno)
Status: w trakcie (zaakceptowany 2026-11-04)

## Zrozumienie i założenia
Dziś podróż ma jedną kwotę `budgetPerPerson` na całą podróż, wspólną dla wszystkich. Przenoszenie niewydanej kwoty na następny dzień już działa (`src/lib/expense-budget.ts`, expenses D7), ale liczy się z kwoty na całą podróż.

Decyzje Kacpra (2026-11-04):
- **B1 — Kwota zawsze na dzień na osobę.** Wpisujesz, ile osoba może wydać dziennie.
- **B2 — Przełącznik „Razem / Osobno”.** „Razem”: jedna kwota dzienna dla wszystkich. „Osobno”: przy każdej osobie (organizator + znajomi) jej własna kwota dzienna. Aplikacja sama liczy sumę na podróż (osoby i grupy).
- **B3 — Zapisywana jest kwota dzienna.** Zmiana dat podróży zmienia sumę, nie kwotę dzienną (100 zł/dzień × 5 → × 7 dni).
- **B4 — Edycja jak w kreatorze.** Arkusz „Budżet” na ekranie głównym dostaje ten sam przełącznik i listę osób.
- **B5 — Stare podróże:** migracja `kwota dzienna = floor(suma ÷ liczba dni)`, ta sama dla wszystkich.
- **B7 — (2026-11-04, po weryfikacji)** Niewysłane zmiany budżetu w starym kształcie są odrzucane przy migracji SQLite v6.
- **B8 — (2026-11-04)** Backfill B5 daje minimum 1 jednostkę minor dziennie (`greatest(1, suma / dni)`), bo kwota dzienna musi być > 0.
- **B6 — Przenoszenie bez zmian w zasadzie:** niewydana kwota przechodzi na następny dzień, przekroczenie zmniejsza następny dzień (D7). Pula osoby = jej kwota dzienna × liczba dni.

Założenia do potwierdzenia przy akceptacji:
- **A1 — Bez kolumny „tryb”.** Zapisujemy zawsze kwotę dzienną każdej osoby; „Razem” w UI ustawia wszystkim tę samą. Arkusz otwiera się w „Razem”, gdy wszystkie kwoty są równe, inaczej w „Osobno”.
- **A2 — Kwota organizatora w `trips`, znajomych w `trip_members`** (organizator nie jest wierszem `trip_members`; w wydatkach `memberId = null` = organizator).
- **A3 — Ostatnia zmiana wygrywa** dla całego budżetu podróży naraz (jak dziś `budgetUpdatedAt`), offline przez istniejącą kolejkę `trip_budget_changes`.

## Podejście
1. Zod: `budgetPerPerson` → `dailyBudget` (Money, w walucie bazowej) na podróży; `dailyBudgetMinor` na członku. `TripBudgetChange` niesie kwotę organizatora + listę `{ memberId, dailyBudgetMinor }`.
2. Migracja: nowe kolumny, przeliczenie starych danych (B5), `create_trip` i nowe RPC `set_trip_budget` (atomowo podróż + członkowie, ostatnia zmiana wygrywa). Regeneracja typów, test parzystości.
3. Logika: `computeExpenseBudget` bierze kwotę dzienną per osoba (pula = dzienna × dni). `perPersonPerDay` zbędne → usunąć, gdy nic go nie używa.
4. Dane: repozytorium, SQLite (nowa kolumna/tabela kwot członków), `budget-sync`.
5. UI: krok „Budżet” w kreatorze (przełącznik + lista osób + suma na podróż), podsumowanie, arkusz „Budżet”, `BudgetHero`/Wydatki. i18n PL/EN.

## Struktury danych (Zod)
- `TripSchema`: `dailyBudget: MoneySchema` zamiast `budgetPerPerson`; `budgetUpdatedAt` zostaje.
- `TripMemberSchema`: `dailyBudgetMinor: z.int().positive()`.
- `BudgetStepInputSchema` / `TripBudgetFormSchema`: `{ mode: 'shared' | 'individual', organizerDailyMinor, members: { memberId, dailyMinor }[] }` (tryb tylko w formularzu, A1); każda kwota dodatnia.
- `TripBudgetChangeSchema`: `{ tripId, organizerDailyBudget: Money, members: { memberId, dailyBudgetMinor }[], updatedAt }`.
- `ExpenseBudgetInput`: `organizerDailyMinor`, `members: { id, displayName, dailyBudgetMinor }[]` zamiast `budgetPerPersonMinor`.

## Testy
- Schematy: dodatnie kwoty, waluta = bazowa, tryb „Razem” daje wszystkim tę samą kwotę.
- `expense-budget`: różne kwoty dzienne osób; przeniesienie niedowydanej kwoty na dzień 2; przekroczenie zmniejsza dzień 2; suma grupy = suma osób; zmiana liczby dni zmienia pulę (B3).
- SQL (`supabase/tests`): migracja B5 (suma 700 / 7 dni → 100), `set_trip_budget` + RLS (tylko właściciel), ostatnia zmiana wygrywa.
- Dane: zapis offline i synchronizacja zmiany budżetu z kwotami członków.
- UI: przełącznik w kreatorze i arkuszu, otwieranie w „Osobno” przy różnych kwotach, błędy walidacji, suma na podróż.

## Pliki
`src/schemas/{trip,member,trip-budget,create-trip-form,expense}.ts`, `supabase/migrations/<nowa>.sql`, `supabase/tests/*`, `src/data/{database.types,trip-rows,trip-repository,supabase-trip-repository,local-store,local-db,budget-sync}.ts`, `src/lib/{expense-budget,trip-days}.ts`, `src/test/fixtures.ts`, `src/app/trips/new/{budget,summary}.tsx`, `src/features/trip-create/draft.ts`, `src/features/home/{BudgetSheet,CurrentTrip}.tsx`, `src/features/expenses/{ExpensesScreen,BudgetHero}.tsx`, `src/i18n/locales/{pl,en}.json`, docs: `docs/architecture/{shared,backend,decisions}.md`, flow wydatków.

## Skille
- test-driven-development — wszystkie kroki — TDD obowiązkowe.
- frontend-ui-engineering — kroki 5–6 — nowe UI wg `context/design-context.md`.

## Kroki
Gałąź: `feature/daily-budget`, commit na krok.
- [x] 1. [backend] Zod: nowe pola i formularz budżetu (B1–B3, A1) — skill: TDD — najpierw testy: schematy — weryfikacja: pełny zestaw, typecheck.
- [x] 2. [backend] Migracja + `create_trip` + `set_trip_budget` + przeliczenie starych danych (B5), regeneracja typów, parzystość — skill: TDD — najpierw testy: SQL — weryfikacja: testy SQL + parzystość.
- [x] 3. [backend] `expense-budget.ts` na kwotach dziennych per osoba (B6) — skill: TDD — najpierw testy: lista z sekcji Testy — weryfikacja: pełny zestaw.
- [x] 4. [backend] Repozytorium, SQLite, `budget-sync` — skill: TDD — najpierw testy: zapis offline + sync — weryfikacja: pełny zestaw.
- [x] 5. [frontend] Kreator: krok „Budżet” z przełącznikiem i listą osób + podsumowanie — skill: TDD, frontend-ui-engineering — weryfikacja: pełny zestaw + tester.
- [x] 6. [frontend] Arkusz „Budżet” (B4) i ekran Wydatków — skill: TDD, frontend-ui-engineering — weryfikacja: pełny zestaw + tester.
- [ ] 7. Docs: `shared.md`, `backend.md`, `decisions.md`, flow wydatków.

## Dziennik postępu
- Krok 1: testy schematów napisane (red ✓, 37 porażek) · `dailyBudget` na podróży, `dailyBudgetMinor` na członku, nowy `BudgetStepInputSchema` (`mode`, `organizerDailyMinor`, `friendDailyMinor[]`), `TripBudgetChange` z listą członków, klucz `validation.budgetSharedMismatch` · warstwa danych tylko zmostkowana (TODO kroki 2 i 4) · green dla schematów ✓; typecheck/testy UI i test parzystości czerwone do czasu kroków 2, 3 i poprawek UI · użyty skill: TDD · **odstępstwo:** zmiana nazwy pola psuje UI, więc kroki 1–3 + minimalne poprawki UI (frontend) weryfikuję razem jako jedną całość; dopiero wtedy pełny zestaw jest zielony.
- Krok 3: testy napisane (red ✓, 14 porażek) · `ExpenseBudgetInput` z `organizerDailyMinor` i `members[].dailyBudgetMinor`, pula = dzienna × dni, D7 bez zmian · nowe testy: różne kwoty osób, dłuższa podróż zwiększa pulę, nie kwotę dzienną · green ✓ (`src/lib`, lint) · użyty skill: TDD · weryfikacja razem z krokami 1–2.
- Krok 2: migracja `20261104120000_daily_budget.sql` (`trips.daily_budget_minor`, `trip_members.daily_budget_minor`, backfill B5 = `greatest(1, suma / dni)`, usunięty `budget_per_person_minor`, `create_trip` odtworzone, nowe RPC `set_trip_budget` security definer: 42501 nie właściciel, 22023 obcy członek, starsza zmiana ignorowana) · `trip-rows.ts` i `budget-sync.ts` (RPC) z testami · parzystość ✓ · **niezweryfikowane:** `pnpm test:db` nie uruchomione (Docker nie działa), `database.types.ts` poprawione ręcznie — do ponownego `pnpm db:types` · użyty skill: TDD.
- Krok 4: testy napisane (red ✓) · SQLite wersja 6: `trip_budget_changes.members_json`, stare wpisy kolejki usunięte · `setBudget(trip, { organizerDailyMinor, members })` jedna zmiana w kolejce, walidacja `TripBudgetChangeSchema` · `markBudgetSynced` aktualizuje kwoty członków w kopii offline · green ✓ (`src/data`, `src/schemas`, `src/providers`, lint) · zostaje wywołanie w `src/hooks/useTrips.ts` (krok 6) · niesprawdzone na urządzeniu · użyty skill: TDD.
- Krok 5: testy napisane (red ✓: draft 5, krok Budżet 23) · kreator: Razem/Osobno, pole dzienne na osobę ("Ty" + znajomi), sumy na podróż i dla grupy, podsumowanie z kwotami dziennymi · minimalne poprawki UI: `ExpensesScreen`, `CurrentTrip` (bez sumy na podróż do kroku 6), `BudgetSheet` (tylko kwota organizatora do kroku 6), `useTrips` · copy PL/EN zaproponowane przez orkiestratora — do akceptacji Kacpra · `perPersonPerDay` nieużywane · pełny zestaw ✓ (3384), typecheck ✓, lint ✓ · użyty skill: TDD, frontend-ui-engineering.
- Weryfikacja kroków 1–5: FAIL — blocker: odrzucanie starej kolejki bez decyzji (→ B7), drobne: martwe `perPersonPerDay`, test backfillu na literałach, zdublowana reguła trybu „Razem”, nieaktualny komentarz w `budget-sync.test.ts`, brak klucza `validation.friendCountMismatch` w i18n, minimum 1 (→ B8). Poprawki w toku.
- Weryfikacja 2: FAIL — blok B5 w `trips_rls.sql` po `rollback`; brak testu błędu RPC (okazał się istnieć). Poprawione: B5 w transakcji, usunięty grant `authenticated` na `private.daily_from_total`.
- Weryfikacja 3: PASS (3383 testy, typecheck ✓, lint ✓). Niezweryfikowane: `pnpm test:db`, regeneracja `database.types.ts`. Commit kroków 1–5 jednym commitem (pliki przeplecione).
- Krok 2 domknięty (Docker): migracja zastosowana na lokalnej bazie — 3 stare podróże przeliczone poprawnie (100000/3 dni → 33333, członkowie tak samo) · `supabase gen types` identyczne z ręczną wersją · poprawiony payload członka w `trips_rls.sql` (brak `daily_budget_minor`) · wszystkie 7 plików `supabase/tests` przechodzą (przez `docker exec`, brak lokalnego psql).
- Krok 6: `BudgetSheet` z Razem/Osobno (otwiera w Osobno przy różnych kwotach, zapis pełnej listy członków), karta na ekranie głównym: kwota dzienna lub suma grupy dziennie (`home.perDayGroup`) + suma na podróż · Wydatki bez zmian (już liczą pule per osoba) · red: agent nie uruchomił testów przed implementacją — orkiestrator potwierdził po fakcie (7/10 nowych pada na starym komponencie) · green ✓ · użyty skill: TDD, frontend-ui-engineering.

- Weryfikacja kroku 6: FAIL — `BudgetSheet` bez `ScrollView` (przy wielu osobach „Zapisz” poza ekranem); **odstępstwo procesowe:** red nowych testów potwierdzony dopiero po implementacji (orkiestrator, 7/10 pada na komponencie z HEAD). Poprawka: `ScrollView` (`budget-scroll`), „Zapisz” poza nim, test z 9 osobami (red tylko na brakującym `testID` — znów nie prawdziwy red) · ponowna weryfikacja kroku 6: PASS (3393 testy, typecheck ✓, lint ✓).
- Krok 7: zaktualizowane `shared.md`, `backend.md`, `decisions.md`, `flows/features/trip-budget.md`, `overview.md`, `context/app-context.md`.

## Ryzyka i otwarte pytania
- Zmiana kształtu `TripBudgetChange`: wpisy w lokalnej kolejce ze starym kształtem — proponuję je odrzucić przy migracji SQLite (serwer i tak ma B5).
- Dodawanie znajomych po utworzeniu podróży jeszcze nie istnieje; gdy powstanie, nowa osoba dostanie kwotę „Razem” — do decyzji wtedy.
