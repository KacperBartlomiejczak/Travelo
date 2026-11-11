# Zadanie: Metro nie startuje — „Cannot read properties of undefined (reading 'exists')”
Status: zrobione

Decyzja Kacpra (2026-11-11, po kroku 3): **nowy `metro.config.js` (`getDefaultConfig` z Expo) z
`resolver.blockList` na `.claude/worktrees/`**, tak samo jak Jest. Worktree zostają nietknięte.
Dodatkowy krok 3a: test `src/__tests__/metro-config.test.ts` (blockList łapie ścieżkę worktree, nie łapie
`src/`), potem `metro.config.js`, potem ponowna weryfikacja kroku 3.

## Zrozumienie i założenia
Diagnoza (2026-11-11, odtworzona lokalnie `DEBUG=Metro:* npx expo start`):

1. Błąd z logu (`DependencyGraph.doesFileExist … reading 'exists'`) jest **skutkiem**, nie przyczyną.
   Prawdziwy pierwszy błąd w logu Metro:
   ```
   Metro:Watcher Using watcher: fallback
   Failed to construct transformer:  Error: Failed to start watch mode.
       at …/@expo/metro-file-map@57.0.4/build/Watcher.js:164
   ```
2. Na Windows `@expo/metro-file-map` używa watchera `fallback`, który rekurencyjnie zakłada `fs.watch`
   na każdym katalogu projektu, łącznie z `node_modules`. Ma na start limit `MAX_WAIT_TIME = 240000` ms
   (4 min). U nas nie zdążył → „Failed to start watch mode”.
3. Metro 0.84.5 (`Bundler.js`) łapie ten błąd, wypisuje go i **nie przerywa startu**. Serwer działa dalej,
   ale `DependencyGraph._fileSystem` nigdy nie zostaje ustawione, więc każde żądanie o asset
   (ikony, fonty, obrazki) wywala się na `this._fileSystem.exists` → aplikacja się nie ładuje.
4. Dlaczego watcher jest tak wolny: `node_modules` ma układ **isolated** (`node_modules/.modules.yaml`:
   `nodeLinker: isolated`, ~1110 paczek w `node_modules/.pnpm`, po dwie wersje `@expo/cli`, `metro`,
   `metro-config`, `@expo/metro-config`, `@expo/metro-file-map`). Projekt zakłada `node-linker=hoisted`
   (`.npmrc`, `docs/development/commands.md`), ale pnpm 12.11.2 **nie czyta już tego ustawienia z `.npmrc`**
   (npm zresztą ostrzega: `Unknown project config "node-linker"`) — ustawienia pnpm muszą być
   w `pnpm-workspace.yaml`. Ostatni `pnpm install` (aktualizacja Expo 57.0.26 → 57.0.32, niezacommitowana)
   zbudował więc `node_modules` w układzie isolated, z mnóstwem symlinków i duplikatów.
5. Dodatkowo w czasie testu na tej maszynie chodził Jest w `Travelo-expo58` (12 workerów) — to spowalnia
   start watchera, ale nie jest przyczyną główną.
6. W trybie `CI=1` (bez watchera) Metro startuje i serwuje assety poprawnie (HTTP 200) — potwierdza, że
   problemem jest wyłącznie start watch mode.

Założenie (do potwierdzenia po kroku 2): po powrocie do układu hoisted watcher startuje w < 1 min.

## Podejście
Przywrócić zamierzony układ `node_modules` (hoisted) w sposób, który pnpm 12 respektuje, przeinstalować
zależności, sprawdzić zgodność wersji z SDK i zabezpieczyć się przed powtórką (przypięta wersja pnpm,
skrypt `doctor`, notatka w docs).

## Struktury danych (Zod)
Brak — zmiana dotyczy tylko narzędzi.

