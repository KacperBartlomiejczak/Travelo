# Zadanie: Naprawa navbara + polityka prywatności i regulamin + Google Places i „Odkryj miejsca” z AI
Status: strumień A (navbar) zaakceptowany 2026-11-05, w realizacji; B i C czekają na P2–P8
Gałąź: `feature/places-legal-navbar` (od `origin/main`, 2026-11-04)

## Zrozumienie i założenia
Jeden plan, trzy strumienie pracy (Kacper, 2026-11-04):

- **A — Navbar.** Naprawić błąd pigułki nawigacji ze zrzutu Kacpra (2026-11-05) i **usunąć zakładkę „Miejsca”**, żeby pozostałe cztery zakładki miały więcej miejsca (D3), oraz **zmienić wygląd pigułki** wg wzoru od Kacpra (D4).
- **B — Prawo.** Polityka prywatności i regulamin (Terms of Use) po polsku i angielsku, dostępne w aplikacji i pod publicznym adresem URL (wymagany przez App Store i Google Play), plus to, co realnie zmniejsza ryzyko prawne: wyłączenie odpowiedzialności za rekomendacje AI, atrybucja Google, usuwanie konta (wymóg obu sklepów).
  - **Uczciwie:** żaden dokument nie gwarantuje, że „nikt nie pozwie aplikacji”. Mogę przygotować porządne wzory oparte na RODO i wymaganiach sklepów, ale przed publikacją **powinien je przejrzeć prawnik**. Zapiszę to w samym dokumencie jako notatkę dla Kacpra (nie dla użytkownika).
- **C — Google Places + AI.** Gdy użytkownik nie ma żadnej podróży, może sprawdzić, jakie miejsca poleca mu AI na podstawie jego zainteresowań. Prawdziwe miejsca z Google Places, Gemini (klucz z Google AI Studio) tylko je wybiera i opisuje — nigdy nie wymyśla (zasada z `docs/architecture/flows/ai-day-plan.md`).

„Gotowe” = wszystkie kroki `[x]` po PASS verifiera, pełny zestaw testów + `pnpm typecheck` + `pnpm lint` na zielono, test na urządzeniu (tester) dla A i C, zaktualizowane `docs/architecture/` i `context/app-context.md`.

Stan obecny (zwiad, 2026-11-04):
- Pigułka: `src/components/PillNav.tsx`, `src/app/(drawer)/(tabs)/_layout.tsx`, odstęp w `src/features/nav/usePillClearance.ts` (inset + `spacing[3]` = 12 dp; dokumentacja mówi 16 dp — rozjazd do poprawy w docs). Brak obsługi klawiatury w pigułce.
- Prawo: brak polityki, regulaminu i zgód. **Usuwanie konta już istnieje** (plan `prompts/profile-settings/plan.md`, aktualizacja 2026-11-05): Edge Function `supabase/functions/delete-account/`, `useDeleteAccount`, `DeleteAccountDialog`, „Usuń konto” w `src/features/profile/SettingsScreen.tsx` — P4, B3 i B4 są nieaktualne.
- Places/AI: brak schematów miejsc i funkcji `recommend-places`; jedyna Edge Function to `delete-account` (wzorzec do naśladowania). Ekrany „Miejsca” i „Plan” to placeholdery. Pusty stan ekranu głównego: `src/app/(drawer)/(tabs)/index.tsx:116-127`.
- Zależności: brak `react-native-maps`, `expo-location`, `@google/genai`. Są `expo-web-browser` i `expo-linking` (otwieranie linków bez nowej zależności).

