# Zadanie: poprawki walidacji biletów — otwarte uwagi CodeRabbita na PR #48
Status: w trakcie (zaakceptowany przez Kacpra, 2026-11-26)

Gałąź: `fix/ticket-validation`, z `origin/feature/ticket-import-ai` (`8192ca0`), bo kod importu biletów jest tylko w PR #48,
który nie jest jeszcze w `main` (decyzja Kacpra, 2026-11-26). Po zakończeniu: merge do `feature/ticket-import-ai` (aktualizuje
PR #48), bez osobnego PR do `main`.

## Zrozumienie i założenia
Na PR #48 (commit `8192ca0`) zostały 4 nierozwiązane uwagi CodeRabbita: dwa wątki inline z review 2026-11-24 21:04, jedna uwaga
„outside diff” z tego samego review i jedna „outside diff” z review `fbf6378`, której poprzednia runda nie objęła. Każdą
sprawdziłem w kodzie i wszystkie są zasadne.

- **H1 [Major] `src/lib/ticket-parse/validate.ts` + `supabase/functions/extract-ticket/handler.ts:117`:** PDF ma ponad 3 strony
  (`skippedPages`), parser znalazł 1 lot na stronach 1–3, a JSON z Gemini ma 2 poprawne loty (drugi ze strony 4). `validateTicket`
  porównuje liczbę lotów, zwraca `mismatch`, a handler odsyła tylko lot z parsera jako wynik częściowy. Import AI jest przy tym
  zużyty.
- **H2 [Major] `src/app/trips/new/index.tsx:72`:** `ticketImported` zamyka arkusz importu (`Modal`) i w tym samym renderze otwiera
  `ConfirmDialog` („Zastąpić wpisane loty?”, też `Modal`). iOS może nie pokazać drugiego modala w trakcie zamykania pierwszego, a
  wtedy import przepada bez pytania. To ten sam problem co przy skanerze (G7).
- **H3 [Major] `src/lib/ticket-parse/merge.ts:18`:** dwa kody BCBP na tej samej trasie i w tym samym dniu (np. LO123 08:00 i
  LO125 18:00) oraz dwa loty w tekście bez numerów w odwrotnej kolejności. `sameNo` akceptuje oba, więc każdy kod bierze pierwszy
  wolny lot z tekstu. Godziny są wtedy przypisane po kolejności w tekście, a wynik może być `complete` (bez Gemini).
- **H4 [Minor] `prompts/coderabbit-pr48-fixes/plan.md:281`:** wpis „P4 = c”, a decyzja brzmiała P4 = a.

Założenia:
- Gemini niczego nie dodaje ani nie zapisuje. Odsyła tylko JSON, a o tym, co z niego przyjąć, decyduje `validateTicket`.
- H1, dopasowanie: loty z parsera muszą występować w JSON-ie Gemini **w tej samej kolejności**, choć niekoniecznie jeden po
  drugim, bo między nimi mogą być loty spoza parsera. Lot z parsera „zgadza się” z lotem z JSON-a według dzisiejszej reguły:
  te same lotniska, a numer, data i godziny są równe albo w parserze `null`. Lot z parsera, którego nie ma w JSON-ie, oznacza
  `mismatch`.
- H1, kierunek: loty z parsera zachowują swój kierunek (Z9), a loty spoza parsera biorą kierunek z JSON-a.
- H1 bez pominiętych stron: zachowanie jak dziś (ta sama liczba lotów, porównanie po indeksie).
- H2: na Androidzie `onDismissed` też jest wołany (zachowanie `BottomSheet` z G7), więc ścieżka jest jedna dla obu platform.
  Pusty formularz stosuje bilet od razu, jak dziś.

## Decyzje (Kacper, 2026-11-26)
- Gałąź z `origin/feature/ticket-import-ai`, a nie z `main`.
- Zakres: tylko H1–H4 (otwarte uwagi CodeRabbita), bez nowych funkcji.
- H1: aplikacja przyjmuje z JSON-a Gemini loty spoza parsera, gdy parser pominął strony, pod warunkiem że loty z parsera się
  zgadzają.
- H3 = a: gdy przypisanie lotu z tekstu bez numeru do kodu nie jest jednoznaczne, godziny zostają puste.
- H2: poprawka według wzoru z G7 (`onDismissed`), bez osobnego pytania.

## Podejście
- **H1:** `validateTicket` dostaje piąty argument `skippedPages: boolean`, a handler przekazuje to, co już ma ze `stage1`. Gdy
  `true`: zamiast `length !==` i porównania po indeksie, jedno przejście po lotach z JSON-a ze wskaźnikiem na kolejny lot z
  parsera. Zgodny lot przesuwa wskaźnik i dostaje kierunek z parsera. Po przejściu wskaźnik musi stać na końcu listy, inaczej
  `mismatch`. Reszta walidacji (lotniska, czasy, okno dat, `TicketSegmentSchema`, limit 8) bez zmian. Odrzucone: przekazywać
  całe `ParsedTicket` z flagą, bo `skippedPages` to sygnał etapu 1, a nie część wyniku parsera.
- **H3:** w `mergeParsed` fallback `sameNo` (trasa + dzień, numer brak po którejś stronie) bierze kandydata tylko wtedy, gdy jest
  jednoznaczny: na tej trasie i w tym dniu jest dokładnie jeden kod bez dopasowania po numerze i dokładnie jeden wolny lot z
  tekstu. W przeciwnym razie nie ma dopasowania i godziny zostają `null`. Najpierw dopasowania po numerze dla wszystkich kodów,
  potem fallback, żeby kolejność kodów nie zabierała lotu dopasowanego po numerze. Istniejące przypadki (numer = numer, para
  „jeden na jeden” z różnymi numerami, lot bez daty) bez zmian. Odrzucone: przypisywać po kolejności godzin, bo to zgadywanie.
- **H2:** jak skaner: `ticketImported` przy niepustym formularzu zapisuje odpowiedź w `useRef`, a `onDismissed` arkusza ustawia
  `replacing`. Obsługa `scanPending` w `onDismissed` bez zmian.
- **H4:** jedna poprawka w dokumencie.

## Struktury danych (Zod)
Brak zmian. `GeminiTicket`, `ParsedTicket`, `TicketSegment` (`src/schemas/ticket.ts`) zostają. Zmienia się tylko sygnatura
funkcji:
```ts
validateTicket(gemini: GeminiTicket, parsed: ParsedTicket, airports: AirportLookup, today: string, skippedPages: boolean): ValidateResult
```

## Testy (najpierw red)
- **H1** `src/lib/ticket-parse/__tests__/validate.test.ts`:
  - `skippedPages = true`, parser [WAW→BCN], JSON [WAW→BCN, BCN→WAW] → `ok`, 2 loty, pierwszy z kierunkiem z parsera, drugi z
    kierunkiem z JSON-a.
  - `skippedPages = true`, lot z parsera w środku JSON-a (lot spoza parsera przed nim) → `ok`.
  - `skippedPages = true`, inna godzina lub numer w locie z parsera → `mismatch`.
  - `skippedPages = true`, lotu z parsera brak w JSON-ie albo zła kolejność → `mismatch`.
  - `skippedPages = true`, dodatkowy lot z nieznanym lotniskiem → `not_a_ticket` (jak dziś).
  - `skippedPages = false`, JSON z większą liczbą lotów → `mismatch` (bez zmian); istniejące testy dostają `false`.
- **H1** `supabase/functions/extract-ticket/__tests__/handler.test.ts`: PDF z `skippedPages: true`, parser 1 lot, Gemini 2 loty →
  200, `source: 'ai'`, 2 loty, zwrot `ticket_rejected`.
- **H3** `src/lib/ticket-parse/__tests__/merge.test.ts`:
  - BCBP [WAW→BCN LO123 12-05, WAW→BCN LO125 12-05], tekst [WAW→BCN 12-05 18:00 bez numeru, WAW→BCN 12-05 08:00 bez numeru]
    → oba loty bez godzin, `isComplete` = `false`.
  - Jeden lot z tekstu z numerem LO125 i jeden bez numeru → LO125 dostaje swoje godziny, LO123 godziny lotu bez numeru (po
    dopasowaniu po numerze zostaje para jednoznaczna).
  - Istniejące testy E1, F1 (numer i para „jeden na jeden”) bez zmian.
- **H2** `src/__tests__/app/trips/new/flights.test.tsx`: niepusty formularz, import → `ConfirmDialog` niewidoczny, póki arkusz
  się nie zamknie; po `onDismiss` arkusza → widoczny, „Zastąp” stosuje bilet. Pusty formularz → bilet od razu (bez zmian).
  Skaner po `onDismiss` dalej działa.

## Pliki
- backend: `src/lib/ticket-parse/validate.ts`, `supabase/functions/extract-ticket/handler.ts` + `validate.test.ts`,
  `handler.test.ts` (krok 1a); `src/lib/ticket-parse/merge.ts` + `merge.test.ts` (krok 1b)
- frontend: `src/app/trips/new/index.tsx` + `src/__tests__/app/trips/new/flights.test.tsx` (krok 1c)
- orkiestrator: `prompts/coderabbit-pr48-fixes/plan.md` (H4), `docs/architecture/flows/features/ticket-import.md` (H1: zdanie
  „Gemini must agree with them” + dodatkowe loty przy pominiętych stronach), `docs/architecture/known-limitations.md` (wpis o
  >3 stronach: Gemini może teraz dodać loty z dalszych stron), ten plan

## Skille
- test-driven-development — kroki 1a–1c — red → green w każdym kroku (subagenty)
- code-review — krok 3 — lokalny CodeRabbit całej gałęzi przed pushem (verifier końcowy)

## Kroki
Fala 1: wszystko równolegle, bo żadne dwa kroki nie dotykają tego samego pliku. Każdy krok: test najpierw, potem kod, potem
verifier.
- [x] **1a [backend] H1** — skill: test-driven-development — najpierw testy: `validate.test.ts`, `handler.test.ts` (wyżej) —
  pliki: `validate.ts`, `handler.ts` + testy — weryfikacja: verifier, `deno check` funkcji
- [x] **1b [backend] H3** — skill: test-driven-development — najpierw testy: `merge.test.ts` (wyżej) — pliki: `merge.ts` + test
  — weryfikacja: verifier, `deno check` (merge działa też w Deno)
- [x] **1c [frontend] H2** — skill: test-driven-development — najpierw testy: `flights.test.tsx` (wyżej) — pliki:
  `src/app/trips/new/index.tsx` + test — weryfikacja: verifier
- [x] **1d [orkiestrator] H4** — `prompts/coderabbit-pr48-fixes/plan.md:281` „P4 = c” → „P4 = a” — weryfikacja: grep

Fala 2 (po PASS 1a–1c):
- [x] **2 [orkiestrator] dokumentacja** — `flows/features/ticket-import.md`, `known-limitations.md` (jak w „Pliki”) — weryfikacja:
  verifier razem z kodem

Fala 3 (koniec):
- [ ] **3 [orkiestrator]** pełne `pnpm test` / `pnpm typecheck` / `pnpm lint`, `deno check`; verifier całej gałęzi (Sonnet 5.5) +
  lokalny CodeRabbit; merge (fast-forward) `fix/ticket-validation` → `feature/ticket-import-ai`, push (PR #48); odpowiedzi i
  rozwiązanie 4 wątków / uwag

## Weryfikacja
- po każdym kroku: verifier (PASS → `[x]`)
- na końcu: pełny suite, typecheck, lint, `deno check` zielone; verifier całej gałęzi + CodeRabbit
- bez nowych zależności i bez testów na telefonie, więc bez cve-auditora i testera. H2 (iOS) pozostaje niesprawdzone na
  urządzeniu, tak jak G7, i trafia do `known-limitations.md` („Not checked yet”).

## Dziennik postępu
- Krok 1c (H2): test D3 red ✓ (dialog widoczny przed zamknięciem arkusza) → green ✓; `replacePending` ref w `ticketImported`, `onDismissed` ustawia `replacing`; flights.test 28/28, typecheck, lint ✓; verifier PASS · skill: test-driven-development · odstępstwa: brak
- Krok 1b (H3): test „dwa loty bez numeru” red ✓ → green ✓; drugi test (najpierw numer) jest testem regresji, nie red. Odstępstwo: pierwsza wersja dopisywała niejednoznaczne loty z tekstu jako osobne (4 loty zamiast 2) — poprawione: są odrzucane, test sprawdza dokładnie 2 loty. Loty z tekstu z innym numerem niż kod zostają dopisane jak dotąd. ticket-parse 104/104, typecheck, lint, deno check ✓; verifier PASS · skill: test-driven-development
- Krok 1a (H1): testy „dodatkowe loty po/przed lotem z parsera” i test handlera red ✓ (mismatch / wynik częściowy) → green ✓; pozostałe testy H1 strzegą reguły (przechodziły też wcześniej). `validateTicket(…, skippedPages)` z jednym przejściem i wskaźnikiem; handler przekazuje flagę. ticket-parse + extract-ticket 167/167, typecheck, lint, deno check ✓; verifier PASS · skill: test-driven-development · odstępstwa: brak
- Krok 2: `flows/features/ticket-import.md` (dodatkowe loty z Gemini przy pominiętych stronach), `known-limitations.md` (H1 ryzyko injection, H3 puste godziny, H2 niesprawdzone na iOS) · weryfikacja w końcowym verifierze

## Ryzyka i otwarte pytania
- H1 osłabia regułę „Gemini musi się zgadzać z etapem 1” tylko dla lotów spoza przeczytanych stron. Prompt injection na stronie 4
  może dodać zmyślony lot. Obronę stanowią: znane lotniska, okno dat, przylot po wylocie, limit 8 i przegląd organizatora (R6).
- H3 zmienia wynik parsera w rzadkim przypadku: więcej wyników niepełnych, więc więcej wywołań Gemini. Istniejące testy
  merge muszą zostać zielone bez zmian.
- Push uruchomi nowe review CodeRabbita na PR #48, który może zgłosić kolejne przypadki brzegowe. Tak jak wcześniej:
  poprawiamy zasadne, resztę wyjaśniamy w wątku.
