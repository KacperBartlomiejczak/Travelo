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
- [x] 2. [frontend] tokeny `avatarFallback` + `Avatar` + `AvatarGroup` + klucze `a11y.avatar*` — skill: frontend-ui-engineering — najpierw testy: `Avatar.test.tsx`, kontrast tokenów — weryfikacja: verifier. *(fala A; kolor dostaje jako prop, bez importu z kroku 1)*
- [x] 3. [frontend] `PlanDayPicker` + przebudowa `PlanResult` na timeline + `TripPlanSide` przekazuje osoby — skill: frontend-ui-engineering — najpierw testy: przepisany `PlanResult.test.tsx`, `PlanDayPicker` — weryfikacja: verifier. *(fala B, po 1 i 2)*
- [x] 4. [docs] design-context §8.7, frontend.md, flow ai-trip-plan, app-context.
- [ ] 5. Weryfikacja końcowa gałęzi (verifier Sonnet + CodeRabbit) i test na emulatorze (tester): PL/EN, jasny/ciemny, organizator i widok znajomego, zmiana dnia, długie nazwy, 6 miejsc w dniu, duży font.

### Poprawki po teście na emulatorze (2026-11-16) — zaakceptowane przez Kacpra 2026-11-16 (P5: nowy token `slotColumnWidth = 80`, P6: zawijanie linku)
Decyzja Kacpra (2026-11-16): etykieta pory dnia — **poszerzyć kolumnę czasu** (nie przenosić etykiety nad kartę).
- [x] 6. [frontend] Kolumna pory dnia i link do Map w `PlanResult` — skill: frontend-ui-engineering, test-driven-development.
  - Nowy token `components.timeline.slotColumnWidth = 80` w `src/theme/tokens.ts`; `PlanResult` używa go zamiast `timeColumnWidth` (56 zostaje dla przyszłych godzin „09:30” z §9.2). Mnożenie przez `fontScale` zostaje. „Popołudnie” w `labelSM` ma ok. 71 dp, więc 80 dp mieści je w jednej linii (**P5**).
  - Tekst linku „Otwórz w Mapach Google” dostaje `flexShrink: 1`, a `Pressable` ograniczenie do szerokości karty, żeby przy dużym foncie tekst zawijał się do drugiej linii zamiast wychodzić poza kartę (**P6**).
  - Najpierw testy (`src/features/plan/__tests__/PlanResult.test.tsx`): kolumna pory dnia ma szerokość `slotColumnWidth` × skala fontu (dla skali 1 i 1.3); tekst linku do Map może się kurczyć (`flexShrink: 1`); przy okazji brakujący test z kroku 3 — po zmianie dnia karty wchodzą ponownie (nowe klucze/animacja wejścia).
  - Pliki: `src/theme/tokens.ts`, `src/features/plan/PlanResult.tsx`, `src/features/plan/__tests__/PlanResult.test.tsx`. Weryfikacja: verifier.
- [x] 7. [docs] `context/design-context.md` §9.2 — kolumna czasu 56 dla godzin, 80 dla etykiet pory dnia; `docs/architecture/frontend.md`, jeśli opisuje szerokość kolumny. *(2026-11-17: zmienione §9.2; `frontend.md` nie opisuje szerokości kolumny — bez zmian.)*
- [ ] 8. Ponowny test na emulatorze (tester w trybie `adb`, build deweloperski `com.anonymous.traveling`): scenariusze 1, 3, 11 (PL i EN, font 1.0 i 1.3) oraz ponowna animacja kart po zmianie dnia. Przed testem `cve-auditor` (pełny audyt) — definicja agenta jest na niezmergowanej gałęzi `chore/cve-auditor`, więc wymaga jej scalenia albo zgody Kacpra na pominięcie.

Poza zakresem tych kroków (dane testowe, nie kod): dzień z 6 miejscami, kolorowe kółka z literą i „+N”, widok znajomego — wymagają podróży z kilkoma znajomymi i drugiego konta.

