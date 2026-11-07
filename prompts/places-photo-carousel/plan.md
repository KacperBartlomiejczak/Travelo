# Zadanie: Karuzela zdjęć na kartach miejsc (Discover)
Status: zaakceptowany 2026-11-07 („Tak, rekomendacje”, przekazane przez sesję-menedżera), w trakcie

## Zrozumienie i założenia
- Kacper chce, żeby każda karta miejsca na `/discover` miała przesuwaną karuzelę zdjęć miejsca — żeby było widać, jak wygląda.
- **To zmienia D15** (`prompts/places-legal-navbar/plan.md`): wtedy wybrano karty **bez zdjęć**, bo każde zdjęcie Google to osobne płatne zapytanie. Nowa decyzja zastąpi D15 w części „bez zdjęć” (oceny i mapa dalej poza zakresem).
- Zakres: tylko karta miejsca, `src/schemas/place.ts`, Edge Function `recommend-places` (+ `src/lib/place-types.ts`). **Nie ruszam** zakładki „Podróż” ani wejścia do Discover (inna sesja dodaje przełącznik Plan↔Discover).
- Bez nowych zależności: `expo-image` jest w projekcie, karuzela to poziomy `FlatList` z `pagingEnabled` (wzór: `src/features/trip-photos/PhotoViewer.tsx`).
- Klucz Google **nigdy** nie trafia do aplikacji.

## Podejście
1. **Skąd zdjęcia (D1):** Nearby Search (New) zwraca pole `places.photos` (nazwy zasobów `places/{id}/photos/{ref}`, `widthPx`, `heightPx`, `authorAttributions`). Edge Function, **po** wyborze miejsc przez Gemini (żeby nie płacić za zdjęcia odrzuconych kandydatów), dla każdego wybranego miejsca wywołuje Place Photos (New): `GET /v1/{name}/media?maxWidthPx=…&skipHttpRedirect=true` z kluczem w nagłówku. Google zwraca `photoUri` — krótko żyjący adres `googleusercontent.com` **bez klucza** — i ten adres idzie do aplikacji. Zapytania równolegle, z limitem czasu; nieudane zdjęcie jest pomijane (nigdy nie psuje całej odpowiedzi).
2. **Aplikacja:** `PlaceCard` wydzielona do `src/features/discover/PlaceCard.tsx`; karuzela nad treścią karty (Q3), kropki/licznik stron, podpis autora zdjęcia (Q6), stan „brak zdjęcia” (Q4), `CoverImage`-podobne zanikanie (bez animacji przy reduce motion), zdjęcie nieudane → placeholder, nie dziura.
3. **Koszt:** zapytań o zdjęcia na wyszukiwanie = (liczba miejsc ≤ 10) × (zdjęć na kartę, Q2). Czy `places.photos` nie podnosi SKU Nearby Search z Pro na droższy i aktualne ceny Place Photos — **sprawdzić u źródła (docs Google) w kroku 1, przed kodem**, wynik zapisać w dzienniku.

## Struktury danych (Zod) — szkic, ostatecznie po Q1–Q6
- `GooglePlacePhotoSchema` = `{ name: string, widthPx: int, heightPx: int, authorAttributions: [{ displayName: string, uri?: url }] (default []) }`; `GooglePlaceSchema.photos: array(GooglePlacePhotoSchema).default([])`.
- `PlacePhotoSchema` = `{ uri: url, width: int, height: int, authors: [{ name: string, uri?: url }] }` — to, co dostaje aplikacja.
- `PlaceRecommendationSchema.photos: array(PlacePhotoSchema).max(3)` (D2); pusta tablica = brak zdjęć.
- Kandydat w funkcji niesie wewnętrznie nazwy zdjęć (`photoRefs`); nie trafiają do Gemini ani do aplikacji.
- `NEARBY_FIELD_MASK` + `places.photos`.
- Brak zmian w bazie (nic od Google nie jest zapisywane) → bez migracji i regeneracji typów.

## Testy (najpierw, czerwone z właściwego powodu)
- `src/schemas/__tests__/place*.test.ts`: nowe pola; zły `uri` / za dużo zdjęć odrzucone.
- `src/lib/__tests__/place-types*.test.ts`: `parseNearbySearch` mapuje `photos` → `photoRefs`, brak `photos` → `[]`; maska zawiera `places.photos`.
- `supabase/functions/recommend-places/__tests__/`: handler pobiera zdjęcia tylko dla wybranych miejsc, max N na miejsce; błąd/timeout jednego zdjęcia → pominięte, reszta odpowiedzi OK; fallback bez Gemini też dostaje zdjęcia; port `resolvePhoto` wysyła klucz w nagłówku, `skipHttpRedirect=true`, nigdy nie loguje klucza.
- `src/features/discover/__tests__/PlaceCard.test.tsx`: karuzela z N zdjęciami (`pagingEnabled`), wskaźnik strony, podpis autora, stan bez zdjęć, błąd ładowania → placeholder, etykiety a11y (PL/EN); istniejące `DiscoverScreen.test.tsx` dalej zielone.

