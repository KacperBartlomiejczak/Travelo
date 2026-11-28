# Zadanie: Odkryj nie zużywa limitu przy samym wejściu
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-28)

Gałąź: `fix/discover-quota-on-enter` (z `origin/main` @ 8ca9223).

## Zrozumienie i założenia
Zgłoszenie (test na emulatorze 2026-11-28): w „Odkryj” licznik „Pozostałe wyszukiwania dziś” spadł 5 → 4 → 3, choć nikt nie nacisnął „Znajdź miejsca”.

Diagnoza (skill superpowers:systematic-debugging, explorer haiku/medium, logi Supabase tylko do odczytu):
- Logi 2026-11-28 09:00–12:30 UTC: dokładnie dwa wywołania `recommend-places`, 10:44:56 i 10:45:54, oba **200**, oba z `consume_ai_quota`. Żadne nie było nieudane, więc to nie przypadek z `known-limitations.md:120`.
- Przyczyna: zamierzone auto-wyszukiwanie z decyzji 2026-11-09 (`decisions.md:20`, trip-recommendations D1–D6). Efekt w `src/features/discover/DiscoverScreen.tsx:69-73` woła `search()` przy wejściu do Odkryj w zakładce Plan (cel podróży + zainteresowania + online).
- Cache `usePlaceRecommendations` (`staleTime`/`gcTime: Infinity`, bez refetchy) działa w obrębie jednego uruchomienia. `QueryClient` jest jednak tylko w pamięci (`AppProviders.tsx:52`), więc każde nowe uruchomienie aplikacji i wejście w Odkryj kosztuje 1 z 5 wyszukiwań. Drugie wywołanie to najpewniej restart aplikacji przez testera (albo zmiana klucza: język, zainteresowania, cel). Błędu w samym cache nie ma.

Decyzje Kacpra (2026-11-28):
- **D1:** wyszukiwanie tylko na przycisk „Znajdź miejsca”. Miasto dalej uzupełnia się samo z celu podróży. Zastępuje część D1–D6 z 2026-11-09: „miejsca ładują się same raz na miasto na sesję”.
- **D2:** po powrocie do Odkryj (przełącznik Plan ↔ Odkryj, ten sam start aplikacji, to samo miasto) ekran pokazuje poprzednie wyniki z pamięci, bez nowego wywołania. Jeśli tego miasta w tej sesji nie szukano albo wyszukiwanie się nie udało, ekran jest pusty i czeka na przycisk.

Założenia (do potwierdzenia akceptacją planu):
- Wyszukiwanie w trakcie (jeszcze bez danych) w chwili powrotu: ekran jest pusty, a przycisk dołącza do trwającego zapytania (TanStack deduplikuje, nowego kosztu nie ma).
- Zmiana celu podróży nadal resetuje ręczny wybór miasta i uzupełnia nowe miasto, ale niczego nie wyszukuje, chyba że to miasto jest już w pamięci.
- Ekran `/discover` (bez celu) się nie zmienia.
- Zmiana minimalna w `DiscoverScreen` (jedna linia efektu), bo gałąź `feature/pro-limits-and-cities` też zmienia ten plik.

## Podejście
- Hook `usePlaceRecommendations` dostaje `showCached(request)`. Gdy `queryClient.getQueryData(keyOf(request))` ma dane, ustawia `submitted = request` (wyniki z pamięci, bez wywołania). Gdy cache jest pusty, ustawia `submitted = null` (klucz `idle`, bez wywołania), żeby pod nowym miastem nie zostały wyniki i licznik poprzedniego wyszukiwania (ryzyko znalezione przez task-plannera; render w `DiscoverScreen.tsx:75` ustawia `searched = autoRequest`, a wtedy `stale` byłoby `false`).
- W `DiscoverScreen` efekt woła `showCached(autoRequest)` zamiast `search(autoRequest)`. Reszta logiki (`autoRequest`, `searched`, `stale`) zostaje bez zmian.
- Skutek uboczny: znika znane ograniczenie z `known-limitations.md:120` (ponawianie nieudanego auto-wyszukiwania i nowe wyszukiwanie po zmianie języka).

## Struktury danych (Zod)
Bez zmian. `RecommendPlacesRequestSchema` i `RecommendPlacesResponseSchema` zostają jak są.

## Testy
Najpierw testy, które padają z oczekiwanego powodu (red):
- `src/hooks/__tests__/usePlaceRecommendations.test.tsx`:
  - `showCached` bez danych w cache: fetcher nie jest wołany, `data` jest `undefined`.
  - Po `search` i odmontowaniu `showCached` w nowym montowaniu zwraca dane z pamięci, fetcher wywołany 1 raz.
  - `showCached` po nieudanym wyszukiwaniu nie wywołuje fetchera ponownie.
  - Po `search(A)` z danymi `showCached(B)` (B bez cache) czyści wynik: `data` i `remainingToday` są `undefined`, fetcher się nie wywołuje.
