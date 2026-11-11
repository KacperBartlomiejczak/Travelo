# Plan: znacznik PRO ucięty przy długim nicku

Status: zaakceptowany przez Kacpra (2026-11-11), krok 1 zrobiony; czeka na ręczny test na urządzeniu

## Zrozumienie
Na ekranie profilu długi nick (np. `kacperbartlomiejczak`) zajmuje całą szerokość wiersza i znacznik PRO wypada poza ekran (jest ucięty). Kacper chce, żeby nick łamał się do kolejnej linii, a znacznik PRO był zawsze w całości widoczny.

## Przyczyna
`src/features/profile/ProfileScreen.tsx:121` — kontener nick + badge ma tylko `flexShrink: 1`, bez `flex: 1`, więc nie dostaje ograniczonej szerokości od wiersza z awatarem; `ProBadge` nie ma `flexShrink: 0`, więc jest ściskany/ucinany zamiast nicku.

## Podejście
- Kontener nicku: `flex: 1` (zajmuje resztę wiersza obok awatara, ma znaną szerokość).
- Nick: zostaje `flexShrink: 1` → łamie się do kolejnej linii.
- `ProBadge`: `flexShrink: 0` → nigdy nie jest ściskany.
- Bez zmian w schematach, danych, i18n.

## Testy najpierw
- `src/features/profile/__tests__/ProfileScreen.test.tsx`: nowy test — kontener nicku ma `flex: 1`, a `pro-badge` ma `flexShrink: 0` (test pada przed zmianą).

## Kroki
- [x] 1. [frontend] Test + poprawka w `ProfileScreen.tsx` i `ProBadge.tsx`; gałąź `fix/profile-pro-badge`. Verifier: PASS (typecheck, lint, 4043 testów zielone). Test sprawdza tylko style (Jest nie liczy layoutu) — łamanie nicku do potwierdzenia ręcznie.

## Weryfikacja
`pnpm test`, `pnpm typecheck`, `pnpm lint` zielone; ręcznie: profil z długim nickiem — nick w dwóch liniach, PRO w całości.
