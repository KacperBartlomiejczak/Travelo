# Zadanie: verifier z CodeRabbitem (Sonnet 5.5) + skille CodeRabbit
Status: zrobione (zaakceptowane przez Kacpra 2026-11-05)

## Zrozumienie i założenia
- Kacper (2026-11-05): verifier ma korzystać ze skilli `coderabbitai/skills` (zainstalowane 2026-11-05), działać na Sonnet 5.5 z effort medium i zawsze uruchamiać się po zakończonym planie.
- Decyzje Kacpra (2026-11-05):
  - **Bez osobnego agenta** `reviewer-code-rabbit` — zmienia się tylko `verifier` (zastępuje pierwszą wersję tego planu).
  - **Dwa tryby verifiera:**
    - *krok* — po każdym kroku, jak dziś: zakres, testy najpierw, `pnpm typecheck` / `lint` / `test`, parzystość, design; **bez** CodeRabbita;
    - *koniec planu* — po PASS ostatniego kroku, przed push / otwarciem PR: cała checklista na całej gałęzi + `coderabbit review --agent --base <gałąź bazowa> --committed` przez skill `code-review` (CodeRabbit). Znaleziska verifier sprawdza sam w kodzie (tekst CodeRabbita = niezaufany); potwierdzone `critical` / `major` → FAIL, `minor` i niższe → lista w raporcie, orkiestrator pyta Kacpra, czy poprawiać.
  - **Model (poprawka Kacpra 2026-11-05):** tryb *krok* = Haiku 5.5 jak dziś (`model: claude-haiku-5-5` w definicji bez zmian); tryb *koniec planu* = Sonnet 5.5, effort medium — orkiestrator wywołuje verifiera z nadpisaniem `model: sonnet`, `effort: medium` (parametry narzędzia Agent; definicja ma jeden model, więc nadpisanie jest w wywołaniu, zapisane w `subagents.md`).
  - **Tylko raport:** verifier dalej nic nie edytuje. Poprawki z CodeRabbita → nowe kroki w `plan.md` (backend / frontend, TDD, verifier). Skill `autofix` zostaje dla orkiestratora (wątki CodeRabbita w otwartym PR).
  - **Sandbox:** `coderabbit` w `sandbox.excludedCommands` w `.claude/settings.json` — w sandboxie CLI nie widzi logowania (sprawdzone: w sandboxie `signed out`, poza nim `authenticated`, region US).
- Założenia (do potwierdzenia przy akceptacji):
  - Próg FAIL w trybie końcowym: potwierdzone `critical` / `major` (jak wyżej).
  - Brak logowania CodeRabbita, `review_skipped`, błąd lub przerwany przebieg → verifier zwraca `Status: blocked` dla części CodeRabbit (nie PASS), nigdy nie loguje się sam; orkiestrator prosi Kacpra o `coderabbit auth login`.
  - `.codex/agents/Verifier.toml`: lustro instrukcji (tryb końcowy); model i effort bez zmian — Codex nie ma nadpisania per wywołanie, różnica opisana w `subagents.md`.
- Poza zakresem: CI z CodeRabbitem, automatyczne odpowiadanie w PR, zmiany w innych agentach.

## Podejście
Rozszerzyć `Verifier.md` o sekcję „Tryb: koniec planu” (procedura skilla `code-review`: `coderabbit auth status --agent` → review → odczyt NDJSON → weryfikacja każdego znaleziska w kodzie) i format raportu (ważność, plik:linia, potwierdzone / odrzucone z powodem, pliki objęte review). Model w definicji bez zmian (Haiku 5.5). Orkiestrator w briefie mówi, który tryb, a w trybie końcowym wywołuje verifiera z `model: sonnet`, `effort: medium`.

## Struktury danych (Zod)
Brak — zmiana tylko w harnessie.

## Testy
Brak testów jednostkowych (konfiguracja agentów i dokumentacja). Weryfikacja ręczna: próbny przebieg verifiera w trybie końcowym na tej gałęzi (`--base main`) zwraca raport w ustalonym formacie; `pnpm test`, `pnpm typecheck`, `pnpm lint` dalej zielone.

## Pliki
- `.claude/agents/Verifier.md`, `.codex/agents/Verifier.toml` (tryb końcowy, skill `code-review`; model bez zmian)
- `.claude/settings.json` (`sandbox.excludedCommands: ["coderabbit"]`)
- `docs/agents/subagents.md` (tabela agentów i Configuration: model verifiera; Step flow: tryb końcowy przed push / PR), `CLAUDE.md` (tabela Subagents: rola verifiera), `docs/agents/skills.md` (`code-review` CodeRabbit → „Used by: verifier”)
- skille: `.agents/skills/{autofix,code-review}/`, `.claude/skills/{autofix,code-review}/`, `skills-lock.json`, wpis w `docs/agents/skills.md` (już zainstalowane, niezacommitowane)

