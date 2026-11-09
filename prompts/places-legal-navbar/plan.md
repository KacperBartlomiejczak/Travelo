# Zadanie: Naprawa navbara + polityka prywatności i regulamin + Google Places i „Odkryj miejsca” z AI
Status: strumień A gotowy (2026-11-06); P2–P8 odpowiedziane (D12–D17), plan B i C zaakceptowany 2026-11-06 („Akceptuje”), realizacja w podsesjach B i C
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
- ✅ **P2** → D12. **P2 — Dane administratora do dokumentów:** imię i nazwisko albo firma, adres, e-mail kontaktowy, kraj (zakładam Polskę / RODO). Bez tego dokumenty nie są ważne.
- ✅ **P3** → D13. **P3 — Gdzie publiczny URL dokumentów?** (a) GitHub Pages z tego repo (rekomendacja: darmowe, wersjonowane razem z kodem), (b) publiczny bucket Supabase Storage, (c) Twoja strona.
- **P4 — nieaktualne (2026-11-05):** usuwanie konta zrobiono w `profile-settings`. Pierwotna treść: **Usuwanie konta w aplikacji** („Usuń konto” w Ustawieniach, Edge Function kasuje użytkownika; podróże i wydatki znikają kaskadowo — D17 z wydatków). Apple i Google tego wymagają przed publikacją. (a) Robimy teraz — rekomendacja, (b) później, osobny plan.
- ✅ **P5** → D14. **P5 — Dostawca miejsc** (szczegóły w „Podejście → dostawca”): (a) Google Places API (New) + limit dzienny na użytkownika — rekomendacja, (b) Geoapify (OpenStreetMap, dużo taniej, słabsza jakość „co warto zobaczyć”, brak ocen i zdjęć), (c) Foursquare.
- ✅ **P6** → D15. **P6 — Wygląd wyników:** (a) lista kart: nazwa, typ, adres, krótkie „dlaczego dla Ciebie” od AI, przycisk „Otwórz w Mapach Google” — rekomendacja, bez mapy i bez nowej zależności; (b) jak (a) + ocena Google (droższy poziom zapytań); (c) jak (b) + zdjęcie miejsca (jeszcze drożej, każde zdjęcie to osobne płatne zapytanie).
- ✅ **P7** → D16. **P7 — Gdzie wejście do funkcji:** (a) przycisk „Odkryj miejsca” w pustym stanie ekranu „Podróż” prowadzący do nowego ekranu `/discover`. ~~(b) zakładka „Miejsca”~~ — odpada, zakładkę usuwamy (D3).
- ✅ **P8** → D17. **P8 — Limit i koszt AI:** ile zapytań dziennie na użytkownika? Rekomendacja: 5/dzień, licznik w tabeli Supabase. Oraz: Gemini na darmowym poziomie tylko w developmencie, płatny przed wydaniem (`ai-day-plan.md` wymaga Twojej decyzji). Model: `gemini-2.5-flash` (tani) — do potwierdzenia.

## Podejście

### A — Navbar
- **Usunięcie „Miejsca” (D3):** wpis `places` znika z `NAV_TABS` (`src/features/nav/tabs.ts`), plik trasy `src/app/(drawer)/(tabs)/places.tsx` jest usuwany, klucz i18n `nav.places` usuwany z `pl.json`/`en.json` (nigdzie indziej nieużywany). Pigułka sama rozdziela szerokość (`flex: 1`), więc cztery zakładki dostają ~25% szerokości zamiast 20% — **bez zmian w tokenach**. `/places` przestaje istnieć (zwykły „nie znaleziono” expo-router; w aplikacji nie ma do niego linków).
- **Nowy wygląd (D4, P9):** `PillNav.tsx` przebudowany: rząd 4 elementów wyśrodkowany nad dołem ekranu; aktywny = kapsuła (wysokość 48, `radius.pill`, padding poziomy 16, ikona + `labelMD`/`labelSM` w rzędzie, odstęp 8), nieaktywne = kółka 48×48 (cel dotyku ≥ 44) z samą ikoną; `accessibilityLabel` z etykietą zostaje dla każdego, więc czytnik ekranu nic nie traci. Etykieta nieaktywnych znika, więc reguła „R1 — duża czcionka” (`MAX_FONT_SCALE_WITH_LABELS`) przestaje być potrzebna. Tokeny `components.tabs` zmienione w miejscu (bez nowych tokenów obok starych), design-context §8.14 zaktualizowany przeze mnie. Odstęp od dołu (`usePillClearance`) bez zmian.
- **Błąd ucięcia (P1a = a):** pigułka ma stałą szerokość `min(width − 32, 720)`, a jej dzieci nie mogą jej przycinać (brak `overflow: hidden`) — więc ucięcie robi **rodzic**: kontener paska zakładek z `expo-router/js-tabs` albo `width` z `useWindowDimensions()` większy niż realny obszar (Android edge-to-edge). To hipoteza, nie pewnik. Kolejność: tester odtwarza błąd na emulatorze (zrzut + pomiar), frontend pisze test odtwarzający przyczynę (np. szerokość pigułki liczona z wymiaru kontenera, a nie okna), potem poprawka w `PillNav.tsx` — w praktyce razem z przebudową (D4); tester sprawdza nowy wygląd na urządzeniu.
- Jeśli po usunięciu „Miejsc” i poprawce wciąż jest ciasno — wracam do Ciebie, zanim ruszę tokeny.
- Przy okazji poprawka rozjazdu 12 vs 16 dp w `docs/architecture/frontend.md` i `overview.md` (kod wygrywa).

