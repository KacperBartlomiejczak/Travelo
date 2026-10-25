# Zadanie: Wydatki (ekran z wykresem kto ile wydał, budżet, nadwyżka, timeline, szybkie dodawanie)
Status: w trakcie (zaakceptowany przez Kacpra 2026-10-25)

## Zrozumienie i założenia
Funkcja MVP „Wydatki w trakcie podróży” plus budżetowa część „Plan vs rzeczywistość”, o którą Kacper poprosił 2026-10-25. Zakładka „Wydatki” przestaje być placeholderem i pokazuje od góry:
1. **Pasek podróży** — nazwa bieżącej podróży; kliknięcie otwiera istniejący panel boczny (`TripsDrawer`); wybór podróży zmienia bieżącą podróż w całej aplikacji (D11).
2. **Budżet** — ile zostało, z przełącznikiem **Grupa / Ja** (D9). Pod spodem, w trakcie podróży: „Zostało dziś X” i, gdy dodatnia, „+Y z poprzednich dni” (D7).
3. **Kto ile wydał** — poziomy pasek na każdego podróżnego, podzielony kolorami kategorii (ikona + etykieta w legendzie, design §2.8); każdy wiersz pokazuje wydane i zostało; kliknięcie otwiera kategorie i kwoty tej osoby (D8).
4. **Timeline** — wydatki pogrupowane dniami, najnowsze u góry, nagłówek dnia z sumą dnia; wiersz: ikona kategorii, nazwa, osoba, kwota, status synchronizacji. Kliknięcie → edycja, jeśli wolno (D12).
5. **FAB** nad pigułką nawigacji, tylko na tym ekranie → bottom sheet dodawania wydatku (D14).

„Gotowe” = ekran działa dla organizatora i połączonego znajomego, online i offline, wszystkie cztery stany (ładowanie, pusty, błąd, offline), wszystkie kroki `[x]`, PASS verifiera, pełny zestaw testów + typecheck + lint na zielono, zaktualizowane `Architecture.md` i `context/app-context.md`.

Założenia (zaakceptowane z planem):
- **A1 — Organizator jako wydający.** Organizator nie jest wierszem `TripMember` (trips-supabase A4). Wydatek ma `memberId: uuid | null`, **null = organizator**. Odrzucone: dodanie wiersza członka dla organizatora (dotyka każdej podróży, kreatora i „Podróżnych”).
- **A2 — „Ja” dla połączonego znajomego** = jego własny wiersz członka (`userId` = jego konto). Dla organizatora = `memberId null`.
- **A3 — Dni podróży** = `tripDayCount` / `deriveTripDates` (`src/lib/trip-days.ts`, `trip-dates.ts`), daty w lokalnym dniu kalendarzowym celu podróży, jak w reszcie aplikacji.
- **A4 — Obliczenia na liczbach całkowitych w jednostkach minor**, tylko waluta bazowa (D5). Dzienny limit liczony z `floor` na wartości narastającej, więc zaokrąglenia nie dryfują między dniami.
- **A5 — Data wydatku** = lokalna data (`spentOn: YYYY-MM-DD`) + `createdAt` do kolejności w obrębie dnia. Bez wyboru godziny.
- **A6 — Znajomy bez konta** nigdy nie otwiera aplikacji; jego wydatki wpisuje organizator.

## Decyzje (Kacper)
2026-10-08:
- **D1 — Osobny ekran.** · **D2 — Pigułka nawigacji** (zrobiona, `prompts/pill-nav-and-dialog/plan.md`). · **D4 — Offline-first** zgodnie z `CLAUDE.md` „Offline expenses”.
- ~~D3 — formularz ze zdjęciem paragonu~~ → zastąpione przez D13 (zdjęcie później).

