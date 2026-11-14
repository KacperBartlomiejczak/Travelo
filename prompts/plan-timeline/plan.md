# Zadanie: widok planu jako timeline z awatarami
Status: w trakcie (zaakceptowany 2026-11-14, P1–P3 jak zaproponowane)

## Zrozumienie i założenia
- Kacper (2026-11-14): obecny widok planu (`PlanResult`, zwykła lista) wygląda słabo. Ma wyglądać „mniej więcej” jak screen referencyjny: wybór dnia, oś czasu (timeline), karty miejsc z awatarami znajomych; osoba bez zdjęcia = kolorowe kółko z pierwszą literą imienia.
- **D1 (Kacper):** zakres = **tylko nowy wygląd** z obecnych danych planu. Bez godzin, czasu trwania, cen, „Group splits” i stanu „Done” — zapisany plan ich nie ma (są w roadmapie jako „AI day plans, later parts”). Bez zmian w AI, Edge Functions i bazie.
- **D2 (Kacper):** zdjęcie tylko **własne** (zalogowanej osoby, z `useMyProfile`). Wszyscy pozostali (organizator widziany przez znajomego, znajomi) = kolorowe kółko z literą. Zdjęcia linked znajomych = późniejszy krok (wymaga RLS + podpisanych URL-i).
- **D3 (Kacper):** kolory awatarów bez zdjęcia = **nowa paleta tokenów** `avatarFallback` (ok. 6 stonowanych kolorów Sunline, osobno jasny/ciemny motyw, kontrast litery ≥ 4.5:1). Kolor stały dla osoby (wyliczany z jej id: `owner` / uuid członka), więc ten sam na każdym ekranie. **Jedna litera** (pierwsza litera imienia, wielka). To zmienia design-context §8.7 (tam: szare tło + do 2 inicjałów) — aktualizuję §8.7.
- Dane, które mamy: dni (`date`, `cityIata`), w dniu do 6 miejsc z `slot` (rano / popołudnie / wieczór), `reason`, `forPeople` (`owner` lub uuid członka); nazwy/adresy/link z `place-details`; członkowie z `useCurrentTrip` (`displayName`), organizator: własny nick (gdy oglądam jako organizator) albo `organizerUsername` (gdy jestem linked znajomym).

## Podejście
Zastępuję listę w `PlanResult` widokiem jednego dnia:
1. **Pasek dni** — poziome chipy z dniem tygodnia i numerem dnia miesiąca (jak na screenie), wybrany dzień w kolorze marki. Domyślnie: dzisiejszy dzień, jeśli podróż trwa, inaczej dzień 1 (**P1**).
2. **Nagłówek dnia** — „Dzień 4 · wt 21 paź” (`labelMD`, kapitaliki jak na screenie), pod nim miasto (`headingLG`) i „N podróżnych”.
3. **Notka AI** — ikona `Sparkles` + „Wygenerowane przez AI” + „Sprawdź godziny otwarcia i ceny przed wyjściem.”; po prawej akcja „Ułóż ponownie” (tylko organizator online, jak dziś) zamiast osobnego przycisku na dole (**P2**).
4. **Timeline** wg design-context §9.2 i tokenów `components.timeline` (kolumna czasu 56, szyna 24, linia 2 dp, węzeł 12 dp): w kolumnie czasu **pora dnia** („Rano” / „Popołudnie” / „Wieczór”) przy pierwszym miejscu danej pory zamiast godziny (**P3**); każde miejsce to karta (`Card`): nazwa, uzasadnienie (bez `P1`, jak dziś), adres, link „Otwórz w Mapach Google”, w prawym dolnym rogu **AvatarGroup** osób z `forPeople`.
5. **Awatary** — nowe komponenty `Avatar` (zdjęcie albo kolorowe kółko z literą; błąd zdjęcia → litera) i `AvatarGroup` (max 4, nakładanie 10 dp, obramowanie 2 dp w kolorze powierzchni, `+N`), a11y: `a11y.avatarGroup` „Uczestnicy: …”.
6. Animacja wejścia kart zostaje (§7.5, reduce motion), przy zmianie dnia karty wchodzą ponownie.

Nie robię (D1): godzin, cen, czasu trwania, „Group splits”, „Done”, menu „⋯” z nagłówka screena, zdjęć znajomych.

## Struktury danych (Zod)
Bez nowych schematów i bez migracji — tylko widok istniejących `TripPlan` / `TripMember` / `PlaceDetails`. Lokalny typ widoku osoby (`{ key: string; name: string; photoUri?: string }`) to nie dane z granicy, tylko props komponentu.