### A5 — Tło i przesuwana kapsuła (D6, D7)
- **Tło (D6, zastępuje „bez wspólnego tła” z D5):** jedna pigułka pod całym rzędem: `surface.elevated`, `radius.pill`, `elevation.level2` (w ciemnym obramowanie, §5.2), padding 8 dookoła → wysokość 64 (48 + 2×8). Kółka nieaktywnych w środku dostają `background.sunken` (żeby były widoczne na białym tle), bez własnych cieni. Kontener dalej ma zapas w pionie na cień pigułki (wniosek z A0).
- **Animacja (D7):** zamiast kapsuły w każdym elemencie — **jeden wskaźnik** (koralowy `brand.primary`) pod rzędem, pozycja i szerokość brane z `onLayout` aktywnego elementu; przy zmianie zakładki wskaźnik przesuwa się (`left`) i zmienia szerokość (`width`) przez `Animated.timing` (`duration.standard`, `easing.standard`, JS driver — działa w Jest), etykieta dalej się pojawia, elementy dalej zmieniają szerokość przez `LayoutAnimation`. Przy „ogranicz ruch” wszystko natychmiast. Bez nowej zależności.
- Tokeny: `components.tabs` dostaje `containerPadding: 8`; `usePillClearance` liczy wysokość pigułki 64 (48 + 2×8) — odstęp od dołu bez zmian.
- Testy najpierw (`PillNav.test.tsx`): wspólne tło z kolorem, cieniem i obramowaniem w ciemnym; nieaktywne kółka `background.sunken`; wskaźnik po `onLayout` ma pozycję/szerokość aktywnego elementu; zmiana zakładki animuje `left`/`width` do nowego elementu w 180 ms; „ogranicz ruch” → od razu; clearance = inset + 12 + 64.

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
- Sesja B (prawo) — rusza 2026-11-06; na prośbę Kacpra teksty dokumentów (B1, `docs/legal/`) pisze team leader sesji B, potem ekran (B2) i publikacja (B5). Usuwanie konta już zrobione.
- Sesja C (Places + AI) — rusza 2026-11-06, kroki C1–C7.
- Team leaderzy nie edytują `prompts/places-legal-navbar/plan.md` — raportują mnie, ja aktualizuję plan.
- Gałęzie: każda sesja ma swoją gałąź robotniczą, scalam je do `feature/places-legal-navbar` (jedna gałąź zadania). Ryzyko konfliktów: B i C dotykają `pl.json`/`en.json` — rozwiązuję przy scalaniu.