2026-10-25:
- **D5 — Tylko waluta bazowa.** Każdy wydatek jest w `baseCurrency` podróży. Inne waluty + FX = osobna, późniejsza funkcja.
- **D6 — Jedna osoba na wydatek.** *Na przyszłość (nie teraz):* dzielenie rachunku po równo między wybrane osoby.
- **D7 — Nadwyżka narastająco, z karami.** Na osobę: `d = (B − P) / N`, gdzie B = budżet na osobę, P = wydatki tej osoby z datą przed podróżą, N = liczba dni podróży. W dniu podróży `k` (1..N): `allowedToday = floor((B − P) × k / N) − spentOnDays(1..k−1)`; `leftToday = allowedToday − spentToday`; `carryover = floor((B − P) × (k−1) / N) − spentOnDays(1..k−1)` — pokazywane jako „+Y z poprzednich dni”, gdy > 0; ujemna nadwyżka po prostu zmniejsza dzisiejszą kwotę. Grupa = suma osób.
- **D8 — Wykres = poziomy pasek na osobę**, podzielony na kategorie; kliknięcie osoby → jej kategorie z kwotami.
- **D9 — Budżet: domyślnie grupa + przełącznik na „Ja”** (`SegmentedControl`). Zostało grupie = B × liczba podróżnych − wszystkie wydatki. Pod budżetem: wykres kto ile wydał.
- **D10 — Wydatki przed i po podróży liczą się do całości.** Domyślna data = dziś. Przed startem i po końcu podróży nie ma linii „Zostało dziś”.
- **D11 — Pasek podróży otwiera panel boczny**, zmienia się globalna bieżąca podróż.
- **D12 — Timeline dniami, najnowsze u góry.**
- **D13 — Bez zdjęcia paragonu w tej funkcji.** Formularz: nazwa, kwota, kategoria (5 chipów), osoba, data.
- **D14 — FAB tylko na ekranie Wydatki** („z każdego ekranu” później).
- **D15 — Połączeni znajomi zapisują swoje wydatki.** Organizator dodaje, edytuje i usuwa wydatki każdego (także znajomych bez konta). Połączony znajomy widzi wszystkie wydatki podróży i dodaje / edytuje / usuwa **tylko wydatki ze swoim `memberId`**; w jego formularzu pole osoby jest ustawione na „Ty”. Zmienia to dwie zasady w `CLAUDE.md` („Linked members are read-only”, „Only the owner can write expenses”) — krok 0. Konflikty nadal last write wins po `updatedAt`.
- **D16 — Plany tylko po polsku; kilka backendowych subagentów równolegle** (zasady w `CLAUDE.md`). Kroki 2, 3 i 4 tego planu idą równolegle po kroku 1 (niezależne, rozłączne pliki).

## Podejście
Wzorzec synchronizacji budżetu (`src/data/budget-sync.ts`, `src/providers/BudgetSync.tsx`): najpierw SQLite, stan synchronizacji w tym samym wierszu (ta sama transakcja), worker robi upsert po `id` z `where updated_at < excluded.updated_at`, backoff 1 s × 2ⁿ do 5 min, `failed` zostaje widoczne. Wszystkie liczby budżetu to czyste funkcje w `src/lib/expense-budget.ts`, ekran tylko renderuje. Wykres to zwykłe `View` z szerokościami flex (bez nowej zależności).
Odrzucone: agregacja po stronie serwera (RPC) — psuje offline, a danych jest mało.

## Struktury danych (Zod)
`src/schemas/expense.ts`:
```ts
export const ExpenseCategorySchema = z.enum(['food', 'transport', 'stay', 'activities', 'other']);
export const EXPENSE_NAME_MAX_LENGTH = 60;

export const ExpenseSchema = z.object({
  id: z.uuid(),                         // UUID z urządzenia
  tripId: z.uuid(),
  memberId: z.uuid().nullable(),        // null = organizator (A1)
  name: z.string().trim().min(1).max(EXPENSE_NAME_MAX_LENGTH),
  amount: MoneySchema,                  // amountMinor > 0, currency = baseCurrency podróży (sprawdza repozytorium, D5)
  category: ExpenseCategorySchema,
  spentOn: IsoDateSchema,               // lokalna data, A5
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  deletedAt: IsoDateTimeSchema.nullable(),
});
// Pola z CLAUDE.md nieużywane teraz: dayId, activityId (nie ma jeszcze planu dnia), forMemberIds (D6), note (D13).

export const LocalExpenseSchema = ExpenseSchema.extend({
  syncStatus: SyncStatusSchema, syncError: z.string().optional(),
  attempts: z.int().nonnegative(), lastAttemptAt: IsoDateTimeSchema.optional(),
});
// Wiersz lokalny jest swoim własnym wpisem outboxa, jak LocalTripBudgetChange (jedna oczekująca zmiana na id; LWW).

export const ExpenseFormSchema = z.object({
  name: ExpenseSchema.shape.name,
  amountText: /* to samo parsowanie co BudgetStepInputSchema / AmountField */,
  category: ExpenseCategorySchema,      // bez domyślnej przy pierwszym wydatku (design §9.3)
  memberId: ExpenseSchema.shape.memberId,
  spentOn: IsoDateSchema,
});

export const ExpenseRowSchema = /* wiersz serwera w snake_case, parsowany z Supabase */;
```
Typy wyników `src/lib/expense-budget.ts` też jako schematy Zod (`PersonBudgetSchema { memberId, displayName, spentMinor, leftMinor, byCategory: Record<category, int>, today?: { allowedMinor, leftMinor, carryoverMinor } }`, `GroupBudgetSchema`, `ExpenseDaySchema { spentOn, totalMinor, expenses }`).

