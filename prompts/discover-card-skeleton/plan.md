# Zadanie: Szkielet ładowania kart w Discover
Status: zaakceptowany 2026-11-19 („Akceptuję”, Kacper), zrobiony

## Zrozumienie i założenia
- Kacper: szkielet ładowania w sekcji Discovery ma mieć rozmiar karty `PlaceCard`, żeby po załadowaniu układ nie skakał.
- Dziś (`src/features/discover/DiscoverScreen.tsx`, gałąź `loading || profile.isPending`): dwa gołe `SkeletonBlock` 100% × `spacing[10]` (40dp) z odstępem `spacing[3]` — nie przypominają karty (§8.19: „Skeleton must approximate final geometry, not generic grey bars”).
- `PlaceCard` = `Card` (padding 16, radius `card.radius`, ramka 1dp, `gap` 12) z: opcjonalną karuzelą 4:3 przyklejoną do góry karty (od ramki do ramki), nazwą (`labelLG`), wierszem typu/oceny (`caption`), adresem (`bodySM`), opcjonalnym uzasadnieniem AI (`bodyMD`), przyciskiem „Otwórz w Mapach Google” (`TextButton` secondary).
- Wysokość prawdziwej karty zależy od danych (jest/nie ma zdjęć, długość tekstów), więc szkielet odwzorowuje **typową** kartę; zero skoku da się zagwarantować tylko co do struktury i proporcji, nie co do piksela.
- Zakres: tylko stan ładowania Discover. Bez nowych zależności, bez zmian schematów Zod (żadnych nowych danych), bez backendu.
- Wzór: `src/features/home/HomeSkeleton.tsx` (`SkeletonCard` na bazie `Card` + `SkeletonBlock` o wysokościach z `typography.styles.*.lineHeight`).

## Pytania do Kacpra
- **Q1 — ile kart szkieletu?** → 2 karty (Kacper, 2026-11-19).
- **Q2 — co odwzorować w środku?** → pełna karta ze zdjęciem 4:3, tytułem, wierszem typu, adresem, 2 liniami uzasadnienia i przyciskiem Map (Kacper, 2026-11-19).

## Podejście
1. Nowy komponent `PlaceCardSkeleton` w `src/features/discover/PlaceCard.tsx` (obok karty, żeby geometria była w jednym miejscu): `Card` z
   - blokiem zdjęcia 4:3 od ramki do ramki, tym samym trikiem co `Carousel` (spacer `aspectRatio: card.photoAspectRatio`, ramka absolutna na `-card.padding`, górne rogi `card.radius - card.borderWidth`), `SkeletonBlock` z `radius={0}` wewnątrz;
   - tytułem (`labelLG.lineHeight`, ~60%), wierszem typu (`caption.lineHeight`, ~40%), adresem (`bodySM.lineHeight`, ~70%), dwiema liniami uzasadnienia (`bodyMD.lineHeight`, 100% / 80%), blokiem przycisku (wysokość `TextButton`, ~50%).
2. `DiscoverScreen`: w gałęzi ładowania 2 × `PlaceCardSkeleton` z `gap: spacing[3]` (jak lista wyników); `testID="discover-loading"` i `accessibilityLabel={t('discover.loading')}` zostają; bloki `aria-hidden` (już są w `SkeletonBlock`).

## Struktury danych (Zod)
- Brak zmian — szkielet nie niesie danych.

## Testy (najpierw, czerwone z właściwego powodu)
- `src/features/discover/__tests__/PlaceCard.test.tsx`: `PlaceCardSkeleton` renderuje się w `Card` (`testID="place-card-skeleton"`); ma blok zdjęcia z `aspectRatio` = `card.photoAspectRatio` i ramką na `-card.padding`; wysokości linii = `lineHeight` odpowiednich stylów typografii; ukryty dla czytnika ekranu.
- `src/features/discover/__tests__/DiscoverScreen.test.tsx`: w stanie ładowania (wyszukiwanie w toku oraz `profile.isPending`) `discover-loading` zawiera dokładnie 2 `place-card-skeleton`, a gołych 40dp bloków już nie ma; etykieta „loading” bez zmian.

## Pliki
- `src/features/discover/PlaceCard.tsx` (nowy eksport `PlaceCardSkeleton`)
- `src/features/discover/DiscoverScreen.tsx` (tylko gałąź ładowania)
- `src/features/discover/__tests__/PlaceCard.test.tsx`, `__tests__/DiscoverScreen.test.tsx`
- Docs: `docs/architecture/frontend.md` (wiersz `/discover`, „States: … skeletons” → opis szkieletu kart)

## Kroki
- [x] 1. [frontend] `PlaceCardSkeleton` + użycie w `DiscoverScreen` (TDD: testy czerwone → zielone), verifier.
- [x] 2. Aktualizacja `docs/architecture/frontend.md` (orchestrator), pełna weryfikacja: `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Weryfikacja
- Automatyczna: cały suite, typecheck, lint zielone.
- Ręczna (tester, opcjonalnie): Plan → Odkryj z celem podróży; podczas ładowania widać karty-szkielety o kształcie `PlaceCard`; po załadowaniu pierwsza karta nie przesuwa się w pionie (zdjęcie w tym samym miejscu).

## Skille
- test-driven-development — krok 1 — red → green

## Ryzyka
- Karta bez zdjęć albo bez uzasadnienia jest niższa od szkieletu → przy takich wynikach nadal będzie mały skok w dół listy. Nie do uniknięcia bez znajomości danych przed załadowaniem.

## Decyzje
- D1: 2 karty-szkielety (Q1).
- D2: szkielet = pełna karta ze zdjęciem 4:3 (Q2).

## Dziennik
- 2026-11-19: szkic planu; Q1–Q2 odpowiedziane.
- 2026-11-19: krok 1 (frontend) — `PlaceCardSkeleton` + 2 szkielety w `DiscoverScreen`; wysokość bloku zdjęcia mierzona `onLayout` ramki (`SkeletonBlock` przyjmuje tylko liczbową wysokość). Verifier PASS (suite 220/4384, typecheck, lint zielone). Uwagi bez blokady: brak testu `aria-hidden`; korzeń karty-szkieletu nie ma `aria-hidden` (dzieci mają).
- 2026-11-19: krok 2 — `docs/architecture/frontend.md` (wiersz `/discover`, stan ładowania).