## Pliki
- `src/schemas/place.ts`, `src/lib/place-types.ts`, `src/lib/place-picks.ts` (jeśli potrzebne przeniesienie `photoRefs`)
- `supabase/functions/recommend-places/handler.ts`, `ports.ts`, `__tests__/*`
- `src/features/discover/PlaceCard.tsx` (nowy), `DiscoverScreen.tsx` (tylko import karty), `__tests__/PlaceCard.test.tsx`
- `src/theme/tokens.ts` (rozmiar karuzeli, jeśli brak tokenu), `src/i18n/*` (klucze `discover.photo*`)
- Docs: `docs/architecture/backend.md`, `shared.md`, `frontend.md`, `flows/features/discover-places.md`, `decisions.md`, `known-limitations.md`, `context/design-context.md` (jeśli nowy wzór karty)

## Skille
- source-driven-development — krok 1 — pola, SKU i ceny Places Photos z dokumentacji Google, nie z pamięci
- test-driven-development — kroki 1–3 — red → green
- supabase — krok 2 — Edge Function i wdrożenie
- frontend-ui-engineering, ui-taste — krok 3 — karuzela zgodna z design-context
- code-review — krok 5 — przegląd całej gałęzi (CodeRabbit)

## Kroki
- [x] 1. [backend] Zod + mapowanie: sprawdzić u źródła pola/SKU/ceny; schematy zdjęć, `photoRefs` kandydata, `places.photos` w masce — skill: source-driven-development, test-driven-development — najpierw testy: schemat, `parseNearbySearch` — weryfikacja: verifier
- [ ] 2. [backend] Edge Function: port `resolvePhoto`, pobieranie ≤ N zdjęć dla wybranych miejsc, równolegle, z limitem czasu, błędy pomijane — skill: test-driven-development, supabase — najpierw testy: handler + port na fake'ach — weryfikacja: verifier; **wdrożenie funkcji na hostowany projekt tylko za zgodą Kacpra**
- [ ] 3. [frontend] `PlaceCard` z karuzelą, wskaźnikiem, podpisem autora, stanem bez zdjęcia i błędu, i18n PL/EN, tokeny — skill: frontend-ui-engineering, ui-taste, test-driven-development — najpierw testy: `PlaceCard.test.tsx` — weryfikacja: verifier
- [ ] 4. [tester] Na urządzeniu: wyszukiwanie z kartami ze zdjęciami, przesuwanie, miejsce bez zdjęć, offline, EN + ciemny motyw — weryfikacja: zrzuty
- [ ] 5. Docs (orkiestrator) + verifier końca planu z CodeRabbit

## Dziennik postępu
- 2026-11-07 — plan napisany; czeka na odpowiedzi Q1–Q6 i akceptację.
- 2026-11-07 — Kacper: Q1 = (a) → D1.
- 2026-11-07 — Kacper (przez sesję-menedżera): „Tak, rekomendacje” → Q2–Q6 = (a) → D2–D6; menedżer uprzedził, że to też akceptacja planu → plan zaakceptowany. N = 3.
- 2026-11-07 — Krok 1, sprawdzenie u źródła (developers.google.com/maps/documentation/places/web-service/nearby-search i …/place-photos): `places.photos` wywołuje **Nearby Search Pro** (ten sam SKU co dziś, bez podwyżki); Place Photos: `GET /v1/{name}/media?maxWidthPx|maxHeightPx (1–4800)&skipHttpRedirect=true` → `{ name, photoUri }`; nazw zdjęć nie wolno cache'ować (wygasają); `authorAttributions` zawsze obecne, może być puste, niepuste trzeba pokazać przy zdjęciu. Docs pokazują klucz tylko jako `?key=` — nagłówek `X-Goog-Api-Key` do potwierdzenia w kroku 2/4 (klucz w URL tylko po stronie serwera). Ceny SKU Place Photos strona nie podaje — do sprawdzenia przez Kacpra w konsoli Google Cloud.
- 2026-11-07 — Krok 1: backend napisał kod przed testami (odstępstwo od TDD); red potwierdzony wstecz przez orkiestratora (stary kod produkcyjny + nowe testy: 10 failed / 63 passed). Verifier: FAIL — tylko przeformatowanie niezwiązanego kodu (prettier z zgadniętymi opcjami); cofnięte. Ponownie verifier: **PASS** (191/3847, typecheck, lint exit 0). Schematy: `PhotoAuthorSchema`, `GooglePlacePhotoSchema`, `PlacePhotoSchema`, `PlacePhotoRefSchema`, `MAX_PLACE_PHOTOS = 3`; `PlaceSchema.photoRefs` (wewnętrzne), `PlaceRecommendationSchema` bez `photoRefs`, `photos` ≤ 3 (na razie `[]`). Maska + `places.photos`. Uwaga bez blokady: `void photoRefs;` jako obejście lintu.