Założenia:
- **A1 — Klucze API nie trafiają do aplikacji.** `GOOGLE_MAPS_API_KEY` i `GEMINI_API_KEY` to **sekrety Edge Functions** (`supabase secrets set ...`), nie zmienne `EXPO_PUBLIC_*` — wszystko z prefiksem `EXPO_PUBLIC_` jest publiczne w paczce aplikacji. Kacper ustawia je sam w terminalu; **nie wklejaj kluczy na czacie**. Do `.env.example` (lub `supabase/functions/.env.example`) trafią tylko nazwy.
- **A2 — Gemini wywołujemy przez REST (`fetch`) z Edge Function**, bez nowej zależności w aplikacji. ID modelu z sekretu `GEMINI_MODEL` (zasada: nigdy na sztywno).
- **A3 — Miasto bez podróży** wybiera się z wbudowanej listy lotnisk (`Airport` ma `city`, `latitude`, `longitude`) — reużycie `AirportField`/`searchAirports`, bez geolokalizacji i bez nowej zależności (P5).
- **A4 — Zainteresowania** = `profile.interests` z `useMyProfile()`, z możliwością zmiany na ekranie (chipy `InterestChips`) tylko na potrzeby tego wyszukiwania (nie zapisujemy do profilu).

## Pytania do Kacpra (blokują część planu)
- **P1 — Zrzut navbara.** ~~Nie dotarł~~ — dotarł 2026-11-05. Na zrzucie: lewy koniec pigułki jest zaokrąglony, **prawy jest ucięty prosto**, razem z różową kapsułą „Profil”; etykiety są ściśnięte (Podróż / Wydatki / Miejsca prawie się stykają).
- **P1a — Co dokładnie jest błędem?** (a) ucięty prawy koniec pigułki i kapsuły „Profil” — rekomendacja, tak to czytam ze zrzutu; (b) tylko ścisk etykiet (zrzut przycięty przez Ciebie, prawy koniec w rzeczywistości jest OK); (c) coś innego. Do tego: telefon / Android czy iOS? *(Po D4 mniej ważne: nowy wygląd zastępuje obecną pigułkę, ucięcie sprawdzimy na nowym kodzie.)*
- **P9 — Nowy wygląd (wzór 2026-11-05):** aktywna zakładka to wypełniona kapsuła z ikoną i etykietą w rzędzie, nieaktywne to osobne okrągłe przyciski z samą ikoną. W naszych kolorach proponuję: kapsuła `brand.primary` (koral `#E96F51` / ciemny `#F07D5E`) z ikoną i tekstem `brand.onBrand`; kółka `surface.elevated` + `elevation.level2` (w ciemnym obramowanie, §5.2), ikona `icon.secondary`. Pytanie: (a) osobne kółka bez wspólnego tła, jak na wzorze — rekomendacja; (b) kółka i kapsuła na jednym wspólnym tle pigułki. Do tego: kapsuła zmienia szerokość z animacją (§7.3, bez animacji przy „ogranicz ruch”) — ok?
- **P2 — Dane administratora do dokumentów:** imię i nazwisko albo firma, adres, e-mail kontaktowy, kraj (zakładam Polskę / RODO). Bez tego dokumenty nie są ważne.
- **P3 — Gdzie publiczny URL dokumentów?** (a) GitHub Pages z tego repo (rekomendacja: darmowe, wersjonowane razem z kodem), (b) publiczny bucket Supabase Storage, (c) Twoja strona.
- **P4 — nieaktualne (2026-11-05):** usuwanie konta zrobiono w `profile-settings`. Pierwotna treść: **Usuwanie konta w aplikacji** („Usuń konto” w Ustawieniach, Edge Function kasuje użytkownika; podróże i wydatki znikają kaskadowo — D17 z wydatków). Apple i Google tego wymagają przed publikacją. (a) Robimy teraz — rekomendacja, (b) później, osobny plan.
- **P5 — Dostawca miejsc** (szczegóły w „Podejście → dostawca”): (a) Google Places API (New) + limit dzienny na użytkownika — rekomendacja, (b) Geoapify (OpenStreetMap, dużo taniej, słabsza jakość „co warto zobaczyć”, brak ocen i zdjęć), (c) Foursquare.
- **P6 — Wygląd wyników:** (a) lista kart: nazwa, typ, adres, krótkie „dlaczego dla Ciebie” od AI, przycisk „Otwórz w Mapach Google” — rekomendacja, bez mapy i bez nowej zależności; (b) jak (a) + ocena Google (droższy poziom zapytań); (c) jak (b) + zdjęcie miejsca (jeszcze drożej, każde zdjęcie to osobne płatne zapytanie).
- **P7 — Gdzie wejście do funkcji:** (a) przycisk „Odkryj miejsca” w pustym stanie ekranu „Podróż” prowadzący do nowego ekranu `/discover`. ~~(b) zakładka „Miejsca”~~ — odpada, zakładkę usuwamy (D3).
- **P8 — Limit i koszt AI:** ile zapytań dziennie na użytkownika? Rekomendacja: 5/dzień, licznik w tabeli Supabase. Oraz: Gemini na darmowym poziomie tylko w developmencie, płatny przed wydaniem (`ai-day-plan.md` wymaga Twojej decyzji). Model: `gemini-2.5-flash` (tani) — do potwierdzenia.

