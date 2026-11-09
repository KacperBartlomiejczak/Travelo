# Zadanie: Polecane miejsca dla celu podróży (Odkryj w zakładce Plan)
Status: zaakceptowany (2026-11-09) — w realizacji
Gałąź: `feature/trip-recommendations` (od `claude/plan-discover-switch-1cf264` = PR #31, zawiera #30 i #31, bez #32)

## Zrozumienie i założenia
Słowa Kacpra (2026-11-09, przekazane przez sesję-menedżera): „chciałbym, aby w podróży polecało, co użytkownik ma zobaczyć, na podstawie tego, gdzie leci, i jego preferencji; nie chcę, żeby był wybór tych rzeczy — to ma być brane z jego profilu” oraz „chciałbym, aby można było wybrać miasto, jednak domyślnie mają być już załadowane polecane z tego, gdzie użytkownik leci, na jakie lotnisko”.

Czyli:
- Zainteresowania **zawsze z profilu**; pole „Zainteresowania” (`InterestChips`) znika z ekranu Odkryj.
- Miasto domyślnie = lotnisko celu bieżącej podróży, a polecenia dla niego **ładują się same**, bez naciskania przycisku.
- `AirportField` zostaje — można wybrać inne miasto i wyszukać ponownie.
- Wszystkie stany zostają: ładowanie, pusto, błąd z ponowieniem, limit dzienny, offline, „Dane: Google”.

Stan dziś (sprawdzony w kodzie):
- `DiscoverScreen` (`src/features/discover/DiscoverScreen.tsx`): `AirportField` + `InterestChips` (z `useMyProfile`, edytowalne) + „Szukaj miejsc” → `usePlaceRecommendations.search(request)`.
- `usePlaceRecommendations`: `useQuery` po kluczu zapytania, włączany dopiero po `search`, `staleTime`/`gcTime` Infinity, bez ponowień — **to samo zapytanie w tej samej sesji aplikacji nie kosztuje nic** (z pamięci). Nic nie jest zapisywane na dysk (Google pozwala trwale trzymać tylko `placeId`).
- Cel podróży: `useCurrentTrip().data.overview.trip.destination` — kod IATA lotniska, gdzie kończy się lot „tam” (`src/schemas/trip.ts`, pole **wymagane**, więc podróż zawsze ma cel). Miasto i współrzędne daje istniejący `findAirport(iata)` z `src/lib/airport-search.ts` (lista lotnisk w aplikacji, działa offline).
- Profil: `interests` ma `min(1)` (`src/schemas/profile.ts`), więc wczytany profil zawsze ma co najmniej jedno zainteresowanie. „Brak zainteresowań” zdarza się tylko, gdy profil się jeszcze wczytuje albo nie dał się wczytać.
- `DiscoverScreen` jest używany w dwóch miejscach: zakładka Plan → „Odkryj” (`PlanScreen`, tylko gdy jest bieżąca podróż) i trasa `/discover` (wejście z pustego stanu „Podróż”, czyli gdy **nie ma** podróży — D16).

Założenia (do potwierdzenia razem z planem):
- **Z1** — Bez zmian w Zod, Supabase, Edge Function `recommend-places` i `PlaceCard` — backend już przyjmuje dokładnie `{ city, latitude, longitude, interests, locale }`. Zadanie tylko frontendowe.
- **Z2** — Cel podróży przekazuje `PlanScreen` do `DiscoverScreen` jako prop (np. `destination?: string`, kod IATA); `DiscoverScreen` sam nie czyta podróży. Trasa `/discover` nie przekazuje nic.
- **Z3** — Przycisk „Szukaj miejsc” zostaje (do wyszukania po zmianie miasta i jako ręczne wyszukanie, gdy auto się nie odpaliło).
- **Z4** — Tekst pustego wyniku „Nie znaleźliśmy miejsc dla tych zainteresowań. Spróbuj zmienić wybór.” nie pasuje, gdy nie ma wyboru zainteresowań. Propozycja: „Nie znaleźliśmy miejsc w tym mieście. Spróbuj innego miasta.” / en „We found no places in this city. Try another city.”
- **Z5** — Klucz `discover.interests` usuwam, jeśli przestanie być używany.

### Pytania do Kacpra (jedno po drugim; rekomendacja pierwsza)
- **P1 — Kiedy polecenia ładują się same?** Każde wyszukiwanie zużywa 1 z 5 dziennych zapytań i jedno płatne zapytanie Google.
  (a) **Przy pierwszym otwarciu „Odkryj” dla danego miasta w tej sesji aplikacji** — potem z pamięci, za darmo (już tak działa cache). Po zamknięciu i ponownym uruchomieniu aplikacji pierwsze otwarcie „Odkryj” znów kosztuje 1 zapytanie. Offline: nic się nie odpala; gdy internet wróci, a ekran jest otwarty — ładuje się wtedy. Samo otwarcie zakładki Plan nic nie ładuje, dopiero przełączenie na „Odkryj” (rekomendacja — zero nowego kodu cache).
  (b) **Raz na podróż na dzień** — wymaga zapisu na telefonie „już dziś załadowano”, ale samych wyników zapisać nie wolno (warunki Google), więc po restarcie aplikacji ekran byłby pusty z przyciskiem — dziwne.
  (c) Przy każdym otwarciu „Odkryj” — najdroższe, limit 5 zniknie szybko.
- **P2 — Profil się wczytuje albo nie dał się wczytać** (wtedy nie ma zainteresowań):
  (a) **Ładowanie profilu → szkielety jak przy wyszukiwaniu; błąd profilu → przycisk wyłączony + krótka notka „Nie udało się wczytać Twoich zainteresowań.”** (nowy klucz pl/en) (rekomendacja);
  (b) przycisk po prostu wyłączony, bez komunikatu.
- **P3 — Lotniska celu nie ma na liście lotnisk w aplikacji** (`findAirport` nic nie zwraca; rzadkie, ale możliwe przy starej liście):
  (a) **pole miasta puste, nic się nie ładuje, użytkownik wybiera miasto sam** (rekomendacja);
  (b) to samo + notka „Nie znamy lotniska celu, wybierz miasto.”
- **P4 — `/discover` bez podróży** (wejście z pustego stanu „Podróż”):
  (a) **tylko wybór miasta, bez chipów; zainteresowania z profilu; wyszukanie przyciskiem** (rekomendacja — spójne z „bez wyboru”);
  (b) zostawić tam chipy jak dziś.
- **P5 — Zmiana bieżącej podróży w szufladzie:**
  (a) **miasto przechodzi na cel nowej podróży i polecenia ładują się dla niego** (z pamięci, jeśli były już w tej sesji); ręcznie wybrane miasto przepada (rekomendacja — nowa podróż = nowy cel);
  (b) zostaje to, co było widać (jak D8 w planie przełącznika), aż użytkownik sam zmieni miasto.
- **P6 — Po wybraniu innego miasta:**
  (a) **trzeba nacisnąć „Szukaj miejsc”** — każde wyszukanie kosztuje, więc jest świadomą decyzją (rekomendacja);
  (b) szuka od razu po wybraniu miasta.

### Decyzje (Kacper)
Odpowiedzi Kacpra przekazane przez sesję-menedżera (2026-11-09), dosłownie: „1. Polecenia laduja sie same jak uzytkownik kliknie w zakladke odkryj miejsca czyli poszedl bym w twoja odpowiedz a 2. a 3. a 4. a 5. a 6. a”.
- **D1 — P1 = (a):** polecenia ładują się same po przełączeniu na „Odkryj”; jedno zapytanie na miasto na sesję aplikacji, potem z pamięci; offline nic, po powrocie internetu przy otwartym ekranie — ładuje się.
- **D2 — P2 = (a):** profil się wczytuje → szkielety; błąd profilu → przycisk wyłączony + notka „Nie udało się wczytać Twoich zainteresowań.” (nowy klucz pl/en).
- **D3 — P3 = (a):** nieznane lotnisko celu → pole miasta puste, nic się nie ładuje, użytkownik wybiera sam.
- **D4 — P4 = (a):** `/discover` bez podróży — tylko wybór miasta, bez chipów, zainteresowania z profilu, wyszukanie przyciskiem.
- **D5 — P5 = (a):** zmiana podróży w szufladzie → miasto przechodzi na cel nowej podróży i polecenia ładują się dla niego; ręczny wybór przepada.
- **D6 — P6 = (a):** po wybraniu innego miasta trzeba nacisnąć „Szukaj miejsc”.
- **D7 — Akceptacja:** plan zaakceptowany razem z założeniami Z1–Z5 (Kacper bezpośrednio: „Akceptuję”, 2026-11-09).
- Odpowiedzi Kacpra na P7, P8 i emulator, przekazane przez sesję-menedżera (2026-11-09), dosłownie: „1. moze zrobic testy na emulatorze pod warunkiem ze inna podsesja aktualnie go nie uzywa 2. Najlepiej by bylo aby an to pierwsze miasto dane wczytywaly sie raz a potem aplikacja pamietala to bedzie mniejsze zapotrzebowanie na api 3. Nie wiem w jaki sposob uzytkownik moglby zmienic jezyk nie wychodzac z odkryj jezeli uzytkwonik zmieni jezyk to wtedy rzeczywiscie najlepiej strzelic jeszcze raz do api”.
- **D8 — P8 = (a):** zmiana języka → nowe zapytanie do API (zostaje jak jest).
- **D9 — Emulator (krok 4):** wolno, pod warunkiem że żadna inna podsesja go teraz nie używa.
- **P7 — doprecyzowanie w toku:** Kacper chce, żeby dane dla pierwszego miasta wczytały się raz i były pamiętane. Pytanie uzupełniające: czy „pamiętać” = do zamknięcia aplikacji (jak dziś) + bez automatycznego ponawiania po błędzie, czy także między uruchomieniami.
- Odpowiedź Kacpra na doprecyzowanie P7 (przez menedżera, 2026-11-09), dosłownie: „powiedzmy do momentu kiedy podroz sie skonczy niech podsesja sprawdzi warunki google jezeli nie mozna to wtedy nie pozostaje nic innego niz strzelanie do api”.
- **Warunki Google (sprawdzone 2026-11-09 u źródła, https://developers.google.com/maps/documentation/places/web-service/policies):** trwale wolno trzymać tylko `placeId`; współrzędne do 30 dni; nazw, adresów i pozostałych pól nie wolno zapisywać (strona wprost zakazuje kopiowania „business names, addresses, or user reviews”), zalecenie: trzymać `placeId` i pobierać szczegóły na nowo. Zapis wyników do końca podróży jest więc niedozwolony; trzymanie samych `placeId` + powodów od AI wymagałoby po restarcie ~10 płatnych zapytań Place Details zamiast 1 wyszukania — drożej, nie taniej.
- **D10 — P7, pamięć:** polecenia trzymane w pamięci do zamknięcia aplikacji (jak dziś); po ponownym uruchomieniu nowe zapytanie do API — wariant, który Kacper przyjął, gdy zapis jest niedozwolony.
- **D11 — P7b = ponawiać samo:** po błędzie automatycznego wyszukania kolejne otwarcie „Odkryj” próbuje samo (zostaje jak jest, bez zmian w kodzie). Menedżer podał Kacprowi opcje „Tak, ponawiać samo” i „Nie, tylko przyciskiem „Spróbuj ponownie””; Kacper: „wezmy ta pierwsze opcje tak” (2026-11-09). Uwaga: menedżer opisał opcję pierwszą jako rekomendację orkiestratora, a orkiestrator polecał „tylko przyciskiem”.
- **D12 — Łączenie z #32 (karuzela zdjęć):** czekamy, aż #32 (i #31) zostaną scalone, potem rebase `feature/trip-recommendations` na wynik, rozwiązanie konfliktów (`DiscoverScreen` importy / testy, docs), pełny zestaw testów, typecheck, lint i verifier od nowa. Teraz #32 nie jest wciągany. Menedżer dał Kacprowi dwie opcje (najpierw: czekać na scalenie #32 i zrobić rebase; potem: scalić #32 teraz); Kacper: „zrobmy ta pierwsza opcje” (2026-11-09). 
- **D13 — Krok 4 po rebase:** test na urządzeniu raz, po rebase na scalone #32 / #31 (karty ze zdjęciami w tym samym przebiegu). Kacper: „po rebase” (przez menedżera, 2026-11-09). Wcześniejszy przebieg testera (przed tą decyzją) nie zastępuje kroku 4.
- **D14 — P9 = (a):** po wybraniu innego miasta (albo w trakcie wpisywania) wyniki poprzedniego miasta znikają do wyszukania nowego. Kacper: „ukryc stare wyniki” (przez menedżera, 2026-11-09). Krok 2b. Założenie orkiestratora: komunikat limitu dziennego zostaje widoczny (dotyczy użytkownika, nie miasta).

## Podejście
Przy rekomendacjach:
- `DiscoverScreen` dostaje opcjonalny prop `destination?: string` (IATA). Stan `picked: Airport | null` (ręczny wybór) — gdy `null`, miasto = `findAirport(destination)`. Gdy `destination` się zmieni (P5a), `picked` wraca do `null`.
- Zainteresowania = `useMyProfile().data?.profile.interests`; `InterestChips` i stan `edited` usunięte.
- Auto-ładowanie (P1a): `useEffect` — gdy jest `destination`, miasto nie jest wybrane ręcznie, zapytanie przechodzi `RecommendPlacesRequestSchema`, jest internet i hook nie ma jeszcze tego zapytania → `search(request)`. Powtórne otwarcie w tej samej sesji trafia w istniejący cache `usePlaceRecommendations` (zero zapytań). Sam hook bez zmian.
- `PlanScreen` przekazuje `destination={trips.data?.overview.trip.destination}`.
- `/discover` bez zmian w trasie — bez `destination` nic się nie ładuje samo.

*Odrzucone:* `DiscoverScreen` sam wołający `useCurrentTrip()` — wtedy `/discover` (ekran dla „brak podróży”) też by coś prefillował i oba wejścia byłyby sprzężone ukrycie.

## Struktury danych (Zod)
Brak zmian. Używam istniejących `RecommendPlacesRequestSchema` (`src/schemas/place.ts`, bez edycji — Z1), `AirportSchema`, `CurrentTripSchema`, `ProfileSchema`.

## Testy
**Krok 1 — `src/features/discover/__tests__/DiscoverScreen.test.tsx`** (napisane najpierw, widziane na czerwono):
1. Nie ma pola „Zainteresowania” ani chipów; wyszukanie wysyła zainteresowania z profilu.
2. Bez `destination`: pole miasta puste, fetcher nie jest wołany, dopóki użytkownik nie wybierze miasta i nie naciśnie przycisku (P4a).
3. Profil się wczytuje → przycisk wyłączony, nic się nie ładuje; błąd profilu → wg P2.
- Istniejące testy przerobione tylko tam, gdzie zakładały chipy (test „disables search until … at least one interest” zastąpiony testem profilu); reszta (ładowanie, pusto, błąd, limit, offline, atrybucja, Mapy) bez zmian i zielona.

**Krok 2 — ten sam plik + `src/features/plan/__tests__/PlanScreen.test.tsx`:**
1. Z `destination` (np. `LIS`): pole miasta pokazuje Lizbonę, fetcher wołany **raz** sam, z miastem, współrzędnymi z `findAirport`, zainteresowaniami z profilu i językiem.
2. Odmontowanie i ponowne zamontowanie (wyjście z „Odkryj” i powrót) → fetcher **nie** wołany drugi raz (cache).
3. Offline przy otwarciu → fetcher nie wołany; powrót internetu → wołany raz (P1a).
4. Wybór innego miasta → nic się nie wysyła do naciśnięcia przycisku (P6a); po naciśnięciu — zapytanie dla nowego miasta.
5. Nieznany IATA → pole puste, brak wywołania (P3).
6. Zmiana `destination` (nowa podróż) → miasto i zapytanie dla nowego celu, ręczny wybór przepada (P5a).
7. Limit dzienny przy auto-ładowaniu → komunikat limitu, bez pętli ponownych wywołań.
8. `PlanScreen`: przełączenie na „Odkryj” przy podróży z celem `LIS` → `DiscoverScreen` z Lizboną.

## Pliki
- Zmienione: `src/features/discover/DiscoverScreen.tsx`, `src/features/discover/__tests__/DiscoverScreen.test.tsx`, `src/features/plan/PlanScreen.tsx`, `src/features/plan/__tests__/PlanScreen.test.tsx`, `src/i18n/locales/pl.json`, `en.json` (Z4, Z5, ewentualnie P2).
- Bez zmian: `PlaceCard`, `src/schemas/place.ts`, `supabase/functions/recommend-places`, `usePlaceRecommendations`.
- Docs (krok 3): `docs/architecture/flows/features/discover-places.md`, `docs/architecture/frontend.md` (wiersze `/plan` i `/discover`), `docs/architecture/decisions.md` (zmiana D19 — zainteresowania już nie do edycji), `context/app-context.md` (pkt 18), ten plan.

## Skille
- `test-driven-development` — kroki 1–2 (red → green), frontend.
- `frontend-ui-engineering` — kroki 1–2 (stany, dostępność), frontend.
- Inne: brak.

## Kroki
- [x] **1. [frontend]** Bez chipów: zainteresowania tylko z profilu, stany profilu (P2, P4), tekst pustego wyniku (Z4) — testy najpierw → verifier.
- [x] **2. [frontend]** Cel podróży: prop `destination`, prefill przez `findAirport`, auto-ładowanie (P1, P3, P5, P6), `PlanScreen` przekazuje cel — testy najpierw → verifier.
- [ ] **2b. [frontend]** D14: ukrycie wyników (karty, pusto, błąd) gdy wybrane miasto różni się od wyszukanego — testy najpierw → verifier; docs (`discover-places.md`, `frontend.md`) poprawia orkiestrator.
- [x] **3. [orchestrator]** Docs (lista w „Pliki”) + ten plan → verifier.
- [ ] **4. [tester]** Na emulatorze — **tylko po zgodzie Kacpra** (jeden emulator, używa go sesja „discover-stack”): podróż z celem → „Odkryj” ładuje się samo; powrót do „Plan” i znów „Odkryj” → bez nowego zapytania (licznik „Zostało dziś” się nie zmienia); inne miasto + przycisk; zmiana podróży w szufladzie; offline; `/discover` bez podróży; jasny/ciemny; EN.
- [ ] **5.** Verifier całej gałęzi (CodeRabbit), commit. Push / PR tylko po zgodzie Kacpra.

## Weryfikacja
Każdy krok: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone, verifier PASS przed `[x]`. Krok 4: tester wg scenariuszy wyżej.

## Dziennik postępu
- 2026-11-09 — szkic planu, pytania P1–P6.
- 2026-11-09 — odpowiedzi P1–P6 = (a) (D1–D6). 
- 2026-11-09 — plan zaakceptowany (D7). Stos PR bez zmian (#30–#32 otwarte), gałąź dalej na #31.
- 2026-11-09 — krok 1: `DiscoverScreen` bez pola zainteresowań i stanu `edited`; zainteresowania z `useMyProfile`; profil ładuje się → blok `discover-loading`, błąd profilu → notka `discover.profileError` (przycisk wyłączony, bo zapytanie bez zainteresowań nie przechodzi schematu); `discover.empty` zmieniony (Z4), `discover.interests` usunięty (Z5). Testy: brak chipów, ładowanie i błąd profilu, nowy tekst pustego wyniku — czerwone przed zmianą; test „bez miasta nic się nie wysyła” zielony od razu (straż regresji). 192/3854, typecheck, lint zielone. Verifier: PASS. Skille: test-driven-development, frontend-ui-engineering.
- 2026-11-09 — krok 2: `DiscoverScreen` dostaje `destination?: string`; miasto = wybór ręczny albo `findAirport(destination)`; auto-wyszukanie w `useEffect`, gdy brak wyboru ręcznego, profil wczytany, zapytanie poprawne i online; `PlanScreen` przekazuje `overview.trip.destination`. Odstępstwo: stan wyboru ręcznego ma 3 wartości (`undefined` = cel podróży, `Airport` = wybrane, `null` = wpisany tekst bez wyboru), żeby wpisywanie nie wracało po cichu do miasta celu. Zmiana celu (D5) resetuje wybór. Mocki `PlanScreen` dostały `overview.trip.destination`. Testy: 7 nowych czerwonych na kodzie z kroku 1 (np. pole „" zamiast „Lisbon · LIS"), test nieznanego IATA zielony od razu (straż). 192/3862, typecheck, lint zielone. Verifier: PASS. Uwagi verifiera → P7, P8 w „Ryzyka”.
- 2026-11-09 — krok 3: docs — `frontend.md` (`/discover`, `/plan`), `flows/features/discover-places.md` (formularz, auto-ładowanie, stany; poprawiona nieaktualna etykieta „Znajdź miejsca” → „Szukaj miejsc”), `decisions.md` (nowy wpis, zastępuje edytowalne zainteresowania z D19), `overview.md`, `known-limitations.md` (P7, P8), `context/app-context.md` (pkt 18). Verifier: PASS (192/3862, typecheck, lint). Uwaga verifiera (sprzed tego zadania): polityka prywatności mówi, że Google dostaje „tylko miasto i zainteresowania”, a zapytanie ma też współrzędne — do decyzji Kacpra.
- 2026-11-09 — krok 4 (tester): **zablokowany** — brak serwera Metro (nic nie nasłuchuje na 8081/8082/19000/19006), emulator `emulator-5554` widoczny w adb, ale nie odpowiada (`adb shell` wisi), mobile-mcp nie widzi urządzenia. Zero wyszukań, nic nie zmieniono. Potrzebny restart emulatora i Metro z tego worktree (Kacper).
- 2026-11-09 — krok 5: verifier końca planu (Sonnet 5.5 + CodeRabbit, baza `origin/claude/plan-discover-switch-1cf264`): PASS, CodeRabbit 0 uwag (14 plików); 192/3862, typecheck, lint zielone. Krok `[x]` dopiero po kroku 4 lub decyzji Kacpra, żeby go pominąć.
- 2026-11-09 — przebieg testera przed D13 (wstępny, nie zamyka kroku 4): `Medium_Phone_API_37.0`, Expo Go, Metro 8081 z tego worktree; bundle = ta gałąź (bez chipów, „Lisbon · LIS”). PASS: auto-ładowanie (szkielety → karty, „Dane: Google”, licznik), powrót Plan → Odkryj bez nowego zapytania (licznik bez zmian), wybór „Porto · OPO” nic nie ładuje, offline (baner, przycisk wyłączony), przewinięcie do końca nad pigułką. Nie zrobione: naciśnięcie „Szukaj miejsc”, zmiana podróży (oszczędzanie limitu — zostało 1), ciemny motyw. Zużyte: 1 wyszukanie. Sieć włączona na końcu.

## Ryzyka i otwarte pytania
- **R1 — Konflikt z PR #32.** #32 wynosi `PlaceCard` z `DiscoverScreen.tsx` do osobnego pliku i zmienia test `DiscoverScreen`; ten plan też edytuje oba pliki. Gałąź stoi na #31; po scaleniu #32 trzeba będzie zrobić rebase i ręcznie scalić importy / testy (zmiany nie dotykają karty, więc konflikt powinien być mechaniczny). Alternatywa: oprzeć gałąź na #32 — tylko jeśli Kacper woli.
- **R2 — Koszt.** Auto-ładowanie zwiększa zużycie limitu (dziś zapytanie jest tylko po naciśnięciu). P1a ogranicza to do 1 zapytania na miasto na sesję aplikacji.
- **R3 — Zmiana D19** (zainteresowania do edycji na ekranie) — to zadanie ją odwraca; zapiszę w `decisions.md`.
- **R4 — Test na urządzeniu** zależy od wolnego emulatora i od tego, czy konto testowe ma podróż (P8 z planu przełącznika: 2 podróże „TEST …”).
- Pytania P1–P6 wyżej (rozstrzygnięte).
- **P7 — Ponowne auto-wyszukanie po błędzie** (verifier, krok 2; TanStack: zapytanie bez danych jest „nieświeże” mimo `staleTime: Infinity`): gdy automatyczne wyszukanie skończy się błędem (`failed` albo `limit_reached`), każde kolejne otwarcie „Odkryj” w tej sesji próbuje jeszcze raz samo. Przy `failed` to kolejne zużyte zapytanie z limitu (limit pobierany przed Google); przy `limit_reached` serwer odmawia bez kosztu Google. (a) zostawić — ponowne otwarcie = ponowna próba (rekomendacja: zero kodu; po limicie nic nie kosztuje); (b) po błędzie nie ponawiać samo, tylko przyciskiem „Spróbuj ponownie”.
- **P9 — Stare wyniki pod nowym miastem** (tester): po wybraniu innego miasta karty poprzedniego miasta zostają widoczne do naciśnięcia „Szukaj miejsc”. (a) ukryć wyniki, gdy wybrane miasto różni się od wyszukanego (rekomendacja — mała zmiana + test); (b) zostawić.
- **P8 — Zmiana języka** przy otwartym „Odkryj” uruchamia nowe płatne wyszukanie (język jest w zapytaniu — powody od AI są w tym języku). (a) zostawić (rekomendacja — rzadkie); (b) język tylko przy ręcznym wyszukaniu.