## Testy
- `src/lib/__tests__/plan-people-view.test.ts` — mapowanie `forPeople` → osoby: `owner` → nick organizatora; uuid → `displayName`; nieznane uuid pominięte; zdjęcie tylko dla zalogowanej osoby; kolejność stała.
- `src/lib/__tests__/avatar-color.test.ts` — ten sam klucz → ten sam kolor; rozkład po palecie; litera = pierwsza litera, wielka, pusta nazwa → „?”.
- `src/components/__tests__/Avatar.test.tsx` — zdjęcie vs litera, `onError` → litera, etykieta a11y; `AvatarGroup`: max 4 + `+N`, etykieta „Uczestnicy: …”.
- `src/theme/__tests__/…` — kontrast litery na każdym kolorze `avatarFallback` ≥ 4.5:1 w obu motywach (jeśli jest test kontrastu tokenów — dopisać do niego).
- `src/features/plan/__tests__/PlanResult.test.tsx` (przepisane) — pasek dni, domyślny dzień (dziś w trakcie podróży / dzień 1), zmiana dnia, nagłówek, etykiety pór, karta z nazwą/uzasadnieniem/linkiem, awatary, „Ułóż ponownie” tylko gdy `canRegenerate`, animacje (reduce motion), ukryte uzasadnienie z `P1`.
- `TripPlanSide` — przekazuje członków/organizatora (istniejące testy zielone).

## Pliki
- `src/theme/tokens.ts` — paleta `avatarFallback` (jasny + ciemny).
- `src/lib/avatar-color.ts`, `src/lib/plan-people-view.ts` (+ testy).
- `src/components/Avatar.tsx`, `src/components/AvatarGroup.tsx` (+ testy).
- `src/features/plan/PlanResult.tsx` (przebudowa), nowy `src/features/plan/PlanDayPicker.tsx`, `src/features/plan/TripPlanSide.tsx` (props z członkami).
- `src/i18n/locales/{pl,en}.json` — `plan.result.*` (nagłówek dnia, podróżni, notka AI), `a11y.avatar`, `a11y.avatarGroup`.
- Docs (orchestrator): `context/design-context.md` §8.7 (D3), `docs/architecture/frontend.md`, `docs/architecture/flows/features/ai-trip-plan.md`, `context/app-context.md`.

## Skille
- `frontend-ui-engineering` — kroki 2, 3 — komponenty i ekran zgodne z design-context.
- `test-driven-development` — wszystkie kroki — red → green.

## Kroki
Gałąź: `feature/plan-timeline` od `feature/ai-trip-plan` (PR planu AI nie jest jeszcze w `main`; po jego merge'u rebase na `main`).
- [x] 1. [backend] `avatar-color.ts` + `plan-people-view.ts` (czysta logika w `src/lib`) — skill: test-driven-development — najpierw testy: `avatar-color.test.ts`, `plan-people-view.test.ts` — weryfikacja: verifier. *(fala A, równolegle z 2)*
- [ ] 2. [frontend] tokeny `avatarFallback` + `Avatar` + `AvatarGroup` + klucze `a11y.avatar*` — skill: frontend-ui-engineering — najpierw testy: `Avatar.test.tsx`, kontrast tokenów — weryfikacja: verifier. *(fala A; kolor dostaje jako prop, bez importu z kroku 1)*
- [ ] 3. [frontend] `PlanDayPicker` + przebudowa `PlanResult` na timeline + `TripPlanSide` przekazuje osoby — skill: frontend-ui-engineering — najpierw testy: przepisany `PlanResult.test.tsx`, `PlanDayPicker` — weryfikacja: verifier. *(fala B, po 1 i 2)*
- [ ] 4. [docs] design-context §8.7, frontend.md, flow ai-trip-plan, app-context.
- [ ] 5. Weryfikacja końcowa gałęzi (verifier Sonnet + CodeRabbit) i test na emulatorze (tester): PL/EN, jasny/ciemny, organizator i widok znajomego, zmiana dnia, długie nazwy, 6 miejsc w dniu, duży font.

## Dziennik postępu
- Krok 1: `avatar-color.ts` (FNV-1a, pierwsza litera), `plan-people-view.ts` · red: brak modułów (2 suity) → green 18/18 · suite 4412 ✓, typecheck ✓, lint ✓ · verifier PASS · uwaga: `PlanPersonView` to typ propsów, nie dane z granicy (bez Zod).

## Ryzyka i otwarte pytania
- **P1. Domyślny dzień** — dziś, jeśli podróż trwa, inaczej dzień 1. OK?
- **P2. „Ułóż ponownie”** — przenoszę do notki AI na górze (jak „Edit” na screenie) zamiast przycisku na dole. OK?
- **P3. Kolumna czasu** — bez godzin pokazuję porę dnia („Rano” / „Popołudnie” / „Wieczór”) przy pierwszym miejscu danej pory; pozostałe miejsca tej pory bez etykiety. OK, czy wolisz nagłówki pór nad kartami?
- R1. Polskie „Popołudnie” w kolumnie 56 dp może się nie zmieścić — dopuszczam zawijanie / mniejszy styl etykiety (`labelSM`), sprawdzone na emulatorze z dużym fontem (§13 pozwala poszerzyć kolumnę).
- R2. Gałąź zależna od nie-zmergowanego `feature/ai-trip-plan` — PR tego zadania dopiero po merge'u planu AI.