## Podejście

### A — Navbar
- **Usunięcie „Miejsca” (D3):** wpis `places` znika z `NAV_TABS` (`src/features/nav/tabs.ts`), plik trasy `src/app/(drawer)/(tabs)/places.tsx` jest usuwany, klucz i18n `nav.places` usuwany z `pl.json`/`en.json` (nigdzie indziej nieużywany). Pigułka sama rozdziela szerokość (`flex: 1`), więc cztery zakładki dostają ~25% szerokości zamiast 20% — **bez zmian w tokenach**. `/places` przestaje istnieć (zwykły „nie znaleziono” expo-router; w aplikacji nie ma do niego linków).
- **Nowy wygląd (D4, P9):** `PillNav.tsx` przebudowany: rząd 4 elementów wyśrodkowany nad dołem ekranu; aktywny = kapsuła (wysokość 48, `radius.pill`, padding poziomy 16, ikona + `labelMD`/`labelSM` w rzędzie, odstęp 8), nieaktywne = kółka 48×48 (cel dotyku ≥ 44) z samą ikoną; `accessibilityLabel` z etykietą zostaje dla każdego, więc czytnik ekranu nic nie traci. Etykieta nieaktywnych znika, więc reguła „R1 — duża czcionka” (`MAX_FONT_SCALE_WITH_LABELS`) przestaje być potrzebna. Tokeny `components.tabs` zmienione w miejscu (bez nowych tokenów obok starych), design-context §8.14 zaktualizowany przeze mnie. Odstęp od dołu (`usePillClearance`) bez zmian.
- **Błąd ucięcia (P1a = a):** pigułka ma stałą szerokość `min(width − 32, 720)`, a jej dzieci nie mogą jej przycinać (brak `overflow: hidden`) — więc ucięcie robi **rodzic**: kontener paska zakładek z `expo-router/js-tabs` albo `width` z `useWindowDimensions()` większy niż realny obszar (Android edge-to-edge). To hipoteza, nie pewnik. Kolejność: tester odtwarza błąd na emulatorze (zrzut + pomiar), frontend pisze test odtwarzający przyczynę (np. szerokość pigułki liczona z wymiaru kontenera, a nie okna), potem poprawka w `PillNav.tsx` — w praktyce razem z przebudową (D4); tester sprawdza nowy wygląd na urządzeniu.
- Jeśli po usunięciu „Miejsc” i poprawce wciąż jest ciasno — wracam do Ciebie, zanim ruszę tokeny.
- Przy okazji poprawka rozjazdu 12 vs 16 dp w `docs/architecture/frontend.md` i `overview.md` (kod wygrywa).