- `src/features/discover/__tests__/DiscoverScreen.test.tsx` (blok „with a trip destination”). Zmiany zachowania z D1/D2, testy nie są osłabiane, tylko dostosowane do nowej decyzji:
  - `prefills the destination city and searches by itself once` → **„prefills the destination city and does not search until the button is pressed”**: po otwarciu fetcher 0 razy, po przycisku 1 raz z `lisbon`. To test odtwarzający błąd.
  - `does not call the fetcher again after a remount in the same session` → szukanie przyciskiem, potem odmontowanie i zamontowanie: wyniki widoczne, fetcher 1 raz (D2).
  - Nowy: po nieudanym wyszukiwaniu (`failed`) i ponownym montowaniu fetcher nie jest wołany drugi raz.
  - `does not search offline on open, and searches once when the connection returns` → brak wywołania przy otwarciu offline i po powrocie sieci.
  - `does not search for a manually picked city until the button is pressed`: na starcie 0 wywołań zamiast 1, po przycisku 1.
  - `drops the manual pick and loads the new destination when the destination changes` → najpierw wyszukanie przyciskiem, potem zmiana celu: pole pokazuje „Warsaw · WAW”, fetcher nie jest wołany ponownie i **nie widać kart ani licznika poprzedniego miasta**.
  - `shows the limit message after one automatic call and does not loop` → limit po naciśnięciu przycisku, fetcher 1 raz, bez pętli.
- Na koniec cały zestaw, `pnpm typecheck` i `pnpm lint` na zielono.

## Pliki
- `src/hooks/usePlaceRecommendations.ts` (dodanie `showCached`)
- `src/hooks/__tests__/usePlaceRecommendations.test.tsx`
- `src/features/discover/DiscoverScreen.tsx` (jedna linia efektu i komentarz)
- `src/features/discover/__tests__/DiscoverScreen.test.tsx`
- Dokumentacja (orkiestrator): `docs/architecture/decisions.md`, `docs/architecture/flows/features/discover-places.md`, `docs/architecture/known-limitations.md`

## Skille
- superpowers:systematic-debugging — diagnoza — znalezienie przyczyny przed poprawką (zrobione)
- superpowers:test-driven-development — kroki 1–2 — test odtwarzający błąd przed kodem
- superpowers:verification-before-completion — kroki 1–3 — dowód zielonych testów przed oznaczeniem kroku

## Kroki
Fale (task-planner): **fala 1** = krok 1 i krok 3 równolegle (rozłączne pliki); **fala 2** = krok 2 (twarda zależność od kroku 1, bo testy ekranu nie mockują hooka).
- [x] 1. [frontend] `showCached` w `usePlaceRecommendations`, z aktualizacją JSDoc hooka — skill: superpowers:test-driven-development — najpierw testy: 4 testy hooka z sekcji Testy — weryfikacja: verifier, testy hooka, typecheck, lint
- [ ] 2. [frontend] `DiscoverScreen`: efekt woła `showCached` zamiast `search`, z poprawką nieaktualnego komentarza nad efektem (zależy od kroku 1) — skill: superpowers:test-driven-development — najpierw testy: zmienione i nowe testy `DiscoverScreen` z sekcji Testy — weryfikacja: verifier, cały zestaw, typecheck, lint
- [ ] 3. [docs] orkiestrator: nowa decyzja w `decisions.md` (2026-11-28, D1–D2 zastępują auto-ładowanie z 2026-11-09), poprawka opisu w `discover-places.md`, usunięcie nieaktualnego wpisu z `known-limitations.md:120` — skill: brak — weryfikacja: verifier całej gałęzi z CodeRabbit
- Potem: cve-auditor (pełny audyt), tester na emulatorze: wejście w Plan → Odkryj nie zmienia licznika; po „Znajdź miejsca” licznik spada o 1; przełączenie Plan ↔ Odkryj pokazuje te same wyniki bez spadku licznika; restart aplikacji → Odkryj jest puste, licznik bez zmian.

## Dziennik postępu
- Diagnoza: zrobiona 2026-11-28 (logi: 2 × 200, 10:44:56 i 10:45:54 UTC) · użyty skill: superpowers:systematic-debugging
- Krok 1: testy napisane (red ✓: `showCached is not a function` w 4 testach) · `showCached` w `usePlaceRecommendations` (cache ma dane → `submitted = request`, inaczej `null`) · green ✓ (pełny zestaw 244 suity, typecheck, lint) · verifier PASS · użyty skill: superpowers:test-driven-development · bez odstępstw

## Ryzyka i otwarte pytania
- Rebase na `feature/pro-limits-and-cities`: w `DiscoverScreen` zmienia się tylko linia efektu. Konflikt jest możliwy, jeśli ta gałąź dotyka tego samego efektu; wtedy rozwiązanie jest ręczne i małe.
- Po restarcie aplikacji wyników nie ma (cache tylko w pamięci, Google pozwala zapisywać tylko `placeId`). To zgodne z D1.