## Testy
Brak nowych testów jednostkowych (zmiana tylko konfiguracji narzędzi, brak kodu produkcyjnego).
Weryfikacja: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone + ręczny start Metro (watch mode)
i żądanie o asset zwraca 200, a aplikacja ładuje się na emulatorze.

## Pliki
- `pnpm-workspace.yaml` — dodać `nodeLinker: hoisted`
- `.npmrc` — usunąć `node-linker=hoisted` (pnpm 12 go ignoruje, npm ostrzega)
- `package.json` — pole `packageManager: "pnpm@12.11.2"`, skrypt `doctor`
- `pnpm-lock.yaml` — przegenerowany przez `pnpm install`
- `docs/development/commands.md` — poprawić opis (ustawienia pnpm w `pnpm-workspace.yaml`), dodać sekcję
  „Metro nie startuje” (szukać pierwszego błędu, `Failed to start watch mode`)
- `docs/architecture/known-limitations.md` — fallback watcher na Windows i limit 4 min

## Skille
- debugging-and-error-recovery — diagnoza (już użyty)
- git-workflow-and-versioning — krok 5 (gałąź i commit)

## Kroki
- [x] 1. [backend] Przenieść `nodeLinker: hoisted` do `pnpm-workspace.yaml`, usunąć linię z `.npmrc`, dodać
  `"packageManager": "pnpm@12.11.2"` do `package.json` — skill: brak — najpierw testy: n/d (konfiguracja) —
  weryfikacja: `pnpm config get node-linker` → `hoisted`
- [x] 2. [backend] Zatrzymać wszystkie procesy Metro, `rm -rf node_modules`, `pnpm install`, potem
  `npx expo install --check` i `npx expo-doctor`; naprawić tylko to, co zgłosi doctor (duplikaty metro) —
  weryfikacja: `.modules.yaml` → `nodeLinker: hoisted`, jedna wersja `@expo/cli` i `@expo/metro-file-map`,
  doctor bez błędów
- [x] 3. [backend] `npx expo start -c` (watch mode), zmierzyć czas od „Using watcher” do gotowości, `curl`
  na `/assets/...icon.png?platform=android` → 200; uruchomić aplikację na emulatorze (tester) —
  weryfikacja: brak „Failed to start watch mode” i „reading 'exists'” w logu
- [x] 4. [backend] Dodać skrypt `"doctor": "expo-doctor"`; zaktualizować `docs/development/commands.md`
  i `docs/architecture/known-limitations.md` — weryfikacja: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone
- [x] 5. Gałąź `fix/metro-watch-mode`, commit razem z niezacommitowaną aktualizacją Expo 57.0.32
  (`package.json`, `pnpm-lock.yaml`, `app.json` z pluginem `expo-asset`) — verifier PASS

## Jak zapobiegać w przyszłości
- **Czytać pierwszy błąd w logu Metro, nie ostatni.** `Failed to construct transformer` / `Failed to start
  watch mode` oznacza, że serwer jest „żywy, ale martwy” — wszystkie kolejne błędy to skutki.
- **Ustawienia pnpm tylko w `pnpm-workspace.yaml`**, nigdy w `.npmrc` (pnpm ≥ 11).
- **Przypięta wersja pnpm** (`packageManager` + Corepack) — aktualizacja pnpm nie zmieni po cichu układu
  `node_modules`.
- **Po każdym podbiciu Expo / `expo install --fix`:** `pnpm doctor` + `npx expo start -c` i otwarcie
  aplikacji, zanim zmiana trafi do commita (dziś aktualizacja wisi niezacommitowana i niesprawdzona).
- **Nie odpalać ciężkiego Jesta w innych worktree w trakcie startu Metro** — fallback watcher na Windows
  jest wolny i ma twardy limit 4 min.

## Dziennik postępu
- Krok 1: `nodeLinker: hoisted` w `pnpm-workspace.yaml`, usunięty `.npmrc` (zawierał tylko tę linię),
  `"packageManager": "pnpm@12.11.2"` w `package.json` · `pnpm config get node-linker` → `hoisted` ✓ ·
  odstępstwo: kroki konfiguracyjne robi orkiestrator — pliki w katalogu głównym są poza zakresem subagentów.