Serwer: tabela `expenses` odzwierciedla `ExpenseSchema` (`amount_minor bigint check > 0`, `currency char(3)`, `spent_on date`, miękkie usuwanie). RLS: właściciel podróży — select/insert/update każdego wiersza podróży; połączony członek — select wszystkich wierszy podróży, insert/update tylko gdy `member_id` to jego wiersz członka; nikt nie ma twardego delete (miękkie usuwanie to update).

> Uwaga: `CLAUDE.md` „Offline expenses” opisywał osobną tabelę `OutboxEntry`. Jak przy budżecie (trips-supabase), ten plan trzyma stan synchronizacji w wierszu lokalnym — te same gwarancje (ta sama transakcja, ponowienie po id, widoczny status), jedna tabela mniej. Zaakceptowane z planem; `CLAUDE.md` zaktualizowany w kroku 0.

## Testy
- **Krok 1 (schematy):** poprawne / błędne fixture'y dla każdego schematu: pusta / za długa nazwa, kwota 0 / ujemna / ułamkowa, zła waluta, zła data, nieznana kategoria, `memberId` null OK.
- **Krok 2 (migracja, `supabase/tests/expenses_rls.sql`):** właściciel czyta/pisze każdy wydatek swojej podróży; użytkownik A nie czyta/pisze w podróży B; połączony członek czyta wszystkie, dodaje/edytuje swoje, **nie może** zapisać wydatku innego członka ani organizatora (`member_id null`); brak uprawnienia `delete`; upsert po id dwa razy = jeden wiersz; starszy `updated_at` nie nadpisuje nowszego. Parity check przechodzi po regeneracji typów.
- **Krok 3 (obliczenia budżetu):** zostało grupie/osobie; przypadki D7: dzień 1 bez nadwyżki; niedowydanie w dniu 1 → nadwyżka w dniu 2; przekroczenie w dniu 1 → mniej w dniu 2; narastająco przez 3 dni; wydatek przed podróżą zmniejsza `d`; wydatek po podróży liczy się tylko do całości; przed/po podróży → brak `today`; zaokrąglenia: 1000 minor / 3 dni sumuje się dokładnie do 1000; usunięte wydatki pomijane; sumy kategorii; grupowanie timeline'u i kolejność (dzień malejąco, `createdAt` malejąco).
- **Krok 4 (lokalne repozytorium):** zapis tworzy wiersz `pending` bez sieci; edycja podbija `updatedAt`; usunięcie ustawia `deletedAt` i zostaje `pending`; waluta inna niż bazowa odrzucona; odczyt parsowany Zodem, uszkodzony wiersz pominięty i zgłoszony; repozytorium połączonego znajomego odrzuca `memberId`, który nie jest jego.
- **Krok 5 (synchronizacja):** zapis offline → pending; powrót sieci → synced; ten sam wpis ponowiony → bez duplikatu; odmowa serwera → `failed`, widoczne, ponawiane z backoffem; miękkie usunięcie się synchronizuje; pobieranie wydatków innych osób z serwera do SQLite (nowszy `updatedAt` wygrywa, lokalna zmiana pending nie jest nadpisywana).
- **Krok 6 (hooki):** `useExpenses` czyta z SQLite i odświeża się po zapisie; `useCanEditExpense` = właściciel → każdy, połączony → tylko swoje.
- **Kroki 7–10 (UI, testy komponentów):** wypisane przy krokach niżej; plus ręczne kroki testowe dla Kacpra / testera.

