# Plan: znacznik PRO ucięty przy długim nicku

Status: zrobione (2026-11-11): oba kroki, verifier PASS, sprawdzone na emulatorze

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

- [x] 2. [frontend] Gradient w `ProBadge` wypełnia całą pigułkę (szczegóły niżej). Verifier: PASS (typecheck, lint, 4044 testy zielone). Test na urządzeniu jeszcze nie zrobiony (patrz uwaga niżej).

## Uwaga: emulator serwował inny katalog
Emulator ładował bundle z Metro uruchomionego w `C:\Users\Baxton\Developer\Travelo-expo58` (gałąź `feature/expo-58-upgrade`), a nie z tej gałęzi. Oba testy na emulatorze pokazywały więc stary kod. W tamtym kodzie znacznik ma pełne 108 px bez `flexShrink: 0`, czyli ucięcie brało się tylko z gradientu (krok 2). Krok 1 zostaje jako zabezpieczenie. Test na urządzeniu wymaga Metro uruchomionego z tego katalogu.

## Wynik testu na emulatorze po kroku 1 (2026-11-11)
Nick łamie się poprawnie, a znacznik ma pełną szerokość w layoucie (x=920, szer. 108 px, w ekranie). Mimo to gradient kończy się na ~66 px. W ciemnym motywie litera „O” znika na tle, w jasnym wystaje poza pigułkę. Restart aplikacji tego nie zmienia.

Przyczyna: w `ProBadge.tsx` `Svg` ma `width="100%"`, a rodzic ma `paddingHorizontal: spacing[2]`. Yoga liczy 100% od szerokości bez paddingu: 108 − 2×21 = 66 px. Inne gradienty w aplikacji (`TripHero`, `PastTrips`, `SettingsScreen`) działają, bo ich rodzic nie ma paddingu.

Krok 2: padding przenosimy z `View` znacznika na `Text` „PRO”. Pigułka wygląda tak samo, a `Svg` 100% obejmuje całą jej szerokość. Test: `pro-badge` nie ma paddingu, a tekst ma `paddingHorizontal: spacing[2]` i `paddingVertical: spacing[1]`.

## Weryfikacja
`pnpm test`, `pnpm typecheck`, `pnpm lint` zielone; ręcznie: profil z długim nickiem — nick w dwóch liniach, PRO w całości.

## Test na emulatorze po kroku 2 (2026-11-11)
Metro uruchomione z tego katalogu (`fix/profile-pro-badge`), Android emulator, ciemny motyw, nick `kacperbartlomiejczak`: nick w dwóch liniach, gradient pokrywa całą pigułkę (108 px), „PRO” w całości w środku. PASS. Nie sprawdzone: jasny motyw, większa czcionka systemowa.
