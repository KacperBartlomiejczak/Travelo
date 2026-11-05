# Zadanie: dzienny budżet na osobę (razem / osobno)
Status: zrobione (R5–R6 i nowy zrzut kroku Budżet wypchnięte 2026-11-05; zostaje sprawdzenie na iOS)

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
- [x] 7. Docs: `shared.md`, `backend.md`, `decisions.md`, flow wydatków.

## Poprawki po review CodeRabbita (PR #28) — 2026-11-05
CodeRabbit zgłosił 15 uwag (9 w liniach, 1 „follow-up”, 5 drobnych do testów). Explorer (Sonnet) sprawdził je w kodzie: 11 trafnych lub częściowo trafnych, #6 trafna po sprawdzeniu przez orkiestratora, #12–#14 to drobne braki w testach (niesprawdzone w szczegółach, do dopisania); 4 punkty wymagały decyzji Kacpra. Dodatkowo PR ma konflikt z `main` (PR #27) w `docs/architecture/decisions.md` i `overview.md`.

### Decyzje Kacpra (2026-11-05)
- **R-D1 (#9, Major) — stare wersje aplikacji vs migracja.** Migracja usuwa `budget_per_person_minor`, a stary klient wysyła `create_trip` bez `daily_budget_minor` → błąd. Nie ma `eas.json` ani blokady wersji. **Decyzja:** brak warstwy zgodności — aplikacja jest zainstalowana tylko u Kacpra; wpis w `known-limitations.md`.
- **R-D2 (#3) — stare kopie podróży w SQLite.** Po aktualizacji kopia w starym kształcie nie parsuje się, więc offline podróż jest niedostępna do pierwszego otwarcia online. **Decyzja:** zaakceptować, wpis w `known-limitations.md`.
- **R-D3 (#2) — kopia offline po zignorowanej zmianie.** `set_trip_budget` nic nie zwraca, więc zmiana starsza niż serwerowa wygląda jak zapisana; kopia offline może pokazać ją do następnego udanego odczytu. **Decyzja:** zaakceptować, wpis w `known-limitations.md`.
- **Q1 (2026-11-05, po teście na urządzeniu) — Razem → Osobno zachowuje kwoty.** Kwoty znajomych wpisane wcześniej w Osobno nie są nadpisywane kwotą wspólną przy przełączeniu Razem → Osobno (kreator i arkusz). Interpretacja do akceptacji: puste pole znajomego (pierwsze przejście do Osobno) dostaje kwotę wspólną, jak dziś.
- **Q2 (2026-11-05) — koniec podróży = dzień wylotu powrotnego.** Późniejszy przylot powrotny nie wydłuża podróży ani budżetu; bez zmian w `trip-dates.ts`.
- **Q3 (2026-11-05) — kolejność osób jak wpisano** (karta, arkusz, Wydatki; podsumowanie kreatora już tak działa). Dziś `trip-rows.ts:129` sortuje alfabetycznie, a `trip_members` nie ma kolumny kolejności (wszyscy członkowie mają ten sam `created_at` z jednej transakcji `create_trip`), więc potrzebna jest nowa kolumna. **Decyzja:** osobne zadanie (osobna gałąź i plan), nie na tej gałęzi.
- **Q4 (2026-11-05) — dialog „Odrzucić wpisane dane?” przy cofnięciu z kreatora zostaje** bez zmian.
- **Q6 (2026-11-05, w trakcie R5) — nowa kwota wpisana w Razem nadpisuje kwoty z Osobno** (kreator i arkusz tak samo). Kwoty z Osobno zostają tylko, gdy w Razem nic nie zmieniono (Q1).
- **Q5 (2026-11-05) — karta solo bez „Razem”.** Na ekranie głównym podróż jednej osoby pokazuje „700 EUR na podróż” (`newTrip.summary.soloTotal`, jak kreator i podsumowanie), grupa dalej „Razem … na podróż”.
- **R-D4 (#8) — górny limit kwoty.** Suma `dzienna × dni × osoby` może teoretycznie przekroczyć `Number.MAX_SAFE_INTEGER`. **Decyzja:** pominąć (tylko absurdalne kwoty).

### Kroki
- [x] R0. [orkiestrator] Scalić `origin/main` do `feature/daily-budget`, rozwiązać konflikty w `decisions.md` i `overview.md` (zachować oba wpisy); pełny zestaw testów zielony.
- [x] R1. [frontend] Poprawki zachowania — skill: TDD — najpierw testy dla każdego punktu:
  - #4 tapnięcie aktywnego segmentu nie wywołuje `onChange` (`SegmentedControl`: pomija, gdy `option.value === value`) → kwoty w trybie Osobno nie są nadpisywane (arkusz i kreator);
  - #10 błąd „kwota > 0” dopiero po „Dalej”/„Zapisz” (`budget.tsx:40`, `BudgetSheet.tsx:55`), wpisywanie „0,50” bez błędu;
  - #7 `withCompanionCount` przycina `budget.friendAmountTexts` do liczby znajomych (`draft.ts`);
  - #1 po nieudanym „Dalej” kreator przewija do pierwszego błędnego pola (jak `friends.tsx`, `scrollRef`);
  - #5 iOS: arkusz „Budżet” przewija aktywne pole nad klawiaturę — wyeksportować `useScrollFocusedFieldIntoView` z `WizardScreen.tsx` i użyć w `BudgetSheet`;
  - testy z uwag #11 (assert `ScrollView`) i #12 (kreator przekazuje kwoty Osobno dalej) — weryfikacja: pełny zestaw.
- [x] R2. [backend] Testy z uwag #13 (zapis offline bez wywołania RPC), #14 (`trip-rows`: różne kwoty znajomych), #15 (`trips_rls.sql`: drugie wywołanie z tym samym czasem i innymi kwotami nie zmienia danych) — skill: TDD — weryfikacja: pełny zestaw + `supabase/tests` przez `docker exec`.
- [x] R3. [orkiestrator] Docs: wiersz `/` w `frontend.md` (karta „Budżet”: kwota dzienna lub suma grupy dziennie + suma na podróż — #6); `known-limitations.md`: R-D1, R-D2, R-D3.
- [x] R4. Weryfikator na R0–R3, commit na krok, push, odpowiedzi na komentarze CodeRabbita w PR (co poprawione, co świadomie pominięte i dlaczego).

## Poprawki po teście na urządzeniu (Q1, Q5) — 2026-11-05 — zaakceptowane przez Kacpra 2026-11-05
- [x] R5. [frontend] — skill: TDD — najpierw testy (red ✓ przed kodem):
  - Q1 kreator (`src/app/trips/new/budget.tsx`, `setMode`): Osobno 100/80/50 → Razem → Osobno zachowuje 80 i 50; puste pole znajomego dostaje kwotę wspólną; tapnięcie aktywnego segmentu dalej nic nie zmienia;
  - Q1 arkusz (`src/features/home/BudgetSheet.tsx`, `changeMode`): to samo w obrębie jednego otwarcia arkusza (zapis w Razem dalej daje wszystkim jedną kwotę, A1);
  - Q5 karta (`src/features/home/CurrentTrip.tsx:224`): solo → `newTrip.summary.soloTotal` („700 EUR na podróż”), grupa → `newTrip.summary.totals` bez zmian; bez nowych kluczy i18n;
  - weryfikacja: pełny zestaw, typecheck, lint, verifier; tester na emulatorze (Metro z tej gałęzi): przełączanie Razem/Osobno w kreatorze i arkuszu, karta solo.
- [x] R6. Commit, push do PR #28, aktualizacja `docs/architecture/flows/features/trip-budget.md` (zachowanie przełącznika) — orkiestrator.
- R5 dziennik: testy red ✓ (3 nowe padały na starym kodzie), Q6 dopasowanie kreatora do arkusza (red ✓ na wersji pośredniej) · weryfikacja 1: FAIL — brak testu „puste pole dostaje kwotę wspólną” (mutacja przechodziła) → dopisane 2 testy (red ✓ na mutacji) · weryfikacja 2: PASS (3663 testy, typecheck ✓, lint ✓). Uwaga weryfikatora: reguła Razem→Osobno zdublowana w `budget.tsx` i `BudgetSheet.tsx` (znane z R1). Zostaje tester.
- R5 tester (emulator, Metro 8084, lokalny Supabase): PASS — kreator: Osobno 100/80/50 → Razem → Osobno zachowane, Razem 120 → wszyscy 120, wyczyszczone pole dostaje kwotę; arkusz: zapis Osobno, ponowne otwarcie w Osobno, te same przejścia, zapis Razem → karta „120 EUR dziennie na osobę”, „Razem 1 440 EUR na podróż”; karta solo „910 EUR na podróż” bez „Razem”. Osobno → Razem pokazuje kwotę organizatora (istniejące zachowanie, opisane w flow). Niesprawdzone: tapnięcie aktywnego segmentu na urządzeniu (pokryte testem R1), jasny motyw, EN. Dane: podróż 10–13 lis ma teraz 120 EUR/os.
Uwaga: lokalna baza w Dockerze ma już migrację z `feature/member-order` (`create_trip` wymaga `position`), więc tworzenie podróży ze znajomymi z tej gałęzi na lokalnej bazie pada (23502). Dla testera R5: przełącznik testować bez zapisu nowej podróży albo na podróży solo / istniejących podróżach; reset bazy tylko za zgodą Kacpra.

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
- Krok 7: zaktualizowane `shared.md`, `backend.md`, `decisions.md`, `flows/features/trip-budget.md`, `overview.md`, `context/app-context.md`; po weryfikacji (FAIL: stare sformułowania o budżecie na całą podróż) też `frontend.md`, `README.md` i notki „Superseded” w `decisions.md` · ponowna weryfikacja: PASS. Do zrobienia: zrzut `docs/screenshots/wizard-budget.png` pokazuje stary krok.
- 2026-11-04: Kacper zaakceptował copy PL/EN z poprawką „Czego nie wydasz…” (test red ✓ → green ✓, 3393). Zostaje test na telefonie.
- 2026-11-04 test na emulatorze (tester, lokalny Supabase, Metro 8082, konto testowe): PASS — scen. 5 (karta: suma grupy dziennie + suma na podróż, arkusz otwiera Osobno), 6 (8 osób: przewijanie, „Zapisz” przypięty), 7 (offline: „Czeka na wysłanie”, potem sync), 8 (Wydatki: pule per osoba, „+900 z poprzednich dni”), 9 arkusz solo; jasny/ciemny ✓. NIE URUCHOMIONE: scen. 1–4 i nagłówek kreatora solo — kreator blokuje krok lotów: pole „Przylot” zapisuje do „Wylot” (poza zakresem tej gałęzi; ekran lotów i `DateTimeField` niezmienione). Uwagi spoza zakresu: aktualna podróż przeskakuje między ekranami po zapisie budżetu (seedowane podróże miały identyczne daty); „Zapisz” czasem wymagał drugiego tapnięcia przy otwartej klawiaturze. Dane testowe (3 podróże, 1 wydatek, profil `tester_budget`) zostały w lokalnej bazie.

## Ryzyka i otwarte pytania
- Zmiana kształtu `TripBudgetChange`: wpisy w lokalnej kolejce ze starym kształtem — proponuję je odrzucić przy migracji SQLite (serwer i tak ma B5).
- Dodawanie znajomych po utworzeniu podróży jeszcze nie istnieje; gdy powstanie, nowa osoba dostanie kwotę „Razem” — do decyzji wtedy.
- R0: scalony `origin/main` (PR #27); konflikty w `decisions.md` (oba wpisy) i `overview.md` (wiersz Home z tej gałęzi, Profile z main) · 3648 testów ✓, lint ✓, typecheck ✓ po odświeżeniu wygenerowanych typów tras `.expo/types`.
- R2: testy #13 (zapis offline bez RPC), #14 (różne kwoty znajomych w `trip-rows`), #15 (`trips_rls.sql`: ten sam `updated_at`, inne kwoty → bez zmian) · każdy sprawdzony mutacją kodu (red ✓ → przywrócone, green ✓) · dodatkowo naprawiony `supabase/tests/account_delete.sql` z PR #27 (stara kolumna `budget_per_person_minor`) · wszystkie 8 plików `supabase/tests` ✓, `src/data` 875 ✓, lint ✓.
- R3: `frontend.md` (wiersz `/`: karta „Budżet”), `known-limitations.md` (R-D1–R-D4 + błąd wyboru przylotu w kreatorze).
- R1: #4 `SegmentedControl` pomija aktywną opcję (red ✓ ×3), #10 błąd zera dopiero po „Dalej”/„Zapisz” (red ✓ ×2), #7 `withCompanionCount` przycina kwoty znajomych (red ✓), #1 przewinięcie do pierwszego błędnego pola w kreatorze (red ✓), #5 `useScrollFocusedFieldIntoView` wyeksportowany i użyty w `BudgetSheet` (red ✓), testy #11 i #12 (tylko asercje, bez red — kod był już poprawny) · 3657 testów ✓, typecheck ✓, lint ✓ · niesprawdzone na iOS.
- Weryfikacja R0–R3: PASS (3657 testów, typecheck ✓, lint ✓, 8/8 plików SQL ✓). Uwagi niewymagające zmian: hook z `WizardScreen` importowany w `BudgetSheet` (przyszłe przeniesienie do wspólnego modułu), `isValidAmount` powtarza regułę z `errorFor`.
- R4: commity 4da32f7 (R1), 801a515 (R2), 2c0a04e (R3), push · odpowiedzi na 9 komentarzy CodeRabbita w liniach + komentarz zbiorczy w PR #28.
- 2026-11-05 błąd „Przylot zapisuje do Wylot”: Kacper zdecydował naprawę na tej gałęzi; tester (Android 17, Expo Go) NIE odtworzył go w 4 przebiegach (Wylot→Przylot, sam Przylot, tapnięcia we współrzędne, lot powrotny) — pola nie nachodzą na siebie, logi czyste. Niesprawdzone warunki: otwarta klawiatura po polu lotniska, przewinięty ekran, nieudane „Dalej”, przełączanie Lot tam/Powrót, EN. **Decyzja Kacpra:** sprawa zamknięta (najpewniej błąd poprzedniego testu), wpis usunięty z `known-limitations.md`; scenariusze 1–4 na lokalnym Supabase. Uwaga: `.env` wskazuje chmurowy projekt — do testów Metro z lokalnym URL tylko w środowisku procesu, `.env` bez zmian.
- 2026-11-05 test kreatora na emulatorze (tester, Android 17, Expo Go, lokalny Supabase, PL, ciemny): scen. 1 Razem (100 EUR × 4 dni × 3 os. = 1 200, karta ✓) PASS · scen. 2 Osobno (100/80/50 → 920, tapnięcie aktywnego segmentu nie nadpisuje, podsumowanie i arkusz otwiera Osobno ✓) PASS · scen. 3 walidacja (brak błędu przy wpisywaniu, błąd po „Dalej”, przewinięcie do pierwszego błędnego pola) PASS częściowo · scen. 4 powrót do lotów: kwoty zachowane, zmiana wylotu powrotnego zmienia sumę (7 dni → 1 610) PASS. NIE URUCHOMIONE: solo, 5 znajomych, jasny motyw, podwójne „Zapisz”, przeskakiwanie podróży. Pytania do Kacpra: (Q1) Razem → Osobno resetuje kwoty znajomych do kwoty wspólnej; (Q2) koniec podróży liczony z wylotu powrotnego, nie z przylotu (`trip-dates.ts`, istniejące zachowanie); (Q3) kolejność osób: kreator wg wpisania, podsumowanie/karta/arkusz alfabetycznie; (Q4) dialog „Odrzucić wpisane dane?” przy cofnięciu (istniejący kreator). Drobne: zębatka dev overlay zasłania nagłówek kroku (tylko dev); po zamknięciu pickera fokus skacze do „Nr lotu” i otwiera klawiaturę.
- 2026-11-05 dokończenie testu na emulatorze (tester, konto `tester_exp1`): A solo — krok budżetu, podsumowanie i arkusz poprawne (bez przełącznika, 100 × 7 = 700), ale karta na ekranie głównym pokazuje „Razem 700 EUR na podróż” zamiast „700 EUR na podróż” (`CurrentTrip.tsx:224` zawsze `newTrip.summary.totals`) → pytanie Q5 · B 5 znajomych Osobno PASS (przewijanie, „Dalej” przypięty, przewinięcie do pustego pola, sumy × 7) · C jasny motyw: karta i arkusz czytelne; krok budżetu kreatora w jasnym NIESPRAWDZONY · D „Zapisz” przy otwartej klawiaturze: 4/4 zapisane za pierwszym tapnięciem, przeskakiwania aktualnej podróży brak (niesprawdzone na podróży-duplikacie z tymi samymi datami). Dane testowe: podróż solo 10–16 lis (130 EUR/dzień), podróż 3 os. 10–13 lis (110 EUR/dzień).
- 2026-11-05 nowy zrzut `docs/screenshots/wizard-budget.png` (emulator, Expo Go, jasny, Osobno 150/120/100 EUR); Kacper zaakceptował mimo zębatki Expo Go nad opisem; podpis w README: „daily, together or per person”.