### B — Prawo
- Teksty w `docs/legal/privacy-policy.{pl,en}.md` i `docs/legal/terms.{pl,en}.md` (piszę ja, orkiestrator — `docs/` to moja działka). Treść polityki wynika z tego, co aplikacja faktycznie robi: konto (Google/Discord/e-mail), profil i zainteresowania, imiona znajomych bez konta, zdjęcia bez EXIF/GPS, wydatki, przetwarzanie w Supabase (UE?), Google Places i Gemini jako odbiorcy zapytań (tylko miasto i zainteresowania, bez danych osobowych), okres przechowywania, prawa z RODO, usuwanie konta, kontakt.
- Regulamin: zasady korzystania, konto, treści użytkownika, **AI i rekomendacje mają charakter informacyjny, sprawdź godziny/ceny/bezpieczeństwo samodzielnie**, brak gwarancji, ograniczenie odpowiedzialności w granicach prawa konsumenckiego, prawo właściwe, zmiany regulaminu. Atrybucja danych Google.
- W aplikacji: ekran `/legal/[doc]` (polityka / regulamin) — tekst z plików i18n jako lista sekcji (nagłówek + akapity), przewijany, w tokenach motywu. Linki: w Ustawieniach („Polityka prywatności”, „Regulamin”) i w arkuszu logowania („Kontynuując, akceptujesz Regulamin i Politykę prywatności.”).
- Publiczny URL wg P3; adres w `app.json` nie jest wymagany, ale trafi do docs i formularzy sklepów.
- Usuwanie konta wg P4: Edge Function `delete-account` (JWT użytkownika → klucz service role usuwa użytkownika Auth i jego pliki w `avatars` i zdjęcia podróży), w Ustawieniach „Usuń konto” z potwierdzeniem, wyłączone offline, potem lokalne czyszczenie jak przy wylogowaniu (`clearUserData`).
- Odrzucone: zewnętrzny generator polityk (Termly itp.) — płatny i nie zna naszych przepływów danych.

### C — Google Places + Gemini („Odkryj miejsca”)
Przepływ bez halucynacji (zgodny z `ai-day-plan.md`):
1. Aplikacja → Edge Function `recommend-places` z `{ city, lat, lng, interests[], locale }` (walidacja Zod, wymagany zalogowany użytkownik, limit dzienny P8).
2. **Deterministyczne** mapowanie zainteresowań → typy miejsc Google (np. `museums → museum`, `art_galleries → art_gallery`, `landmarks → tourist_attraction, historical_landmark`, `nature_parks → park, national_park`, `beaches → beach`, `cafes_desserts → cafe, bakery`, `nightlife → bar, night_club`, `theme_parks → amusement_park`, `spa_wellness → spa`, `shopping → shopping_mall, market` …) — czysta funkcja z testem, bez AI.
3. Google Places **Nearby Search (New)** wokół współrzędnych miasta, `includedTypes` z punktu 2, maska pól tylko na potrzebne pola (`id, displayName, formattedAddress, location, types, googleMapsUri` [+ `rating` jeśli P6 b/c]). Odpowiedź walidowana Zod.
4. Gemini dostaje **tylko listę kandydatów** (id, nazwa, typy) i zainteresowania; structured output (schemat JSON z Zod) zwraca `[{ placeId, reason }]` — maks. 10. Odpowiedź parsowana Zod, **każde `placeId` spoza kandydatów jest odrzucane**. Gdy Gemini zawiedzie → zwracamy kandydatów z Google bez opisów (funkcja dalej działa).
5. Aplikacja pokazuje listę (P6), „Otwórz w Mapach Google” przez `Linking.openURL(googleMapsUri)`, atrybucja „Dane: Google”.
- Logika (mapowanie, budowa zapytań, filtrowanie odpowiedzi AI) jako czyste moduły TS testowane w Jest; Edge Function to cienka warstwa (Deno). Odpowiedzi Google i Gemini w testach to nagrane fixtury (`docs/development/testing.md`), nigdy na żywo.
- Cache: warunki Google pozwalają trwale trzymać tylko `placeId` (`backend.md:44`), więc **nie** cache'ujemy treści na serwerze; w aplikacji tylko pamięć TanStack Query na czas sesji. Koszt kontroluje limit dzienny.
- Offline: ekran pokazuje stan offline z komunikatem (funkcja wymaga sieci); nie dodajemy jej do zakresu offline.
- Odrzucone: pozwolić Gemini samemu „wymyślić” listę miejsc z nazwy miasta (halucynacje, łamie zasadę projektu). Prostsza alternatywa: same wyniki Google bez AI — tańsza, ale bez personalizacji, której chcesz.

