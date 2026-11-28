# Zadanie: limit workerów Jest i Metro
Status: zrobione (zaakceptowane przez Kacpra 2026-11-28: „Tak, Jest i Metro”)

## Zrozumienie i założenia
Kacper (2026-11-28): przy kilku równoległych sesjach procesy Node (workery Jest i osobne Metro w każdym worktree) zajmują ok. 60% RAM i komputer nie wyrabia. Jest ma działać maksymalnie na 2 workerach. Limit dla Metro zaproponował orkiestrator, Kacper się zgodził.

## Podejście
- `package.json` → `jest.maxWorkers: 2` (działa też bez flagi `--maxWorkers`).
- `metro.config.js` → `config.maxWorkers = 2`.
- Bez testu: sama konfiguracja narzędzi. Weryfikacja: `jest --showConfig`, pełny zestaw, typecheck, lint.

## Kroki
- [x] 1. Zmiana konfiguracji Jest i Metro, wpis w `docs/development/testing.md`.

## Ryzyka
- Pełny zestaw testów trwa dłużej przy 2 workerach.
- Bundlowanie w Metro (pierwsze uruchomienie) może być wolniejsze.