## Pliki
- Nowe: `src/schemas/expense.ts` (+ eksport w `index.ts`, testy); `supabase/migrations/<ts>_expenses.sql`; `supabase/tests/expenses_rls.sql`; `src/data/database.types.ts` (regenerowany); `src/data/local-db.ts` (tylko nowa migracja); `src/data/expense-repository.ts`, `expense-rows.ts`, `expense-sync.ts`; `src/lib/expense-budget.ts`; `src/providers/ExpenseSync.tsx` (albo rozszerzenie `BudgetSync.tsx` — decyzja w briefie kroku 5, co mniejsze); `src/hooks/useExpenses.ts`; `src/features/expenses/*` (ExpensesHeader, BudgetHero, SpendByPersonChart, PersonCategoriesSheet, ExpenseTimeline, ExpenseSheet); `src/app/(drawer)/(tabs)/expenses.tsx`; i18n `pl` / `en`; tokeny motywu tylko jeśli design-context już je definiuje.
- Dokumenty (orkiestrator): `CLAUDE.md`, `context/app-context.md`, `Architecture.md`, ten plan.

## Skille
- `domain-modeling` — krok 1 — encja Expense, organizator jako `null`.
- `test-driven-development`, `incremental-implementation` — każdy krok z kodem.
- `supabase-postgres-best-practices`, `security-and-hardening`, `doubt-driven-development` — krok 2 (zmiana RLS dla połączonych członków).
- `doubt-driven-development` — krok 5 (synchronizacja offline).
- `source-driven-development` — kroki 4–5 (`expo-sqlite`, upsert w supabase-js).
- `frontend-design`, `frontend-ui-engineering` — kroki 7–10; `ui-taste` — przegląd verifiera kroków 7–10.
- `git-workflow-and-versioning` — commit + push po każdym PASS.