## Kroki
- [x] 0. [orkiestrator] Odpowiedzi P1–P8 zapisane w „Decyzje”, plan zaakceptowany.
- [x] A0. [tester] Odtworzenie ucięcia na emulatorze (zrzut, szerokość pigułki vs ekran) — potwierdza lub obala hipotezę.
- [x] A1. [frontend] Usunięcie zakładki „Miejsca” (testy najpierw: `tabs.test.ts`, `tabs.test.tsx`) → verifier.
- [x] A2. [frontend] Nowy wygląd pigułki (D4): testy najpierw w `PillNav.test.tsx` (aktywna kapsuła z etykietą i kolorem `brand.primary`, nieaktywne kółka bez etykiety z `accessibilityLabel`, cele ≥ 44, ogranicz ruch) + test na ucięcie (szerokość rzędu ≤ szerokość kontenera) → `PillNav.tsx`, `tokens.ts` → verifier.
- [x] A5. [frontend] Wspólne tło pigułki + przesuwana kapsuła (D6, D7) → verifier.
- [x] A6. [orkiestrator] Docs dla A5 (`frontend.md`, `design-context.md` §8.14).
- [x] A7. [frontend] Poprawki po A3: etykieta kapsuły czasem niewidoczna/wyblakła (przerwana animacja), prostokątny cień po zmianie języka, pełna szerokość pigułki (D9) → verifier.
- [x] A8. [frontend] Węższa pigułka (D10) → verifier → tester.
- [x] A9. [frontend] `pillWidth` 320 (D11) → verifier → tester (EN „Expenses” bez skrótu przy 1.0).
- [x] A3. [tester] Sprawdzenie na urządzeniu (Android, jasny/ciemny, pl/en, duża czcionka).
- [x] A4. [orkiestrator] Docs: `frontend.md`, `overview.md`, `context/app-context.md`, `context/design-context.md` §8.14.
- [x] B1. [sesja B] Teksty polityki i regulaminu PL/EN w `docs/legal/` → przegląd Kacpra.
- [x] B2. [frontend] Ekran `/legal/[doc]` + klucze i18n + linki w Ustawieniach i arkuszu logowania → verifier.
- [x] A10. [sesja A10] Bez tła kółek + mniejsze odstępy (D18) → verifier → tester.
- [ ] B5. [orkiestrator] Publikacja dokumentów pod publicznym URL (P3).
- [x] C1. [backend] `src/schemas/place.ts` + testy schematów → verifier.
- [x] C2. [backend] `place-types.ts` (mapowanie) i `place-picks.ts` (filtr odpowiedzi Gemini) z testami → verifier.
- [x] C3. [backend] Migracja `ai_usage` + Edge Function `recommend-places` (Places + Gemini + limit) na fixturach → verifier. Kacper ustawia sekrety; potem jedno ręczne wywołanie na żywo.
- [x] C4. [backend] `src/data/places.ts` + `usePlaceRecommendations` → verifier.
- [x] C4a. [backend] D22: limit czasu 45 s tylko dla `recommend-places` w `src/data/places.ts` (test najpierw: wywołanie trwające > 20 s nie jest przerywane, inne zapytania dalej 20 s) → verifier; po PASS C4 i C4a → `[x]`.
- [x] C5. [frontend] Ekran `/discover` (miasto, zainteresowania, lista, wszystkie stany, atrybucja) → verifier.
- [x] C6. [frontend] Przycisk „Odkryj miejsca” w pustym stanie „Podróż” → verifier.
- [x] C7. [tester] Przejście scenariuszy na urządzeniu.
- [x] D1. [orkiestrator] Aktualizacja `docs/architecture/` i `context/app-context.md`, pełny zestaw testów + typecheck + lint.

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
- **D6 — Wspólne tło pigułki** pod rzędem (zmiana D5), kółka w środku. **D7 — Kapsuła przesuwa się** z poprzedniej zakładki do nowej (nie przejście między ekranami). (Kacper, 2026-11-05, odpowiedzi na pytania.)
- **D8 — Wciśnięcie nieaktywnego kółka:** zostaje `background.sunken` + zmniejszenie do `motion.press.scale` (98%), jak inne przyciski (Kacper, 2026-11-05).
- **D10 — Węższa pigułka (zastępuje szerokość z D9):** stała szerokość ok. 300 dp (nowy token), `min(300, szerokość − 32)`, wyśrodkowana, zakładki rozłożone równo; pigułka się nie rusza, przesuwa się tylko kapsuła (Kacper, 2026-11-06: „za szerokie”).
- **D11 — Pigułka 320 dp (zastępuje 300 z D10):** `pillWidth` = 320, żeby „Expenses” mieściło się przy czcionce 1.0 (Kacper, 2026-11-06: „Poszerz do 320 dp”).
- **D12 — P2: administrator danych** = Kacper Bartłomiejczak (osoba fizyczna), kontakt i sprawy danych: `kacperbartlomiejczak@proton.me` (Kacper podał e-mail także jako adres korespondencyjny), kraj: Polska — RODO i polskie prawo konsumenckie (Kacper, 2026-11-06). Do przeglądu prawnika: art. 5 ustawy o świadczeniu usług drogą elektroniczną wymaga adresu usługodawcy.
- **D13 — P3 = (a): GitHub Pages** z repo `KacperBartlomiejczak/Travelo` (publiczne) → adres `kacperbartlomiejczak.github.io/Travelo/...` (Kacper, 2026-11-06).
- **D14 — P5 = (a): Google Places API (New)** z dziennym limitem na użytkownika; konto Google Cloud z płatnościami zakłada Kacper; ceny do sprawdzenia u źródła przed C2 (Kacper, 2026-11-06).
- **D15 — P6 = (a): lista kart** (nazwa, typ, adres, „dlaczego dla Ciebie” od AI, „Otwórz w Mapach Google”), bez ocen, zdjęć i mapy (Kacper, 2026-11-06).
- **D16 — P7 = (a): wejście tylko z pustego stanu „Podróż”** — przycisk „Odkryj miejsca” → ekran `/discover`; bez linku w szufladzie (Kacper, 2026-11-06).
- **D17 — P8:** limit **5 zapytań dziennie** na użytkownika (licznik w tabeli `ai_usage`); Gemini na darmowym poziomie tylko w developmencie, **płatny przed wydaniem**; model `gemini-2.5-flash` (Kacper, 2026-11-06).
- **D18 — Bez tła kółek, ikony bliżej siebie:** nieaktywne zakładki bez `background.sunken` (samo tło pigułki), mniejsze odstępy, węższa pigułka — wzór: `prompts/places-legal-navbar/ref/1–4.png` (Kacper, 2026-11-06: „ten background daje dziwne złudzenie”). Krok A10, osobna sesja. Odpowiedzi Kacpra (sesja A10): (a) szerokość stała, węższa — `pillWidth` 296 (zastępuje 320 z D11; 288 odrzucone, bo „Expenses” skracałoby się przy 1.0); (b) odstęp min. 4 dp (`spacing[1]`), dalej `space-between`; (c) cel dotyku nieaktywnych 48×48 zostaje; (d) wciśnięcie nieaktywnej = tylko skala 98%, bez tła (zastępuje D8 dla nieaktywnych; aktywna dalej `brand.pressed`).
- **D9 — Pigułka na pełną szerokość:** `min(szerokość − 32, maxContentWidth)`, elementy rozłożone równo w środku; pigułka się nie rusza, przesuwa się tylko kapsuła (Kacper, 2026-11-05).
- **D19 — Wybór miasta na `/discover`:** wyszukiwarka lotnisk (`AirportField`) — miasto i współrzędne z lotniska, działa offline; zainteresowania z profilu jako `InterestChips` do zmiany na ekranie (Kacper, 2026-11-07: „Airport search”; zainteresowania — propozycja bez sprzeciwu).
- **D20 — Model Gemini `gemini-3.8-flash` (zastępuje model z D17):** `gemini-2.5-flash` zwraca 404 „no longer available to new users” (Kacper, 2026-11-07).
- **D21 — Gemini: niski poziom myślenia + limit 20 s** (zamiast 10 s): `gemini-3.8-flash` nie mieścił się w 10 s („Signal timed out”) (Kacper, 2026-11-07).
- **D22 — Limit czasu `recommend-places` po stronie aplikacji: 45 s** tylko dla tego wywołania (serwer: Places 10 s + Gemini 20 s + zdjęcia 5 s); inne zapytania dalej 20 s; komunikat błędu bez zmian (Kacper, 2026-11-09).
- **D23 — Wyjątek: hook `usePlaceRecommendations` (`src/hooks/`) z kroku backendowego C4 zostaje** (Kacper, 2026-11-09).
- **D4 — Nowy wygląd pigułki** wg wzoru: aktywna = wypełniona kapsuła ikona + etykieta, nieaktywne = okrągłe przyciski z ikoną; w kolorach Sunline.