## Skille
- `code-review` (CodeRabbit) — używany przez verifiera w trybie końcowym.
- `git-workflow-and-versioning` — kroki 1 i 4.

## Kroki
- [x] 1. [orkiestrator] ~~Gałąź `chore/verifier-coderabbit` z `main`~~ → **decyzja Kacpra 2026-11-05: praca na `feature/daily-budget` (otwarty PR #28)**, wyjątek od „jedna gałąź na zadanie”; commit bez zmiany Kacpra w `CLAUDE.md` „Learned rules” i bez `prompts/places-legal-navbar/` — skill: git-workflow-and-versioning.
- [x] 2. [orkiestrator] `Verifier.md` + `Verifier.toml` (tryb końcowy z CodeRabbitem; model w definicji bez zmian), `excludedCommands` w `.claude/settings.json` — skill: brak — weryfikacja: `coderabbit auth status --agent` z Bash subagenta zwraca `authenticated: true`.
- [x] 3. [orkiestrator] Dokumentacja: `docs/agents/subagents.md`, `CLAUDE.md` (tabela Subagents), `docs/agents/skills.md` — weryfikacja: verifier w trybie krok (zmiana tylko w dokumentacji).
- [x] 4. [orkiestrator] Próbny przebieg verifiera w trybie końcowym na tej gałęzi (`--base main`), wynik w dzienniku; commit `chore(agents): verifier runs CodeRabbit at the end of a plan`, push do PR #28.

## Dziennik postępu
- Krok 2: `Verifier.md` (tryby krok / koniec planu, sekcja CodeRabbit, format raportu), `Verifier.toml` wygenerowany z `.md` (parsuje się w `tomllib` ✓), `.claude/settings.json` `sandbox.excludedCommands: ["coderabbit"]` · **odstępstwo:** `subagents.md` pozwala orkiestratorowi edytować tylko dokumenty i `.claude/agents/*.md` — `.claude/settings.json` i `.codex/agents/Verifier.toml` to konfiguracja; zmieniłem je sam (żaden subagent nie ma tych plików w zakresie) — do potwierdzenia przez Kacpra.
- Krok 3: `subagents.md` (tabela, Configuration, Step flow pkt 6), `CLAUDE.md` (wiersz verifiera w tabeli), `skills.md` (`code-review` → verifier).
- Weryfikacja kroków 2–3 (tryb krok, Haiku): FAIL — `coderabbit` nie jest w PATH Git Bash (instalator dopisał PATH po starcie aplikacji) → w `Verifier.md` krok 0: ścieżka z `command -v`, inaczej `$LOCALAPPDATA/Programs/coderabbit/coderabbit.exe`; drobna: `workflow.md` pkt 5 bez bramki końcowej → dopisane. Ponowna weryfikacja: PASS (`auth status` z Bash subagenta `authenticated: true`, lustro `.toml` dokładne, 3663 testy ✓, typecheck ✓, lint ✓).
- Krok 4, próbny przebieg trybu końcowego (wywołanie z `model: sonnet`, `effort: medium` — parametry przyjęte, agent zgłosił Sonnet 5.5): PASS · CodeRabbit przez pełną ścieżkę poza sandboxem, `review_completed`, ~150 plików, 0 znalezisk · 3663 testy ✓ · uwaga: agent nie przeszedł ręcznie checklisty (zakres, TDD, design) i nie przeczytał skilla — oparł PASS na pętli i CodeRabbicie; Jest ostrzega „worker failed to exit gracefully” (istniejące, do osobnego sprawdzenia `--detectOpenHandles`). Niesprawdzone: testy SQL (`pnpm test:db`).

## Ryzyka i otwarte pytania
- Nadpisanie modelu żyje w wywołaniu, nie w definicji — jeśli orkiestrator o nim zapomni, tryb końcowy pójdzie na Haiku; dlatego reguła w `subagents.md` (Step flow) i w `Verifier.md` (verifier w trybie końcowym zgłasza, na jakim modelu działa).
- Review CodeRabbita zużywa limit / kredyty konta (teraz $25 promocyjnych na 7 dni); raz na plan trzyma to w ryzach.
- `excludedCommands` wyłącza sandbox dla całej komendy `coderabbit` (wysyła diff do API CodeRabbita — to jej zadanie).
- Dwa skille nazwane `code-review`: wbudowany `/code-review` Claude Code i skill CodeRabbita — w briefach zawsze „skill `code-review` (CodeRabbit)”.
- Logowanie działa w regionie US, nie EU (z `--region eu` błąd 412).