#### Dostawca — porównanie (P5)
| | Google Places (New) | Geoapify (OSM) | Foursquare |
|---|---|---|---|
| Darmowo | ~5 000 zapytań/mies. na SKU Pro, 10 000 Essentials (od 03.2025) | ~3 000 zapytań **dziennie** | źródła się różnią (500–10 000/mies.) |
| Potem | ok. $32 / 1000 (Pro), oceny/godziny drożej (Enterprise ~$35–40) | ok. $0,40 / 1000 wg porównywarek | ok. $15 / 1000 |
| Jakość „warto zobaczyć” | najlepsza, aktualne dane | dobra dla muzeów/parków, słabsza dla knajp, brak ocen | dobra dla knajp, oceny i zdjęcia |
| Cache | tylko `placeId` | dowolny (licencja ODbL, wymaga atrybucji OSM) | ograniczony |

Ceny z blogów porównawczych, nie z oficjalnych cenników — sprawdzę je u źródła przed krokiem C2. Rekomendacja: **Google** (jakość + `placeId` przydatne później dla planu dnia), z limitem 5/dzień: nawet 1 000 aktywnych użytkowników × 5 zapytań/dzień to dużo powyżej darmowej puli, więc limit i ewentualny paywall (RevenueCat, kolejny plan) mają znaczenie. Jeśli koszt ma być minimalny od razu → Geoapify, za cenę jakości.

## Struktury danych (Zod)
`src/schemas/place.ts` (nowy):
```ts
export const PlaceSchema = z.object({
  placeId: z.string().min(1),              // Google place id — jedyne pole, które wolno trzymać trwale
  name: z.string().min(1),
  address: z.string().optional(),
  types: z.array(z.string()),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
  googleMapsUri: z.url(),
  rating: z.number().min(1).max(5).optional(),   // tylko przy P6 b/c
});

export const RecommendPlacesRequestSchema = z.object({
  city: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  interests: z.array(InterestTagSchema).min(1),
  locale: z.enum(['pl', 'en']),
});

export const PlaceRecommendationSchema = PlaceSchema.extend({
  reason: z.string().max(200).nullable(),        // null, gdy Gemini zawiódł (fallback)
});

export const RecommendPlacesResponseSchema = z.object({
  places: z.array(PlaceRecommendationSchema).max(10),
  remainingToday: z.int().nonnegative(),
});

// Wyjście Gemini (schemat JSON generowany z tego Zod):
export const GeminiPlacePicksSchema = z.object({
  picks: z.array(z.object({ placeId: z.string(), reason: z.string().max(200) })).max(10),
});
```
Serwer (migracja, tylko przy P8 = limit w bazie): tabela `ai_usage (user_id uuid → auth.users on delete cascade, day date, count int, primary key (user_id, day))`, RLS włączone, **bez polityk dla klienta** (pisze tylko Edge Function kluczem service role). Kolejność: Zod → migracja → regeneracja typów → test parytetu.

Prawo: bez nowych schematów danych (tekst w i18n). Usuwanie konta: `DeleteAccountResponseSchema = z.object({ deleted: z.literal(true) })`.

## Testy (najpierw, przed kodem)
- **A:** `tabs.test.ts` — cztery zakładki w kolejności Podróż, Wydatki, Plan, Profil (pl/en), bez `places`; `src/__tests__/app/tabs.test.tsx` — bez trasy „Miejsca”, pigułka ma 4 przyciski; test odtwarzający ucięcie (padający z właściwego powodu), potem zielony.
- **B:** ekran `/legal/[doc]` renderuje nagłówki obu dokumentów po pl i en; nieznany `doc` → stan błędu; Ustawienia mają dwa linki i nawigują; arkusz logowania pokazuje tekst akceptacji z linkami; test i18n: każdy klucz `legal.*` istnieje w obu językach. Usuwanie konta (P4a): Edge Function odrzuca brak JWT, usuwa tylko wywołującego; test pgTAP/SQL, że kaskada usuwa podróże, wydatki, profil; UI: potwierdzenie, wyłączone offline, błąd sieci pokazuje komunikat i nie czyści danych lokalnych.
- **C:** schematy (poprawne/niepoprawne wartości, granice lat/lng, puste zainteresowania); mapowanie zainteresowań → typy (każdy z 17 tagów ma typy, brak duplikatów, limit `includedTypes`); parser odpowiedzi Google na nagranej fixturze (i odrzucenie złego kształtu); filtr odpowiedzi Gemini: odrzuca obce `placeId`, duplikaty, nadmiar ponad 10, przy złym JSON → fallback bez opisów; limit dzienny: 6. zapytanie → błąd `limit_reached`; klient `fetchPlaceRecommendations` waliduje odpowiedź Zod (zły kształt → błąd); ekran: ładowanie, pusty wynik, błąd z ponowieniem, offline, limit osiągnięty, lista z linkiem do Map; przycisk w pustym stanie „Podróż” prowadzi do `/discover`.

