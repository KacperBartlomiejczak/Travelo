# Zadanie: poprawki z review CodeRabbit do PR #37 (metro watch mode)
Status: zrobione

## Zrozumienie i założenia
CodeRabbit (review z 2026-11-11, commit `726dedc`) zgłosił 2 uwagi. Obie sprawdziłem względem kodu i obie
są zasadne.

### U1 [Major] `metro.config.js:10` — blockList łapie każdą ścieżkę z `.claude/worktrees/`
Regex `/[\\/]\.claude[\\/]worktrees[\\/].*/` nie jest zakotwiczony do projektu. Jeśli Metro startuje
**z wnętrza worktree** (np. `…\Travelo\.claude\worktrees\x\`), to każdy plik aplikacji i każda zależność
ma w ścieżce `\.claude\worktrees\`, więc Metro wyklucza wszystko i bundle nie powstaje.
Potwierdzone: `require('./metro.config.js')`, test na
`C:\Users\Baxton\Developer\Travelo\.claude\worktrees\x\src\app\_layout.tsx` → `true`, czyli plik zablokowany.
To realny scenariusz, bo sesje Claude pracują właśnie w tych worktree.

### U2 [Minor] `docs/development/commands.md:62` — komenda diagnostyczna nie działa w PowerShell
`DEBUG=Metro:* npx expo start -c` to składnia bash. W PowerShell (Twój domyślny terminal) trzeba wpisać
`$env:DEBUG='Metro:*'; npx expo start -c`.

## Podejście
- U1: zakotwiczyć regex do `path.join(__dirname, '.claude', 'worktrees')` (ścieżka bezwzględna, znaki
  specjalne regexu wyescape'owane, oba separatory). Wtedy z głównego repo wyklucza tylko jego worktree,
  a uruchomiony z worktree nie wyklucza niczego swojego.
- U2: w docs podać obie formy, bash / Git Bash i PowerShell. Formę dla `cmd` pomijam, bo nikt jej tu nie
  używa (do potwierdzenia przez Ciebie, patrz pytania).

## Struktury danych (Zod)
Brak.

## Testy
`src/__tests__/metro-config.test.ts`, najpierw red:
- nowy przypadek: ścieżka wyglądająca jak projekt uruchomiony z worktree **innego** repo
  (`<inny katalog>/.claude/worktrees/x/src/app/_layout.tsx` oraz `…/node_modules/react/index.js`) **nie**
  jest blokowana. Dziś regex ją blokuje → red.
- zostają: `<root>/.claude/worktrees/…` zablokowane, `<root>/src/…` i `<root>/node_modules/…` nie.

## Pliki
- `src/__tests__/metro-config.test.ts`
- `metro.config.js`
- `docs/development/commands.md`
- `prompts/metro-watch-mode-fix/plan.md` (wpis w dzienniku)

## Skille
- test-driven-development — krok 1
- autofix (CodeRabbit) — odpowiedź na wątki po pushu, każda zmiana za Twoją zgodą

## Kroki
- [x] 1. [backend*] Test red dla U1 → poprawka regexu w `metro.config.js` → green — najpierw testy: jak
  wyżej — weryfikacja: `pnpm test -- metro-config`, ręcznie `node -e` na ścieżce z worktree → `false`
- [x] 2. [docs] U2: formy bash i PowerShell w sekcji „Metro does not start” — weryfikacja: komenda
  PowerShell faktycznie ustawia `DEBUG` (start Metro, w logu widać linie `Metro:Watcher`)
- [x] 3. Pełna pętla: `pnpm test`, `pnpm typecheck`, `pnpm lint`; start Metro z repo głównego (crawler
  ~39 tys. plików, asset 200), verifier PASS
- [x] 4. Commit na tej samej gałęzi `fix/metro-watch-mode`, push, odpowiedź w obu wątkach CodeRabbit

\* `metro.config.js` i test leżą poza zakresem edycji subagenta backend, tak jak przy PR #37. Robi to
orkiestrator, a sprawdza verifier.

## Dziennik postępu
- Krok 1 (U1): nowy test „does not block a project that itself runs from another repo’s worktree” —
  red ✓ (Expected false, Received true) · regex zbudowany z `path.join(__dirname, '.claude', 'worktrees')`,
  wyescape'owany, `^` na początku, oba separatory · green ✓ (3/3) · sonda: `…\Travelo\.claude\worktrees\a\…`
  i wersja z `/` → zablokowane; `…\Travelo2\.claude\worktrees\x\src\…`, `.claude\worktrees-old`, `src\` → nie.
- Krok 2 (U2): w `commands.md` formy bash/Git Bash i PowerShell + zdanie o zakotwiczeniu · forma `cmd`
  pominięta (decyzja Kacpra: akceptacja planu) · komenda PowerShell sprawdzona: logi `Metro:Watcher`
  widoczne, crawler 39 391 plików, asset → 200.
- Krok 3: `pnpm test` 200/200 suit, 4045/4045 (pierwszy przebieg puszczony równolegle ze startem Metro →
  5 suit przekroczyło czas; powtórzony sam — zielony) · `pnpm typecheck` ✓ · `pnpm lint` ✓.
- Verifier: **PASS** · uwagi nieblokujące: (a) kotwica jest wrażliwa na wielkość liter (np. `c:` vs `C:`);
  Metro bierze ścieżki z tego samego `projectRoot`, więc w praktyce się zgadzają; (b) test nie uruchamia Metro
  z wnętrza własnego worktree, sprawdza to samo zachowanie na ścieżce innego repo.
- Krok 4: commit na `fix/metro-watch-mode`, push, odpowiedzi w wątkach CodeRabbit.

## Ryzyka i otwarte pytania
- Forma dla `cmd` (`set "DEBUG=Metro:*" && npx expo start -c`): dodać czy pominąć? Rekomendacja: pominąć.
- Na emulatorze nadal nie sprawdzone (dotyczy całego PR #37).