## Decyzje
- **D1 — Q1 = (a): Edge Function rozwiązuje `photoUri`** (`skipHttpRedirect=true`, klucz w nagłówku) dla miejsc wybranych przez Gemini i zwraca aplikacji gotowe adresy bez klucza; bez drugiej funkcji (Kacper, 2026-11-07).
- **D2 — Q2 = (a): maks. 3 zdjęcia na kartę** (mniej, jeśli Google ma mniej) (Kacper, 2026-11-07).
- **D3 — Q3 = (a): zdjęcie na górze karty**, proporcje 4:3, górne rogi `radius.lg`, tekst pod nim jak dziś (Kacper, 2026-11-07).
- **D4 — Q4 = (a): miejsce bez zdjęć** — karta bez obszaru zdjęcia, jak dziś (Kacper, 2026-11-07).
- **D5 — Q5 = (a): zdjęcia tylko w pamięci** (`expo-image` `cachePolicy: 'memory'`), nic na dysku (Kacper, 2026-11-07).
- **D6 — Q6 = (a): atrybucja „Fot. <autor>”** na dole zdjęcia na `hero.scrim`, dotyk otwiera `uri` autora; „Dane: Google” pod listą zostaje (Kacper, 2026-11-07).

## Ryzyka i otwarte pytania
- ✅ **Q1** → D1. **Q1 — Skąd zdjęcia / jak przechodzą do aplikacji:** (a) Edge Function rozwiązuje `photoUri` (`skipHttpRedirect`) dla wybranych miejsc i zwraca gotowe adresy bez klucza — **rekomendacja**: jedno wywołanie z aplikacji, klucz zostaje na serwerze, zero nowych funkcji; minus: płacimy za wszystkie N zdjęć z góry, nawet nieprzesunięte. (b) Funkcja zwraca tylko nazwy zdjęć, a osobna Edge Function `place-photo` rozwiązuje je leniwie przy przesunięciu — taniej, ale druga funkcja, wolniejsze przesuwanie, trzeba ją chronić limitem. (c) Proxy przesyłające same bajty zdjęcia przez Edge Function — najwięcej ruchu i kosztu po naszej stronie, odradzam.
- ✅ **Q2** → D2. **Q2 — Ile zdjęć na kartę:** (a) 3 — rekomendacja (≤ 30 zapytań o zdjęcia na wyszukiwanie), (b) 5, (c) 1 (bez karuzeli).
- ✅ **Q3** → D3. **Q3 — Układ karty:** (a) zdjęcie na górze karty (proporcje 4:3, zaokrąglone górne rogi `radius.lg`), tekst pod nim jak dziś — rekomendacja; design-context: „nie zamieniaj każdej karty w plakat”; (b) zdjęcie na całą kartę, tekst na `hero.scrim`.
- ✅ **Q4** → D4. **Q4 — Brak zdjęć:** (a) karta bez obszaru zdjęcia, jak dziś — rekomendacja; (b) placeholder tej samej wysokości z ikoną (równa lista).
- ✅ **Q5** → D5. **Q5 — Offline / pamięć podręczna:** zdjęcia tylko w pamięci (`expo-image` `cachePolicy: 'memory'`), zgodnie z zasadą „od Google zapisujemy tylko `placeId`” — rekomendacja; `photoUri` i tak wygasa. Alternatywa: domyślny cache dyskowy (do sprawdzenia z regulaminem Google).
- ✅ **Q6** → D6. **Q6 — Atrybucja:** Google wymaga pokazania autora zdjęcia (`authorAttributions`) przy zdjęciu. (a) mały podpis „Fot. <autor>” na dole zdjęcia na `hero.scrim`, dotyk otwiera profil autora — rekomendacja; (b) podpis pod zdjęciem w karcie. „Dane: Google” pod listą zostaje.
- Ryzyko: `photoUri` wygasa — karta otwarta długo może nie doładować kolejnego zdjęcia (wtedy placeholder); do `known-limitations.md`.
- Ryzyko: dłuższy czas odpowiedzi (dodatkowe zapytania po Gemini); limit czasu zdjęć do ustalenia w kroku 2 (propozycja 5 s, całość nie przekracza obecnych limitów o więcej niż ten czas).