- Krok 2: `rm -rf node_modules` zablokowane przez narzędzie → zamiast tego
  `pnpm install --config.confirmModulesPurge=false` (pnpm sam przebudował `node_modules`) ·
  `.modules.yaml` → `nodeLinker: hoisted` ✓ · jedna kopia `@expo/cli` 57.0.33 i `@expo/metro-file-map` 57.0.4 ✓
  (metro 0.84.5 zostaje tylko jako zależność `@expo/metro` — oczekiwane) · `expo install --check` OK ·
  `expo-doctor` 21/21 ✓.
- Krok 3: **FAIL** — nadal `Failed to start watch mode`. Crawler Metro: **880 215 plików**.
  Liczenie plików: `.claude/` = **1 288 681**, `node_modules` = 63 743. Przyczyna główna to
  **26 git worktree w `.claude/worktrees/`** (każdy z własnym `node_modules`). Leżą wewnątrz `projectRoot`,
  więc Metro je crawluje i obserwuje. Jest już je pomija (`package.json` → `jest`, `.claude/worktrees/`),
  Metro nie. Hoisted był potrzebny (zgodny z docs), ale sam nie wystarcza. → zmiana planu, czeka na Kacpra.
- Krok 3a: test `src/__tests__/metro-config.test.ts` (środowisko `node`) — red ✓ (brak `metro.config.js`) ·
  `metro.config.js` = `getDefaultConfig` + `resolver.blockList` `/[\\/]\.claude[\\/]worktrees[\\/].*/` · green ✓.
- Krok 3 (ponownie): `DEBUG=Metro:* npx expo start -c` → crawler **39 391 plików** (było 880 215), watcher
  startuje, brak `Failed to start watch mode` · asset `icon.png?platform=android` → **200** · pełny bundle
  Androida → 200, 6,6 MB, 17 s ✓. Na emulatorze nie sprawdzone.
- Krok 4: skrypt `"doctor": "npx -y expo-doctor"` (`expo-doctor` nie jest zależnością — bez pytania nie
  dodajemy) · `pnpm doctor` → All checks passed ✓ · zaktualizowane `docs/development/commands.md`
  (pnpm/nodeLinker, Doctor, Metro, sekcja „Metro does not start”) i `docs/architecture/known-limitations.md` ·
  `pnpm test` 200/200 suit, 4044/4044 (pierwszy przebieg: 1 timeout w `budget.test.tsx` pod obciążeniem —
  równolegle Jest w `Travelo-expo58`; osobno 28/28, drugi pełny przebieg zielony) · `pnpm typecheck` ✓ ·
  `pnpm lint` ✓.
- Verifier: **PASS** · regex sprawdzony na ścieżkach Windows i POSIX (blokuje `.claude/worktrees/…`, nie blokuje
  `src/`, `node_modules`, `.claude/settings.json`, `.claude/worktrees-old`) · uwagi do commita: `.codex/config.toml`
  (MCP lottiefiles) poza zakresem — nie commitować; `expo-asset` w `app.json` — decyzja Kacpra.

## Ryzyka i otwarte pytania
- Hoisted może nie wystarczyć, jeśli watcher nadal przekracza 4 min (słaby dysk / antywirus skanujący
  `node_modules`). Wtedy opcje: (a) wykluczenie folderu projektu w Windows Defender, (b) Watchman na
  Windows (`resolver.useWatchman`) — decyzja Kacpra.
- Czy commitować aktualizację Expo 57.0.32 w tej samej gałęzi, czy osobno? (rekomendacja: razem — to ona
  wywołała reinstall).
- Plugin `expo-asset` w `app.json` — Kacper (2026-11-11): commitować razem z tą poprawką.