## Pliki
- A: `src/features/nav/tabs.ts` + `__tests__/tabs.test.ts`; `src/app/(drawer)/(tabs)/places.tsx` (usunięty); `src/__tests__/app/tabs.test.tsx`; `src/i18n/locales/{pl,en}.json` (`nav.places`); `src/components/PillNav.tsx` + `__tests__/PillNav.test.tsx` (poprawka ucięcia); `docs/architecture/frontend.md`, `overview.md`, `context/app-context.md` (drzewo ekranów, „Miejsca” jako placeholder).
- B: `docs/legal/*.md` (nowe); `src/app/legal/[doc].tsx` + `src/features/legal/LegalScreen.tsx` (nowe); `src/features/profile/SettingsScreen.tsx`; `src/features/auth/SignInSheet.tsx`; `src/i18n/locales/{pl,en}.json`; przy P4a: `supabase/functions/delete-account/index.ts`, `src/data/account.ts`, test SQL.
- C: `src/schemas/place.ts` (+ eksport w `index.ts`); `src/lib/place-types.ts`, `src/lib/place-picks.ts` (czysta logika, współdzielona z Edge Function); `supabase/functions/recommend-places/index.ts`; `supabase/migrations/<ts>_ai_usage.sql`; `src/data/places.ts`; `src/hooks/usePlaceRecommendations.ts`; `src/app/discover.tsx` + `src/features/discover/*`; `src/app/(drawer)/(tabs)/index.tsx` (przycisk w pustym stanie); `src/i18n/locales/{pl,en}.json`; `.env.example` / `supabase/functions/.env.example` (tylko nazwy sekretów).
- Docs na końcu: `docs/architecture/{backend,frontend,shared,overview,decisions,known-limitations}.md`, nowy `docs/architecture/flows/features/discover-places.md`, `context/app-context.md`.

## Skille
- `supabase`, `supabase-postgres-best-practices` — migracja `ai_usage`, Edge Functions, usuwanie konta (backend).
- `security-and-hardening` — klucze, JWT w Edge Functions, dane osobowe w polityce (backend, verifier).
- `source-driven-development` — aktualna dokumentacja Places API (New) i Gemini structured output przed C2 (backend).
- `doubt-driven-development` — usuwanie konta (nieodwracalne) (orkiestrator, verifier).
- `frontend-design`, `frontend-ui-engineering`, `ui-taste` — ekrany `/legal`, `/discover` (frontend, verifier).
- `test-driven-development`, `incremental-implementation` — każdy krok.

## Organizacja pracy (Twoje „podsesje”)
Ja jestem managerem. Po akceptacji każdy strumień dostaje **osobną sesję (team leader)** z własnym briefem; team leader deleguje kroki do subagentów `backend` / `frontend` (pracownicy), każdy krok przechodzi przez `verifier`, a A i C na koniec przez `tester`. Ja zbieram wyniki, sprawdzam diffy i scalam.
- Strumień A (navbar) — robię w tej sesji, bez podsesji (mały zakres), na gałęzi `feature/places-legal-navbar`.
- Sesja B (prawo) — rusza po P2–P4; teksty dokumentów piszę ja (docs), sesja robi ekrany i usuwanie konta.
- Sesja C (Places + AI) — rusza po P5–P8.
- Gałęzie: każda sesja ma swoją gałąź robotniczą, scalam je do `feature/places-legal-navbar` (jedna gałąź zadania). Ryzyko konfliktów: B i C dotykają `pl.json`/`en.json` — rozwiązuję przy scalaniu.

