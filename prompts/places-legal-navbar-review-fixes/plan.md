# Zadanie: Poprawki po review CodeRabbit do PR #29 (pill nav + legal)
Status: w trakcie (zaakceptowano 2026-11-07)

## Zrozumienie i założenia
- PR #29 (`feature/places-legal-navbar` → `main`) ma 3 niezamknięte uwagi CodeRabbit (wszystkie „Minor”). CI zielone, brak konfliktów.
- Poprawki idą na gałąź `feature/places-legal-navbar` (jedna gałąź na zadanie, commit na krok), bez nowej gałęzi.
- PR #30 (draft, oparty na #29) czeka na merge #29, potem rebase na `main`.

## Podejście
Trzy małe, niezależne poprawki, każda test-first (poza tekstem prawnym).

## Struktury danych (Zod)
Brak zmian.

## Testy
- 2: `src/__tests__/app/legal.test.tsx` — wstecz przy `canGoBack()=false` woła `router.replace(...)`, przy `true` woła `router.back()`.
- 3: test `PillNav` — po zmianie motywu pierwsze `place` ustawia pozycję bez animacji.
- 1: bez nowego testu; sprawdzenie `grep` że placeholdera regionu nie ma w `docs/legal` i `src/i18n`.

## Pliki
- `docs/legal/privacy-policy.en.md`, `docs/legal/privacy-policy.pl.md` (linia ~68)
- `src/i18n/locales/en.json`, `src/i18n/locales/pl.json` (linia ~553)
- `src/app/_layout.tsx` (~195)
- `src/components/PillNav.tsx` (~88) + testy

## Skille
- test-driven-development — kroki 2, 3 — test przed kodem

## Kroki
- [x] 1. [frontend] Wstawić zweryfikowany region Supabase do polityki (2× md, 2× i18n) — skill: brak — najpierw testy: brak (sam tekst) — weryfikacja: grep, `pnpm test`, po merge workflow GitHub Pages przebudował stronę
- [x] 2. [frontend] Fallback przycisku wstecz na `/legal`: `router.canGoBack() ? back() : replace(<trasa>)` — skill: test-driven-development — najpierw testy: oba warianty `canGoBack` — weryfikacja: test, ręcznie deep link na emulatorze (tester)
- [x] 3. [frontend] `PillNav`: przy zmianie motywu zerować `placed.current`, by wskaźnik nie animował się od starej pozycji — skill: test-driven-development — najpierw testy: brak animacji przy pierwszym `place` po remoncie — weryfikacja: test, ręcznie przełączenie motywu z aktywną zakładką Profil
- [ ] 4. Verifier całej gałęzi (z CodeRabbit), `pnpm typecheck && pnpm lint && pnpm test`, push, zamknięcie 3 wątków
- [ ] 5. Merge #29, rebase #30 na `main`, zmiana z draftu na ready (CodeRabbit sprawdzi #30)

## Dziennik postępu
(pusty)

## Ryzyka i otwarte pytania
- **Region Supabase** — ZAŁATWIONE: `eu-west-1` (Irlandia), z `supabase/.temp/pooler-url` projektu hwsqdlxojllclbwlhuwb.
- **Trasa fallbacku (krok 2)** — ZAAKCEPTOWANE przez Kacpra: `/`.
- Zachowanie `router.back()` w Expo Router SDK 57 przy braku historii trzeba potwierdzić na urządzeniu.
- Krok 3 CodeRabbit ocenia jako „Low value” — rekomenduję zrobić (jedna linia).
- Kroki 1–3: wykonane przez agentów frontend (test-first dla 2 i 3, red ✓ → green ✓), verifier PASS: typecheck, lint, pełny `pnpm test` (182 suites / 3691 testów) zielone. `legal.test.tsx` raz padł u agenta, nie odtworzony w 7 przebiegach (możliwy flake `waitFor` + rAF).
- Otwarte: data wersji polityki ("6 listopada 2026") — decyzja Kacpra, czy przesunąć po poprawce regionu.