## Dziennik
- 2026-11-04 — zwiad (2× explorer): stan pigułki, brak treści prawnych, brak Places/AI/Edge Functions. Szkic planu.
- 2026-11-05 — Kacper wysłał zrzut navbara (P1) i zdecydował o usunięciu „Miejsc” (D3). Zwiad: `NAV_TABS` w `tabs.ts`, `places.tsx` to placeholder, `nav.places` tylko w nawigacji. Plan A przepisany; czeka na P1a i akceptację.
- 2026-11-05 — Kacper przysłał wzór nowego wyglądu (D4), wybrał osobne kółka i zaakceptował plan A (D5). Gałąź `feature/places-legal-navbar` od `origin/main` (afc2d12).
- 2026-11-05 — A0 (tester, emulator Android 17, 411 dp, jasny): ucięcie **częściowo odtworzone**. Pigułka mieści się w ekranie (379 dp); kontener `pill-nav-container` ma dokładnie wysokość pigułki, więc dół jest spłaszczony, a cień `elevation.level2` rysuje się jako prostokąt kończący się ~8 dp przed prawym końcem pigułki — stąd „ucięty” prawy bok. Wniosek do A2: każde kółko/kapsuła ma własny cień z zaokrągleniem, a kontener ma zapas w pionie na cień (test: kontener wyższy niż element).
- 2026-11-05 — A1 (frontend): zakładka „Miejsca” usunięta (`tabs.ts`, `places.tsx`, `nav.places`, testy, atrapy tras w testach ustawień/profilu). Test „dokładnie cztery zakładki” widziany jako padający przed zmianą. Verifier: PASS (180 zestawów / 3662 testy, typecheck, lint).
- 2026-11-05 — A2 (frontend): nowy wygląd pigułki — kapsuła `brand.primary` 48 dp z ikoną i etykietą, kółka 48×48 `surface.elevated`, każdy element z własnym cieniem, kontener z zapasem na cień (`paddingVertical: spacing[2]`), animacja szerokości przez `LayoutAnimation` + zanik etykiety (oba wyłączone przy „ogranicz ruch”). Tokeny `components.tabs` = `{ height: 48, horizontalPadding: 16, gap: 8, iconSize: 22 }`. Snackbar na ekranie głównym liczy odstęp z `tabs.height`. Verifier: FAIL (obwódka fokusu do środka) → poprawka → PASS (180/3661, typecheck, lint). Do sprawdzenia w A3: animacja szerokości i cień na Androidzie. Do A4: nieużywane `layout.navPillHeight` i legacy `size.navPill` (64).
- 2026-11-05 — A4: docs zaktualizowane (`frontend.md` — PillNav, `usePillClearance` 12 dp + 48; `overview.md`, `app-context.md`, `design-context.md` §8.14, `known-limitations.md` — stare wysokości 64). A3 (tester): **zablokowane** — Metro (8084 i 8082) ma nieaktualną mapę plików i próbuje kompilować usunięty `places.tsx` (ENOENT), więc Expo Go pokazuje stary pakiet. Potrzebny restart Metro z `--clear` przez Kacpra.
- 2026-11-05 — Kacper: dodać animację przejścia i tło nawigacji → D6 (wspólna pigułka), D7 (przesuwana kapsuła). Dopisany krok A5/A6; czeka na akceptację. A3 (tester) trwa na obecnym wyglądzie.
- 2026-11-05 — Kacper zaakceptował A5/A6 („Akceptuję”).
- 2026-11-05 — A3 (tester) na wyglądzie A2: PASS — 4 zakładki, kapsuła 48 dp, kółka 48 dp, brak ucięcia z prawej i u dołu (jasny i ciemny), etykiety EN, font 2.0 mieści się w ekranie. Animacja nieobserwowalna zrzutami. „FAIL” testera dotyczył wersji roboczej A5 (wspólne tło), która jest zgodna z D6 — nie jest błędem. Poza zakresem (do osobnego planu): nick w „Profil” wchodzi pod przycisk ustawień; w „Ustawieniach” przy foncie 2.0 „Systemowy”/„Angielski” wychodzą poza segmenty; lista podróży na emulatorze nie wczytuje się (błąd sieci/backendu, przyczyna nieznana); przy foncie 2.0 ostatni wiersz statystyk profilu chowa się pod pigułką w spoczynku. A3 do powtórki na A5.
- 2026-11-05 — Verifier A5: FAIL — (1) w ciemnym motywie wskaźnik 1 dp za wysoko (`top` odejmuje obramowanie), bez testu; (2) frontend sam wybrał `border.default` na wciśnięcie (kontrast ikony 2,7:1) → pytanie do Kacpra → D8. Poprawki w toku.
- 2026-11-05 — A5 poprawki: wskaźnik `top` bez kompensacji obramowania (test w ciemnym motywie — orkiestrator potwierdził, że pada na starym kodzie), wciśnięcie = `usePressScale` na każdej zakładce + `background.sunken` (D8). Verifier: PASS (180/3665, typecheck, lint). A6: docs (`frontend.md`, `overview.md`, `flows/features/pill-navigation.md`, `known-limitations.md`, `design-context.md` §8.14). Dalej: A3 na A5.
- 2026-11-05 — A3 (tester) na A5: jasny, ciemny (wskaźnik równo), font 2.0 — PASS; FAIL: (1) etykieta wybranej zakładki czasem nie rysuje się albo jest wyblakła (30–50%) na stałe — sporadycznie, po kilku przełączeniach; (2) po zmianie języka za pigułką prostokątny cień z ostrymi rogami do przeładowania. Pytanie o szerokość → D9. Kontrast w ciemnym (~4:1 wg próbki pikseli) — prawdopodobnie pomiar na wyblakłej etykiecie; verifier liczył z tokenów 6,66:1. Dodany krok A7.
- 2026-11-06 — A7: animacje napisu i wskaźnika przeniesione na Reanimated (hipoteza: na Fabric JS-owe `Animated` nadpisywane przez kolejne commity). Verifier PASS (po usunięciu zdublowanych testów i dodaniu testu startu od 0). Tester: napis 19/19 w pełni widoczny (PL, EN, ciemny), D9 OK, kontrast w ciemnym 6,66:1, font 2.0 OK, zmiana języka bez cienia. FAIL: po zmianie motywu ciemny→jasny prostokątny cień za pigułką (2/2) — ciemny `level2` ma `elevation: 0` + obramowanie, jasny `elevation: 5`; Android nie przelicza obrysu cienia. Niepotwierdzone: przy bardzo szybkich tapnięciach (0,1–0,4 s) część tapnięć ginie — może to być narzędzie, do sprawdzenia ręcznie.
- 2026-11-06 — Poprawka cienia po zmianie motywu: `key` widoku pigułki zależny od motywu (wymusza ponowne zamontowanie). Verifier PASS (test pada bez `key`). Kacper: pigułka za szeroka → D10, krok A8 (po zakończeniu bieżącego testu na urządzeniu).
- 2026-11-06 — A7 zacommitowany (74a2bf4). A8 (frontend): nowy token `components.tabs.pillWidth: 300`, szerokość pigułki `min(300, szerokość − 32)` w `PillNav` i w zaślepce `AppLoading`; testy (1000 → 300, 411 → 300 bez zmian po przełączeniu, 320 → 288) padały przed zmianą. Verifier: PASS (180/3670, typecheck, lint). Docs: `frontend.md`, `design-context.md` §8.14. Dalej: tester na urządzeniu (A7 cień po zmianie motywu + A8), uwaga: przy dużej czcionce „Wydatki” może się skracać.
- 2026-11-06 — Tester (emulator 411 dp, świeży bundle z Metro 8086): A8 — pigułka 300 dp, wyśrodkowana, stała szerokość na każdej zakładce: PASS. A7 — brak prostokątnego cienia po 4 zmianach motywu (2× w każdą stronę): PASS. Etykieta bez wyblaknięcia po 10 przełączeniach (PL i EN): PASS. FAIL: przy czcionce 1.0 po angielsku „Expenses” skraca się do „Expens…” (na etykietę zostaje ~53 dp), po polsku „Wydatki” się mieści. Przy czcionce 2.0 „Exp..”/„Wy…” (obserwacja). Poza zakresem: „Podróż”/„Wydatki” pokazują błąd wczytywania podróży na emulatorze (znane z A3). Pytanie do Kacpra o szerokość (P10).
- 2026-11-06 — A9 (frontend): `pillWidth` 300 → 320 (D11), testy na 320 padały przed zmianą. Verifier: PASS (180/3670, typecheck, lint). Tester (Metro 8086 zrestartowane bez `CI=1`, bo wyłącza obserwowanie plików): pigułka 840 px = 320 dp, wyśrodkowana, stała na 4 zakładkach w jasnym i ciemnym; EN „Trip/Expenses/Plan/Profile” i PL „Podróż/Wydatki” w całości przy 1.0 — PASS. Przy czcionce 2.0 „Expe…” (zgodnie z zasadą skracania z A2). W ciemnym pigułka ~2 dp wyższa przez obramowanie 1 dp (§5.2, zamierzone). A3 zamknięty: jasny/ciemny, pl/en, duża czcionka sprawdzone na A5–A9. Strumień A gotowy.
- 2026-11-06 — Kacper odpowiedział na P2–P8 → D12–D17. Plan B i C przedstawiony do akceptacji.
- 2026-11-06 — Kacper zaakceptował plan B i C („Akceptuje”) i poprosił o realizację w podsesjach. Kroki B3/B4 wykreślone (zrobione w `profile-settings`). Startują sesje B i C.
- 2026-11-06 — Sesja B (gałąź `claude/legal-b-c00ba7`): Kacper zaakceptował teksty B1 (64b9732), workflow GitHub Pages dla B5 (7a02746), B2 w toku. Sesja C (gałąź `claude/places-c-4a8a42`): C1 gotowe (42 testy), miasto w C5 wybierane z listy z bazy lotnisk (decyzja Kacpra w sesji C), C2 w toku. Gałęzie jeszcze nie scalone.
- 2026-11-06 — Strumień B scalony do `feature/places-legal-navbar` (7c6e384, za zgodą Kacpra): B1 64b9732, B5 workflow 7a02746, B2 9993ed7 (verifier PASS za trzecim razem: przyciski 44 dp zamiast linków w tekście, zawijanie przy dużej czcionce). Po scaleniu: 182/3688 testów, typecheck i lint zielone (wcześniej typecheck padał na nieaktualnym `.expo/types/router.d.ts` — przegenerowany restartem Metro). B5 otwarte: Kacper włącza Pages w ustawieniach repo; do uzupełnienia region Supabase w polityce; przegląd prawnika; ekran `/legal` niesprawdzony na urządzeniu.
- 2026-11-06 — A10 scalony (sesja A10, gałąź `claude/pill-a10-f2dc73`, d253faf): bez kółek, odstęp 4 dp, pigułka 296 dp. Verifier PASS. **Sprostowanie sesji A10: test na urządzeniu NIE przeszedł** — wcześniejsze „6/6” było nieprawdziwe (brak zrzutów); tester zablokowany, bo worktree A10 nie ma `.env`. Test na urządzeniu do powtórki. Po scaleniu 182/3688, typecheck, lint zielone. Docs: `design-context.md` §8.14, `frontend.md`. Uwaga: sesja C nazwała swoją decyzję o wyborze miasta „D18” — w planie trafi pod D19.
- 2026-11-06 — Podróże nie wczytywały się, bo baza Supabase nie miała migracji `20261104120000_daily_budget` (z innego zadania). Kacper zgodził się — nałożona w jednej transakcji z tą samą wersją; ekran „Podróż” wczytuje się na emulatorze.
- 2026-11-06 — A10 test na urządzeniu (tester w sesji managera, scalona gałąź, Metro 8086; zrzuty sprawdzone przez orkiestratora): jasny PL, ciemny PL, EN przy 1.0 — PASS (pigułka 777 px = 296 dp, środek 540, stała; brak kółek; „Expenses” w całości). Czcionka 2.0: pigułka się mieści, „Exp…”/„Pro…” (zasada skracania z A2). Stan wciśnięcia nieuchwytny zrzutem — NOT RUN. Przytrzymanie zakładki przełącza ją po puszczeniu (zwykłe zachowanie `Pressable`). Strumień A gotowy.
- 2026-11-07 — Sesja C zacommitowała C1 (1e88a61), C2 (93f706b) i C4 (2ef816d); werdykty verifiera dla nich nie są zapisane w tym planie, więc zostają `[ ]` do potwierdzenia. C3: pierwszy verifier FAIL — `consume_ai_quota` przepuszczał pierwsze wywołanie przy `p_limit <= 0`; `consumeQuota` bez walidacji Zod. Poprawka (backend): insert tylko gdy `p_limit > 0`, `z.number().int().nonnegative().nullable()` na wyniku RPC; test SQL (limit 0 i -1 → null, bez wiersza) pada na starej migracji, przechodzi na nowej (lokalny Supabase w Dockerze, transakcja wycofana). Verifier PASS (188/3796, typecheck, lint). Gałąź `feature/discover-places`, draft PR #30 (na `feature/places-legal-navbar`). Niesprawdzone: Deno, wywołanie na żywo (sekrety Kacpra).
- 2026-11-07 — Kacper: miasto na `/discover` z wyszukiwarki lotnisk → D19. C5 (frontend): `src/app/discover.tsx`, `src/features/discover/DiscoverScreen.tsx` (na `AuthFormScreen`), `Stack.Screen` w `src/app/_layout.tsx`, klucze `discover.*` pl/en; 11 testów (czerwone: brak modułu). Verifier PASS (189/3807, typecheck, lint). Uwagi bez blokady: błąd `Linking.openURL` jest połykany bez komunikatu; widok ładowania bez `accessibilityRole`; nieużywany `jest.mock('@/data/app-places')` w teście. Niesprawdzone na urządzeniu (C7).
- 2026-11-07 — C6 (frontend): `TextButton` „Odkryj miejsca” pod „Utwórz podróż” w pustym stanie „Podróż” → `/discover`; snackbar liczy teraz wysokość obu przycisków (`toast(pinnedButtons)`: pusty 2, błąd 1, podróż 0). Testy: nawigacja i lista przycisków czerwone przed zmianą, offset snackbara (128 vs 64) czerwony przed poprawką. Verifier FAIL → brak testów nieobecności przycisku w ładowaniu i błędzie; dopisane (czerwone przy tymczasowej mutacji, cofniętej). Verifier PASS (189/3811, typecheck, lint). Niesprawdzone na urządzeniu (C7).
- 2026-11-07 — Kacper ustawił sekrety `GOOGLE_PLACES_API_KEY` i `GEMINI_API_KEY` (Places API (New) włączone). Migracja `ai_usage` nałożona na projekt Travelo (wersja w historii poprawiona na `20261106120000`, zgodna z plikiem); advisor: tylko „RLS bez polityk” dla `ai_usage` (zamierzone). `recommend-places` wdrożona (`--use-api`, pliki z `src/` dołączone do paczki). Brakuje sekretu `GEMINI_MODEL` (funkcja go wymaga) — ustawia Kacper. Potem wywołanie na żywo i C7.
- 2026-11-07 — Kacper przebudował APK z tej gałęzi (decyzja „Rebuild APK”): build z krótkiej ścieżki `C:\td` (detached worktree, `node-linker=hoisted`, JDK 17; głęboka ścieżka i JDK 25 łamią CMake/ninja). C7 (tester, bundle 8087): pigułka 4 zakładki, bez kółek, ~296 dp — PASS; `/discover` (przez deep link, konto ma podróż), Lizbona/Porto/Madryt — karty, „Data: Google”, licznik, Mapy Google, offline, EN + ciemny — PASS. FAIL: brak „dlaczego dla Ciebie” na wszystkich kartach. Przyczyna z logów: Gemini 404 (`gemini-2.5-flash` niedostępny dla nowych kont) → D20, potem „Signal timed out” (Gemini 3 domyślnie myśli „high”) → D21. Poprawka (backend): log `gemini_fallback`/`gemini_picks_empty` (bez klucza i promptu), `thinkingLevel: 'low'`, limit Gemini 20 s (Places 10 s). Verifier PASS (191/3834, typecheck, lint). Uwagi: `thinkingLevel` działa tylko z modelami Gemini 3; log zawiera dosłowny `error.message` Google. Niesprawdzone: pusty stan „Podróż” (konto ma podróż), komunikat limitu (licznik wyzerował się o północy UTC).
- 2026-11-07 — Po wdrożeniu poprawki (4a2eecf): Barcelona — karty z „dlaczego dla Ciebie” (EN), wywołanie 7,9 s po stronie serwera. C7 zamknięty z wyjątkami: pusty stan „Podróż” i komunikat limitu niesprawdzone na urządzeniu (pokryte testami). Scalone poprawki PR #29 z review CodeRabbit (`feature/places-legal-navbar`); 191/3837, typecheck, lint zielone.
- 2026-11-07 — D1: docs strumienia C — `backend.md` (`recommend-places`, `ai_usage`), `frontend.md` (`/discover`), `shared.md` (`place.ts`), `overview.md`, `decisions.md` (D14–D21, model Gemini), `known-limitations.md` (limit, Gemini, budowanie APK na Windows), nowy `flows/features/discover-places.md`, `context/app-context.md` (pkt 18). Dalej: verifier końca planu z CodeRabbit.
- 2026-11-09 — Verifier (Haiku) C1, C2, C4 na d42b364: **C1 PASS, C2 PASS** → `[x]`. **C4 FAIL**: (1) hook `usePlaceRecommendations` w `src/hooks/` napisał backend (poza jego plikami; plan przypisał go do C — sprzeczność z zasadami, decyzja Kacpra); (2) `src/data/places.ts`: klient przerywa po 20 s (`REQUEST_TIMEOUT_MS`), a serwer w najgorszym razie potrzebuje Places 10 s + Gemini 20 s (+ zdjęcia 5 s w #32) — wolne, ale udane wywołanie kończy się „offline” i zużywa 1 z 5 zapytań; brak testu. Pełny zestaw 191/3837, lint 0; typecheck czerwony tylko przez nieaktualny `.expo/types/router.d.ts` (do odświeżenia). Uwagi bez blokady: `googleMapsUri` bez wymogu https; `buildNearbySearchBody` z ręcznym typem zamiast `Pick<RecommendPlacesRequest>`; jedna zła pozycja z Google odrzuca całą odpowiedź; nazwy typów `market`, `scenic_spot`, `kebab_shop`, `sauna` niesprawdzone na żywo; brak testu nowego zapytania przy innym `locale`.
- 2026-11-09 — Kacper: „Dłuższy limit tylko dla tego wywołania” → D22, krok C4a; „Akceptuję wyjątek” → D23 (hook w `src/hooks/` z kroku backendowego zostaje).
- 2026-11-09 — C4a (backend, fc234d2): red ✓ (3/9 failed) · `RECOMMEND_PLACES_TIMEOUT_MS = 45_000` w `withTimeout` dla URL `/functions/v1/recommend-places` (opcja `timeout` w `functions.invoke` nie omija globalnego 20 s). Odświeżone `.expo/types/router.d.ts` → typecheck zielony. Verifier: **C4 PASS (z D23), C4a PASS** (191/3840, typecheck, lint 0). Uwagi bez blokady: połowa testu „nie przerwane po 20 s” nie gryzie (mock ignoruje `signal`; strażnikiem jest test 45 s); `app-places.ts` spoza listy plików; `PlacesErrorKind` ręczna unia zamiast `z.enum`; przerwanie po 45 s nadal pokazuje „offline” (zgodnie z D22).
- 2026-11-09 — Review-fixes krok 4: verifier całej gałęzi (Sonnet 5.5) + CodeRabbit (`--base origin/main`, 48 plików): **FAIL** tylko w docs — D22 nieopisane (`backend.md` mówił „każde zapytanie 20 s”). CodeRabbit: 2× minor — (1) `usePlaceRecommendations.ts:31-33`: po błędzie ponowne „Szukaj miejsc” z tym samym zapytaniem nic nie robi (działa tylko „Spróbuj ponownie”) — decyzja Kacpra; (2) nieescapowane `|` w tabeli `overview.md:146` — poprawione. Kod czysty: 191/3840, typecheck, lint 0; `pnpm test:db` nieuruchomiony (brak lokalnego Supabase). Docs D22 uzupełnione: `backend.md`, `decisions.md`, `flows/features/discover-places.md`, `known-limitations.md`.
- 2026-11-09 — Kacper: „Zostaw, wpisz do known-limitations” (ponowne „Szukaj miejsc” po błędzie) → wpisane. Verifier docs D22 (ba9468f): **PASS**. Strumień C gotowy; zostaje B5 (publiczny URL dokumentów).
- 2026-11-09 — CodeRabbit na GitHubie (#30): 1 uwaga (minor) — docs D22 błędnie mówiły, że przerwanie po 45 s pokazuje stan offline; w rzeczywistości `offline` to rodzaj błędu, ekran pokazuje ogólny błąd z „Spróbuj ponownie” (baner offline zależy od `useIsOffline()`) → poprawione w `discover-places.md` i `known-limitations.md`. 4 drobiazgi (nitpick): dopasowanie ścieżki po `pathname` (pominięte — URL buduje klient Supabase), osobne komunikaty dla `offline`/`unauthorized` (pominięte — opcjonalne, CodeRabbit sam uznał za zamierzone uproszczenie), ponowne szukanie (już w known-limitations), parsowanie każdego miejsca z Google osobno (pytanie do Kacpra).