## Kroki
- [ ] 0. [orkiestrator] Odpowiedzi P1–P8 zapisane w „Decyzje”, plan zaakceptowany.
- [x] A0. [tester] Odtworzenie ucięcia na emulatorze (zrzut, szerokość pigułki vs ekran) — potwierdza lub obala hipotezę.
- [x] A1. [frontend] Usunięcie zakładki „Miejsca” (testy najpierw: `tabs.test.ts`, `tabs.test.tsx`) → verifier.
- [x] A2. [frontend] Nowy wygląd pigułki (D4): testy najpierw w `PillNav.test.tsx` (aktywna kapsuła z etykietą i kolorem `brand.primary`, nieaktywne kółka bez etykiety z `accessibilityLabel`, cele ≥ 44, ogranicz ruch) + test na ucięcie (szerokość rzędu ≤ szerokość kontenera) → `PillNav.tsx`, `tokens.ts` → verifier.
- [ ] A3. [tester] Sprawdzenie na urządzeniu (Android, jasny/ciemny, pl/en, duża czcionka).
- [ ] A4. [orkiestrator] Docs: `frontend.md`, `overview.md`, `context/app-context.md`, `context/design-context.md` §8.14.
- [ ] B1. [orkiestrator] Teksty polityki i regulaminu PL/EN w `docs/legal/` → przegląd Kacpra.
- [ ] B2. [frontend] Ekran `/legal/[doc]` + klucze i18n + linki w Ustawieniach i arkuszu logowania → verifier.
- [x] B3. ~~Edge Function `delete-account`~~ — już zrobione w `profile-settings` (2026-11-05: do usunięcia z planu po akceptacji).
- [x] B4. ~~„Usuń konto” w Ustawieniach~~ — już zrobione w `profile-settings`.
- [ ] B5. [orkiestrator] Publikacja dokumentów pod publicznym URL (P3).
- [ ] C1. [backend] `src/schemas/place.ts` + testy schematów → verifier.
- [ ] C2. [backend] `place-types.ts` (mapowanie) i `place-picks.ts` (filtr odpowiedzi Gemini) z testami → verifier.
- [ ] C3. [backend] Migracja `ai_usage` + Edge Function `recommend-places` (Places + Gemini + limit) na fixturach → verifier. Kacper ustawia sekrety; potem jedno ręczne wywołanie na żywo.
- [ ] C4. [backend] `src/data/places.ts` + `usePlaceRecommendations` → verifier.
- [ ] C5. [frontend] Ekran `/discover` (miasto, zainteresowania, lista, wszystkie stany, atrybucja) → verifier.
- [ ] C6. [frontend] Przycisk „Odkryj miejsca” w pustym stanie „Podróż” → verifier.
- [ ] C7. [tester] Przejście scenariuszy na urządzeniu.
- [ ] D1. [orkiestrator] Aktualizacja `docs/architecture/` i `context/app-context.md`, pełny zestaw testów + typecheck + lint.

## Weryfikacja
Każdy krok: test widziany jako padający → kod → `pnpm test`, `pnpm typecheck`, `pnpm lint` na zielono → verifier PASS → `[x]` i wpis w dzienniku. Edge Functions: testy na fixturach, potem jedno ręczne wywołanie po ustawieniu sekretów. Urządzenie: tester (mobile-mcp) dla A2 i C7.

Scenariusze ręczne C7: brak podróży → „Odkryj miejsca” → wybór miasta (np. Lizbona) → zainteresowania z profilu → lista ≤ 10 miejsc z opisami → „Otwórz w Mapach Google” otwiera właściwe miejsce; offline → komunikat; 6. zapytanie → komunikat o limicie.