## Dziennik postępu
- Krok 1: `avatar-color.ts` (FNV-1a, pierwsza litera), `plan-people-view.ts` · red: brak modułów (2 suity) → green 18/18 · suite 4412 ✓, typecheck ✓, lint ✓ · verifier PASS · uwaga: `PlanPersonView` to typ propsów, nie dane z granicy (bez Zod).
- Krok 2: tokeny `avatarFallback` (6 kolorów, jasny: biała litera 4.74–5.78:1, ciemny: litera #171716 6.47–9.28:1), `Avatar`, `AvatarGroup`, `a11y.avatar*` · red: brak modułu `Avatar`; test palety udowodniony przez orchestratora (bez palety pada) · green 11 + 14 · suite 4423 ✓, typecheck ✓, lint ✓ · verifier PASS · odstępstwa: litera xs/sm = `labelSM` (12 dp, `labelMD` nie mieści się w 24 dp — do potwierdzenia, P4), `+N` na `background.sunken`.
- Krok 3: `PlanDayPicker`, `PlanResult` jako timeline jednego dnia, `TripPlanSide`/`PlanScreen` przekazują członków i organizatora · red: niepotwierdzony (praca przerwana w poprzedniej sesji, brak raportu implementera) · suite 224/4432 ✓, typecheck ✓, lint ✓ · verifier PASS · uwagi niebl.: chip ma padding `spacing[3]` (12) zamiast `chip.horizontalPadding` (14) i style `labelSM`/`labelLG` zamiast `labelMD`, wybrany dzień `brand.primary` (jak na screenie); domyślny dzień = „dziś, jeśli jest dniem planu”; brak testu ponownej animacji po zmianie dnia; dwa słabe asercje w `PlanResult.test.tsx` — do sprawdzenia na emulatorze w kroku 5.

- Krok 4: design-context §8.7 (kolory `avatarFallback`, jedna litera, `labelSM` dla xs/sm — P4 przyjęte domyślnie, tylko własne zdjęcie), flow ai-trip-plan (wynik jako timeline), frontend.md (`Avatar`/`AvatarGroup`), app-context.
- Krok 5 (częściowo): verifier końcowy (Sonnet + CodeRabbit) PASS — 4432 ✓, typecheck ✓, lint ✓; CodeRabbit 2 uwagi odrzucone (puste `days` blokuje `.min(1)` w schemacie; import typu przechodzi typecheck); poprawiona nazwa `planPeopleView` w docs. Test na emulatorze: **zablokowany** — mobile-mcp (`mobilecli`) nie działa; potrzebne też konto z zapisanym planem AI i działający Metro.
- Krok 5 (audyt CVE przed testem na urządzeniu, 2026-11-16): `cve-auditor` — werdykt **VULNERABLE**. EXISTS: GHSA-mrhx-c7xc-m3w5 w `zod@4.6.5` (high, naprawione w 4.6.6; nieograniczone tablice mogą wyczerpać pamięć — realne ryzyko w Edge Functions `recommend-places` i `generate-trip-plan`). Pozostałe 24 zgłoszenia (node-forge, minimatch, glob, deepmerge) — NOT AFFECTED, tylko narzędzia deweloperskie. Niesprawdzone: wersja zod wdrożona w Edge Functions (brak `deno.lock`). Test na emulatorze **wstrzymany** do decyzji Kacpra.
- Krok 5 (2026-11-16, Kacper: „testuj teraz”; naprawa zod w osobnej sesji `zod-cve-fix`): tester — **zablokowany**, 12 scenariuszy NOT RUN. `mobile_list_available_devices` dwa razy zwróciło „mobilecli is not available or not working properly”. `adb` widzi emulator `emulator-5554`. Metro i konto z planem AI niesprawdzone. Przyczyna: Windows Smart App Control blokuje niepodpisany `mobilecli` → tester dostał tryb `adb` (Kacper, 2026-11-16).
- Krok 5 (2026-11-16, tester w trybie `adb`): sterowanie emulatorem działa (Expo Go otwarte), ale **zablokowany** — Metro nie działa (`localhost:8081` nie odpowiada, w Expo Go brak serwera `traveling`); sesja organizatora niesprawdzona. 12 scenariuszy NOT RUN.
- Krok 5 (2026-11-16, trzecie podejście): Metro działa, ale przez adres `exp://172.22.176.1:8081` aplikacja stawała na „Bundling 84%” / „Unable to load script”. Po `adb reverse tcp:8081 tcp:8081` i otwarciu `exp://127.0.0.1:8081` aplikacja się ładuje. **Zablokowany:** ekran „Welcome to Travelo / Sign in” — brak zalogowanej sesji organizatora. 12 scenariuszy NOT RUN.
- Krok 5 (2026-11-16, czwarte podejście, sprawdzenie orchestratora przez `adb`, tester nie uruchomiony): sesji organizatora w Expo Go nie udało się potwierdzić. Po logowaniu (karta Chrome, supabase.co) powrót `traveling://` otworzył zainstalowany build `com.anonymous.traveling` (aktualizacja 2026-11-11, bez `expo-dev-client`), który stał na splashu; potem Expo Go pokazało „Uncaught Error: Cannot find native module 'ExpoCrypto'” (39 logów). **Zablokowany** — do decyzji Kacpra, w której aplikacji testować. 12 scenariuszy NOT RUN.
- Krok 5 (2026-11-16, Kacper: „nowy build”): `expo run:android --no-bundler` z gałęzi — 3 nieudane próby, **zablokowany**. (1) brak `ANDROID_HOME` → ustawione na czas polecenia; (2) i (3) `react-native-reanimated:buildCMakeDebug` pada na limicie długości ścieżek Windows (`ninja: error: mkdir(...CSS/interpolation/transforms/operations)`), także z krótkiej litery dysku (`subst`). Na emulatorze nadal build z 2026-11-11. 12 scenariuszy NOT RUN.
- Krok 5 (2026-11-16, test na emulatorze wykonany): build deweloperski `com.anonymous.traveling` z gałęzi (CMake 4.1.2 przez `android/local.properties` — Ninja 1.10.2 z CMake 3.22.1 nie obsługuje długich ścieżek), Android 17, tester w trybie `adb`, podróż „TEST Porto” (1 podróżny). Werdykt testera: **FAIL**.
  - FAIL (major): etykieta pory dnia łamie się w środku słowa w kolumnie 56 dp — „Popołud/nie”, „Afternoo/n” (ryzyko R1 potwierdzone; scenariusze 1, 3).
  - FAIL (major): przy foncie systemowym 1.3 link „Otwórz w Mapach Google” wychodzi poza prawą krawędź karty i jest ucięty (scenariusz 11).
  - PASS: zmiana dnia (2), chipy dni (4), długie nazwy i uzasadnienia przy foncie 1.0 (5), link do Map (8), ciemny motyw (9), teksty PL/EN (10).
  - NOT RUN: dzień z 6 miejscami (max 3 w danych), kolorowe kółka z literą i „+N” (jedyny podróżny ma zdjęcie), widok znajomego (brak drugiego konta), ponowna animacja kart po zmianie dnia (nieoceniona).
  - Do wyjaśnienia (minor): po restarcie aplikacji wywołanym zmianą skali fontu ekran był w jasnym motywie, choć ustawienia pokazywały „Ciemny” — niepotwierdzone, czy to błąd aplikacji.
  - Orchestrator potwierdził oba FAIL na zrzutach ekranu. Krok 5 pozostaje otwarty — poprawki wymagają decyzji Kacpra i nowych kroków.
- Krok 6 (2026-11-17, dokończony po przerwanej sesji): token `slotColumnWidth = 80`, kolumna pory dnia w `PlanResult`, link do Map z `flexShrink: 1` + `maxWidth: '100%'` · red: niepotwierdzony w historii (agent przerwany limitem); asercje szerokości i linku nie mogą przejść na starym kodzie, testy zmiany dnia to testy regresji · suite 224/4437 ✓, typecheck ✓, lint ✓ (0 ostrzeżeń) · verifier PASS · uwaga: zawijanie sprawdzone tylko asercjami stylów — dowód na urządzeniu w kroku 8.

## Ryzyka i otwarte pytania
- **P4.** Litera w awatarze 24/32 dp to `labelSM` (12 dp) zamiast `labelMD` z §8.7 — zapiszę w §8.7 przy kroku 4, chyba że Kacper woli inaczej.
- **P1. Domyślny dzień** — dziś, jeśli podróż trwa, inaczej dzień 1. OK?
- **P2. „Ułóż ponownie”** — przenoszę do notki AI na górze (jak „Edit” na screenie) zamiast przycisku na dole. OK?
- **P3. Kolumna czasu** — bez godzin pokazuję porę dnia („Rano” / „Popołudnie” / „Wieczór”) przy pierwszym miejscu danej pory; pozostałe miejsca tej pory bez etykiety. OK, czy wolisz nagłówki pór nad kartami?
- R1. Polskie „Popołudnie” w kolumnie 56 dp może się nie zmieścić — dopuszczam zawijanie / mniejszy styl etykiety (`labelSM`), sprawdzone na emulatorze z dużym fontem (§13 pozwala poszerzyć kolumnę).
- **P5.** Szerokość kolumny pory dnia: nowy token `slotColumnWidth = 80` (karta węższa o 24 dp), a 56 zostaje dla godzin. OK, czy wolisz po prostu zmienić `timeColumnWidth` na 80?
- **P6.** Link do Map przy dużym foncie zawija się do drugiej linii. OK?
- **P7.** Po restarcie aplikacji (zmiana skali fontu) ekran był jasny, choć ustawienia pokazywały „Ciemny” — niepotwierdzone; poza zakresem tego zadania, do osobnego sprawdzenia.
- R2. Gałąź zależna od nie-zmergowanego `feature/ai-trip-plan` — PR tego zadania dopiero po merge'u planu AI.
