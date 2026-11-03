# Zadanie: Uwagi CodeRabbit do PR #25 (feature/expenses)
Status: zrobione (2026-11-03)

Źródło: review CodeRabbit 5743159325 na https://github.com/KacperBartlomiejczak/Travelo/pull/25 (2026-11-03, commit ee95a61):
3 komentarze inline (2× Minor, 1× Major). Innych review CodeRabbit na tym PR-ze nie ma. Wszystkie 3 wątki są nadal
nierozwiązane (GraphQL `reviewThreads`, 2026-11-03).

## Zrozumienie i założenia
Każdą uwagę sprawdziłem 2026-11-03 na `origin/feature/expenses` = `ae8740d` (ten worktree, czysty). Commit `ae8740d`
(„fix(expenses): no zero-delay retry when the session is unavailable, app context wording”) powstał **po** review
(ee95a61) i już poprawia wszystkie trzy uwagi; jest wypchnięty i jest głową PR-a. Wpis w `prompts/expenses/plan.md`
(„Po PR #25 …”) to potwierdza, z red → green dla poprawki kodu.

### Weryfikacja każdej uwagi

| # | Uwaga | Werdykt | Dowód |
|---|---|---|---|
| C1 | `context/app-context.md:48` (wątek 4447592190, Minor) — „Friend invite” opisuje połączonego znajomego jako tylko do odczytu, bez wyjątku dla własnych wydatków | **Prawdziwa, już poprawiona** | Linia 48 w `ae8740d`: „read-only except their own expenses, which they add and edit (`prompts/expenses/plan.md` D15). The linked friend sees the rest of the trip without edit controls.” Linie 20 i 105 miały już ten wyjątek. |
| C2 | `context/app-context.md:277` (wątek 4447592201, Minor) — zasada „under 5 seconds (quick-add …)” nie mówi, że FAB jest tylko na ekranie Wydatki (quick-add z każdego ekranu jest na później, linia 57) | **Prawdziwa, już poprawiona** | Linia 277: „from the Expenses screen (quick-add, category chips; the trip's base currency is fixed for now)”. Usunięte też nieprawdziwe „last-used currency preselected” (na razie tylko waluta bazowa). GitHub oznacza wątek jako `outdated`. |
| C3 | `src/data/expense-sync.ts:112` (wątek 4447592211, Major) — po połkniętym `NotSignedInError` / `AuthRetryableFetchError` `run()` liczy `nextAttemptAt` ze starych prób, może wyjść data z przeszłości → `BudgetSync.tsx` ustawia timer 0 ms i kręci się bez sesji | **Prawdziwa, już poprawiona** | `expense-sync.ts:104-108`: w `catch` po połkniętym błędzie `return { nextAttemptAt: null }` (z komentarzem dlaczego). Testy w `src/data/__tests__/expense-sync.test.ts` („session unavailable with an elapsed backoff”): brak połączenia przy sprawdzaniu sesji → `null` i `attempts` bez zmian; nikt niezalogowany → to samo; inny błąd → nadal odrzuca. Red ✓ zapisany w `prompts/expenses/plan.md`. |

### Założenia
- Nie ma czego zmieniać w kodzie, schematach, migracjach ani dokumentach — zadanie sprowadza się do potwierdzenia, że
  stan jest zielony, i (po zgodzie Kacpra) odpowiedzi na trzy wątki.
- Podobna pętla w `src/data/budget-sync.ts:68-71` (kod sprzed PR-a, znaleziona z lektury, zapisana w
  `prompts/expenses/plan.md` jako otwarta „do osobnego PR-a”) **nie wchodzi** w to zadanie: CodeRabbit jej nie zgłosił,
  a Kacper zdecydował już o osobnym PR-ze.
- Odpowiedzi na PR-ze są publiczne → tylko po akceptacji ich treści przez Kacpra. Rozwiązanie wątków („Resolve”) też
  tylko na jego zgodę.

## Podejście
Brak kroków implementacyjnych. Orkiestrator: (1) uruchamia pełny zestaw testów, typecheck i lint na `ae8740d` jako dowód,
(2) po akceptacji publikuje krótką odpowiedź w każdym wątku (treść niżej) i — jeśli Kacper chce — oznacza wątki jako
rozwiązane.
Odrzucone: ponowne wdrażanie sugestii CodeRabbit — są już w kodzie w tej samej postaci (C3) lub dokładniejszej (C1, C2).

Proponowana treść odpowiedzi (po angielsku, jak reszta PR-a):
- C1: „Fixed in ae8740d: line 48 now says the linked friend is read-only except their own expenses, which they add and edit (D15), and sees the rest of the trip without edit controls.”
- C2: „Fixed in ae8740d: the principle now says ‘from the Expenses screen’. We also dropped ‘last-used currency preselected’, since only the trip's base currency exists for now.”
- C3: „Fixed in ae8740d: after a swallowed `NotSignedInError` / `AuthRetryableFetchError`, `run()` returns `{ nextAttemptAt: null }`; reconnect and foreground triggers restart sync. Covered by three tests in `expense-sync.test.ts` (no connection, signed out, other errors still reject).”

## Struktury danych (Zod)
Brak — żaden kształt danych się nie zmienia.

## Testy
Brak nowych testów (brak zmian w zachowaniu; testy C3 już istnieją w `ae8740d`). Pełny zestaw, typecheck i lint
uruchamiane raz jako dowód.

## Pliki
- `prompts/coderabbit-pr25-fixes/plan.md` (ten plan) — jedyny nowy plik.

## Skille
- brak — nie ma kroku z kodem.
- `git-workflow-and-versioning` — commit tego planu na `feature/expenses`.

## Kroki
- [x] 1. [orkiestrator] pełny zestaw testów + `pnpm typecheck` + `pnpm lint` na `ae8740d` — skill: brak — najpierw testy: brak (nic się nie zmienia) — weryfikacja: wszystko zielone
- [x] 2. [orkiestrator] po akceptacji treści: odpowiedź w wątkach C1–C3 (+ ew. „Resolve”), commit tego planu i `git push origin HEAD:feature/expenses` — skill: git-workflow-and-versioning — weryfikacja: odpowiedzi widoczne na PR-ze, wątki w stanie, który wybrał Kacper

## Dziennik postępu
- Krok 1 (2026-11-03): bez testów (nic się nie zmienia) · na `ae8740d`: typecheck ✓, lint ✓; pierwszy `pnpm test`: 1 test
  przekroczył limit 5 s (`BottomSheet.test.tsx` „shows its title as a header…”, pierwszy test pliku, równolegle testy
  puszczały dwie inne sesje); plik osobno 3/3 zielony (37 testów), ponowny pełny przebieg: 158 zestawów, 3346 testów ✓ ·
  do obserwacji jako niestabilny pod obciążeniem · użyty skill: brak.
- Decyzja (Kacper, 2026-11-03, przez sesję menedżera): „1. tak” — publikujemy odpowiedzi i rozwiązujemy wątki (P1, P2).
- Krok 2 (2026-11-03): odpowiedzi w treści z planu w wątkach C1–C3 (discussion_r4459318666, r4459319242, r4459319788),
  wszystkie 3 wątki oznaczone jako rozwiązane · commit tego planu na `feature/expenses` · użyty skill: git-workflow-and-versioning.
- Po pushu 9e0ce72: CodeRabbit potwierdził C1–C3 w wątkach; nowa uwaga (Minor, review 5759598942): P1/P2 nadal jako
  otwarte → oznaczone jako rozstrzygnięte.

## Ryzyka i otwarte pytania
- **P1:** rozstrzygnięte 2026-11-03 — odpowiedzi opublikowane (Decyzja, Krok 2).
- **P2:** rozstrzygnięte 2026-11-03 — wątki oznaczone jako rozwiązane (Krok 2).
- Poza zakresem: `budget-sync.ts:68-71` (podobna pętla) — osobny PR, jak już ustalono.