## Ryzyka
- **R1 — Dokumenty prawne bez prawnika** nie dają pełnej ochrony. Rekomendacja: konsultacja przed wydaniem w sklepach.
- **R2 — Koszt Google** rośnie liniowo z użytkownikami; bez limitu i paywalla możliwe niespodzianki na rachunku. Ustaw w Google Cloud budżet i alert oraz ograniczenie klucza do Places API.
- **R3 — Darmowy Gemini** wykorzystuje dane do trenowania — nie wolno go używać z prawdziwymi użytkownikami (zgodnie z `ai-day-plan.md`); musi to też wynikać z polityki prywatności.
- **R4 — Brak Deno w testach** — logikę trzymamy w czystych modułach testowanych Jestem; sama Edge Function sprawdzana ręcznie.
- **R5 — Konflikty i18n** przy scalaniu sesji B i C.
- RevenueCat (subskrypcje) — **poza tym planem**, kolejny plan; limit z P8 będzie wtedy zależny od planu subskrypcji.

## Decyzje (Kacper)
2026-11-04:
- **D1 — Jeden plan** dla navbara, prawa i Google Places + „Odkryj miejsca”. RevenueCat osobno, później.
- **D2 — Praca w podsesjach:** orkiestrator = manager, sesje = team leaderzy, subagenci = pracownicy.

2026-11-05:
- **D3 — Usuwamy zakładkę „Miejsca”** z pigułki; cztery pozostałe dostają więcej miejsca. Strumień A robimy teraz, przed B i C.
- **D5 — P9 = (a): osobne kółka bez wspólnego tła**, kapsuła zmienia szerokość z animacją (bez animacji przy „ogranicz ruch”). Plan A zaakceptowany („Osobne kółka, akceptuję”).
- **D4 — Nowy wygląd pigułki** wg wzoru: aktywna = wypełniona kapsuła ikona + etykieta, nieaktywne = okrągłe przyciski z ikoną; w kolorach Sunline.

## Dziennik
- 2026-11-04 — zwiad (2× explorer): stan pigułki, brak treści prawnych, brak Places/AI/Edge Functions. Szkic planu.
- 2026-11-05 — Kacper wysłał zrzut navbara (P1) i zdecydował o usunięciu „Miejsc” (D3). Zwiad: `NAV_TABS` w `tabs.ts`, `places.tsx` to placeholder, `nav.places` tylko w nawigacji. Plan A przepisany; czeka na P1a i akceptację.
- 2026-11-05 — Kacper przysłał wzór nowego wyglądu (D4), wybrał osobne kółka i zaakceptował plan A (D5). Gałąź `feature/places-legal-navbar` od `origin/main` (afc2d12).
- 2026-11-05 — A0 (tester, emulator Android 17, 411 dp, jasny): ucięcie **częściowo odtworzone**. Pigułka mieści się w ekranie (379 dp); kontener `pill-nav-container` ma dokładnie wysokość pigułki, więc dół jest spłaszczony, a cień `elevation.level2` rysuje się jako prostokąt kończący się ~8 dp przed prawym końcem pigułki — stąd „ucięty” prawy bok. Wniosek do A2: każde kółko/kapsuła ma własny cień z zaokrągleniem, a kontener ma zapas w pionie na cień (test: kontener wyższy niż element).
- 2026-11-05 — A1 (frontend): zakładka „Miejsca” usunięta (`tabs.ts`, `places.tsx`, `nav.places`, testy, atrapy tras w testach ustawień/profilu). Test „dokładnie cztery zakładki” widziany jako padający przed zmianą. Verifier: PASS (180 zestawów / 3662 testy, typecheck, lint).
- 2026-11-05 — A2 (frontend): nowy wygląd pigułki — kapsuła `brand.primary` 48 dp z ikoną i etykietą, kółka 48×48 `surface.elevated`, każdy element z własnym cieniem, kontener z zapasem na cień (`paddingVertical: spacing[2]`), animacja szerokości przez `LayoutAnimation` + zanik etykiety (oba wyłączone przy „ogranicz ruch”). Tokeny `components.tabs` = `{ height: 48, horizontalPadding: 16, gap: 8, iconSize: 22 }`. Snackbar na ekranie głównym liczy odstęp z `tabs.height`. Verifier: FAIL (obwódka fokusu do środka) → poprawka → PASS (180/3661, typecheck, lint). Do sprawdzenia w A3: animacja szerokości i cień na Androidzie. Do A4: nieużywane `layout.navPillHeight` i legacy `size.navPill` (64).