## Kroki
Każdy krok po PASS: commit, branch `expenses/step-<N>-<slug>` odcięty od brancha ostatniego scommitowanego kroku (krok 0 od `feature/sunline-redesign`), push. Kroki 2, 3, 4 równolegle (D16).
- [x] 0. [docs, orkiestrator] `CLAUDE.md` (zasady D15, kształt Expense, wiersz lokalny jako outbox; reguły D16) i `context/app-context.md` (Wydatki w trakcie) — skill: brak — najpierw testy: brak (tylko dokumenty, bez zachowania) — weryfikacja: verifier sprawdza spójność dokumentów z planem.
- [ ] 1. [backend] Schematy Zod `expense.ts` — skill: domain-modeling, TDD — najpierw testy: fixture'y kroku 1 — weryfikacja: testy, typecheck, lint.
- [ ] 2. [backend, równolegle] Migracja `expenses` + RLS + regenerowane typy + parity — skill: supabase-postgres-best-practices, security-and-hardening, doubt-driven-development — najpierw testy: `expenses_rls.sql` — weryfikacja: `pnpm test:db`, parity, pełny zestaw.
- [ ] 3. [backend, równolegle] `src/lib/expense-budget.ts` (sumy grupy/osoby, dzienny limit D7 + nadwyżka, kategorie, grupowanie timeline'u) — skill: TDD — najpierw testy: lista kroku 3 — weryfikacja: pełny zestaw.
- [ ] 4. [backend, równolegle] Migracja SQLite + lokalne repozytorium wydatków (zapis / edycja / miękkie usunięcie, sprawdzenie waluty bazowej i własnego członka) — skill: TDD, source-driven-development — najpierw testy: lista kroku 4 — weryfikacja: pełny zestaw.
- [ ] 5. [backend] Worker synchronizacji wydatków (wysyłanie pending, pobieranie wydatków podróży, backoff, widoczne failed; te same wyzwalacze co budżet) — skill: TDD, doubt-driven-development — najpierw testy: lista kroku 5 (Verification loop pkt 8) — weryfikacja: pełny zestaw.
- [ ] 6. [frontend] Hooki `useExpenses`, `useSaveExpense`, `useDeleteExpense`, `useCanEditExpense` — skill: TDD — najpierw testy: krok 6 — weryfikacja: pełny zestaw.
- [ ] 7. [frontend] Szkielet ekranu Wydatki: pasek podróży → otwiera panel; stany ładowanie / pusty (brak podróży, brak wydatków) / błąd / offline; BudgetHero z Grupa / Ja i „Zostało dziś” + „+Y z poprzednich dni” — skill: frontend-design, frontend-ui-engineering — najpierw testy: każdy stan się renderuje; przełącznik zmienia liczbę; linia nadwyżki tylko gdy > 0; brak linii „dziś” poza podróżą — weryfikacja: pełny zestaw, ui-taste, kroki ręczne.
- [ ] 8. [frontend] SpendByPersonChart + PersonCategoriesSheet — skill: frontend-design, frontend-ui-engineering, TDD — najpierw testy: wiersz na każdego podróżnego (organizator pierwszy jako „Ty”/nick), szerokości segmentów proporcjonalne, legenda z ikoną + etykietą + wartością, kliknięcie otwiera sheet z kategoriami — weryfikacja: pełny zestaw, ui-taste, ręcznie.
- [ ] 9. [frontend] ExpenseTimeline — skill: frontend-ui-engineering, TDD — najpierw testy: grupy dni od najnowszej, suma dnia, zawartość wiersza, widoczny status synchronizacji, kliknięcie otwiera edycję tylko gdy wolno — weryfikacja: pełny zestaw, ręcznie.
- [ ] 10. [frontend] FAB + ExpenseSheet (dodawanie / edycja / usuwanie z ConfirmDialog) — skill: frontend-design, frontend-ui-engineering, TDD — najpierw testy: walidacja (nazwa, kwota, kategoria wymagane), wybór osoby dla właściciela, stałe „Ty” dla połączonego znajomego, domyślna data dziś, zapis zamyka sheet i timeline + budżet odświeżają się offline, usunięcie znika z timeline'u — weryfikacja: pełny zestaw, ui-taste, ręcznie (tester na urządzeniu).
- [ ] 11. [docs, orkiestrator] `Architecture.md`, app-context „zrobione”, status planu zrobione — skill: documentation-and-adrs — najpierw testy: brak (tylko dokumenty) — weryfikacja: verifier porównuje `Architecture.md` z kodem, pełny zestaw zielony.

## Dziennik postępu
- Krok 0 (2026-10-25): tylko dokumenty, bez testów (zatwierdzone w planie) · `CLAUDE.md`: orkiestrator tylko manager, commit + push na branch po PASS, plany po polsku (szablon też), równoległe backendy, zasady D15, kształt `Expense`/`LocalExpense`, `OutboxEntry` nieużywany · `context/app-context.md`: Wydatki w trakcie, wyjątki D15 · `.claude/agents/Backend.md`: wyjątek D15 w RLS · verifier: FAIL (angielski szablon planu, brak notatek przy krokach 0/8–11, niespójności app-context) → poprawione → PASS · użyty skill: brak.

## Ryzyka i otwarte pytania
- **R1 — Zmiana RLS dla połączonych członków (D15)** to zmiana bezpieczeństwa: pokryta testami kroku 2; verifier używa `doubt-driven-development`.
- **R2 — Pobieranie dla połączonych znajomych:** każdy telefon pobiera też wydatki innych osób; przy LWW nieaktualny telefon nadpisze nowszą edycję tylko jeśli jego `updatedAt` jest nowszy — zaakceptowane z D15.
- **R3 — Teksty:** polskie / angielskie napisy ekranu (np. „Zostało dziś {{amount}}” jest w design-context §11; „+{{amount}} z poprzednich dni”, „Grupa”, „Ja”, „Ile kto wydał”) — frontend proponuje z design-context; czego tam nie ma, wraca do Kacpra jako pytanie.
- **R4 — Historia migracji na hostowanym Supabase** wciąż wymaga `supabase migration repair` (friend-invite); krok 2 pisze i testuje migrację lokalnie, na hostowany projekt trafia dopiero po naprawie historii albo decyzji Kacpra.
- Na przyszłość (zapisane, nie planowane): dzielenie rachunku po równo (D6), FAB na każdym ekranie (D14), zdjęcie paragonu (D13), wiele walut + FX (D5).
