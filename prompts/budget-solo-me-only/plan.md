# Zadanie: Budżet przy podróży solo — tylko „Ja”
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-19)

## Zrozumienie i założenia
Kacper: „Jeżeli ktoś leci sam, chciałbym, aby w zakładce budżet była tylko opcja ja, jako że jednej osobie nie jest potrzebna grupa”.

Stan obecny (zakładka Budżet, `src/features/expenses/`):
- `BudgetHero` pokazuje przełącznik „Grupa / Ja” (`SegmentedControl`), domyślnie „Grupa”, zawsze gdy istnieje własny wiersz (`me`). Organizator zawsze ma własny wiersz (`memberId: null`), więc przy podróży solo widzi przełącznik „Grupa / Ja”, choć obie liczby są identyczne.
- `SpendByPersonChart` („Kto ile wydał”) pokazuje jeden pasek na osobę — przy solo jeden pasek.
- `ExpenseSheet`, pole „Kto”: organizator widzi chipy `[Ty, ...members]` — przy solo jeden chip „Ty”.

Założenie: „podróż solo” = `overview.members.length === 0` (sam organizator). Znajomy podpięty do podróży nigdy nie jest solo (zawsze jest organizator).

## Podejście
- `BudgetHero`: przy solo brak przełącznika „Grupa / Ja”, karta pokazuje kwoty organizatora („Ja”) (P1).
- `ExpensesScreen` przekazuje do `BudgetHero` informację o solo (z `members.length === 0`).
- `SpendByPersonChart`: bez zmian — zostaje jeden pasek (P2).
- `ExpenseSheet`: przy solo pole „Kto” jest ukryte; wydatek trafia na organizatora (`memberId: null`, jak dotąd domyślnie) (P3).
- Bez zmian w danych, schematach i `computeExpenseBudget`.

## Struktury danych (Zod)
Bez zmian.

## Testy
- `BudgetHero.test.tsx`: w trybie solo brak przełącznika „Grupa / Ja”, widoczne kwoty z `me`.
- `ExpensesScreen.test.tsx`: podróż bez towarzyszy → brak radia „Grupa”; podróż z towarzyszem → przełącznik jak dotąd (regresja).
- `ExpenseSheet.test.tsx`: organizator w podróży solo nie widzi pola „Kto”, zapis idzie z `memberId: null`; z towarzyszem chipy jak dotąd (regresja).

## Pliki
- `src/features/expenses/BudgetHero.tsx`, `ExpensesScreen.tsx` (krok 1)
- `src/features/expenses/ExpenseSheet.tsx` (krok 2)
- testy w `src/features/expenses/__tests__/`
- `docs/architecture/flows/features/expenses.md` — dopisać regułę solo

## Skille
- test-driven-development — krok 1 — test odtwarzający błąd przed poprawką

## Kroki
- [x] 1. [frontend] Karta budżetu bez przełącznika przy solo (`BudgetHero`, `ExpensesScreen`) — skill: test-driven-development — najpierw testy: `BudgetHero.test.tsx`, `ExpensesScreen.test.tsx` (red: przy solo widać „Grupa”) — weryfikacja: verifier, `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [x] 2. [frontend] Pole „Kto” ukryte przy solo (`ExpenseSheet`) — równolegle z krokiem 1 (inne pliki) — skill: test-driven-development — najpierw testy: `ExpenseSheet.test.tsx` (red: przy solo widać pole „Kto”) — weryfikacja: verifier, `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [ ] 3. [orchestrator] Docs: `flows/features/expenses.md` — weryfikacja: verifier końcowy gałęzi

## Dziennik postępu
- Krok 1: testy napisane (red ✓: przy solo był widoczny przełącznik) · `BudgetHero` dostał prop `solo` (brak przełącznika, kwoty `me`), `ExpensesScreen` przekazuje `solo={members.length === 0}` · green ✓ · verifier PASS, typecheck ✓, lint ✓ · użyty skill: test-driven-development · bez odstępstw
- Krok 2: testy napisane (red ✓: przy solo widać było „Kto wydał”) · `ExpenseSheet` renderuje pole „Kto” tylko gdy `members.length > 0`; zapis przy solo z `memberId: null` · green ✓ · verifier PASS, pełny `pnpm test` (4387) ✓, typecheck ✓, lint ✓ · użyty skill: test-driven-development · uwaga verifiera: blok JSX nie jest ponownie wcięty (kosmetyka, bez Prettiera); przypadek brzegowy (usunięcie ostatniego towarzysza przy edycji) dziś nieosiągalny — w aplikacji nie ma usuwania członków

## Ryzyka i otwarte pytania
- P1 (Kacper, 2026-11-19): karta budżetu przy solo — brak przełącznika, od razu kwoty „Ja”.
- P2 (Kacper, 2026-11-19): wykres „Kto ile wydał” przy solo — zostaje (jeden pasek).
- P3 (Kacper, 2026-11-19): pole „Kto” w arkuszu wydatku przy solo — ukryte.
- Ryzyko: gdy organizator doda towarzysza w trakcie, przełącznik wraca (domyślnie „Grupa”) — zgodne z dotychczasowym zachowaniem.
