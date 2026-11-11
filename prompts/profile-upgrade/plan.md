# Zadanie: Ulepszenie zakładki „Profil” (minione podróże, kod znajomego, odznaka PRO)
Status: w trakcie

Akceptacja: Kacper, 2026-11-10, na pytanie „Akceptujesz oba plany razem z pozostałymi rekomendacjami leaderów?”: „Akceptuję oba”; potwierdzone 2026-11-11: „plany sa zaakceptowane kontynuuj prace”. Obejmuje D1–D11 oraz rekomendacje lidera dla Q3, Q5–Q10 (zapisane niżej jako D12–D18).

Gałąź: `claude/profile-upgrade-3956a1` (jedna gałąź na całe zadanie, commit po każdym kroku, bez push i PR do odwołania).
Równolegle inny lider przebudowuje Ustawienia (`prompts/settings-redesign/`). Ten plan **nie dotyka** `src/features/profile/SettingsScreen.tsx` ani jego testów.

## Zrozumienie i założenia

Ekran „Profil” (`/profile`) dostaje trzy nowe rzeczy, nic więcej:

1. **Lista minionych podróży** pod kartą statystyk: pionowo, karta pod kartą, zdjęcie okładki z przyciemnieniem, nazwa, liczba znajomych, miejsce. Tapnięcie otwiera tę podróż na ekranie „Podróż”.
2. **Kod znajomego** użytkownika z akcją „udostępnij” (systemowy arkusz udostępniania).
3. **Odznaka PRO** z gradientem koral → bursztyn, na razie dla każdego.

„Zrobione” = wszystkie kroki `[x]`, pełny zestaw testów, `pnpm typecheck` i `pnpm lint` zielone, weryfikator PASS na każdym kroku i na całej gałęzi, dokumenty zgodne z kodem.

### Decyzje Kacpra (2026-11-10) — nie pytamy ponownie

- **D1 — Minione podróże:** pionowa lista pod kartą statystyk, prostokątne karty jedna pod drugą. Karta: zdjęcie okładki z lekkim ciemnym przyciemnieniem, lekko zaokrąglone rogi (token promienia z `context/design-context.md`), nazwa podróży, liczba znajomych, miejsce (cel podróży). Wzór: karta na całą szerokość, mała pigułka z nazwą miejsca w prawym górnym rogu, tytuł białym pogrubieniem w lewym dolnym rogu na przyciemnionym zdjęciu.
- **D2 — Tapnięcie karty:** podróż staje się bieżącą i aplikacja przechodzi na ekran „Podróż” (który już pokazuje podróż i pasek zdjęć). Osobny ekran podsumowania podróży — **decyzja odłożona**, nie budujemy.
- **D3 — Kod znajomego:** własny `friendCode` na profilu + akcja udostępniania przez wbudowane `Share` z React Native (tekst z kodem). Bez nowych zależności, bez kopiowania do schowka, bez kodu QR (odrzucone na teraz).
- **D4 — Odznaka PRO:** ładna odznaka z gradientem koral → bursztyn, tylko z istniejących kolorów motywu. Na razie widoczna u **każdego** użytkownika: nie ma subskrypcji (RevenueCat lub alternatywa w późniejszym zadaniu). Bez schematu, bez migracji, bez kodu zakupów — jedna, jasno opisana stała w jednym miejscu, którą późniejsze zadanie podmieni. **Wyjątek od zasady „bez dekoracyjnych gradientów”** z design-context, tylko dla tej odznaki.
- **D5 — Tokeny motywu zostają bez zmian.** Gdy brakuje tokenu — pytamy, nie wymyślamy wartości.

- **D6 — Karta statystyk zostaje dokładnie taka, jaka jest dziś** (Kacper, 2026-11-10, po szkicu układu: „Wygląda to dobrze tylko statystyki chciałbym aby pozostały jakie są aktualnie”). Nie zmieniamy `src/features/profile/TravelStatsCard.tsx`, jej układu, tekstów ani testów; nowe elementy (odznaka PRO, kod znajomego z udostępnianiem, lista minionych podróży) są dodawane wokół niej. Szkic układu (nick + odznaka PRO, wiersz z kodem i przyciskiem udostępniania, statystyki, pionowa lista kart) Kacper ocenił jako dobry — to uwaga do układu, **nie akceptacja planu**.

- **D7 — Bursztyn w gradiencie PRO to `accent.sun`** (odpowiedź na Q1, 2026-11-10; lider Ustawień dostał tę samą odpowiedź). Gradient: `brand.primary` → `accent.sun`. Sformułowanie „bursztyn z etykiet przesiadek” w zleceniu było pomyłką menedżera — etykiety przesiadek zostają, jak są.
- **D8 — Przyciemnienie zdjęcia na karcie:** gradient od przezroczystego u góry do `hero.scrim` u dołu, bez nowego tokenu (odpowiedź na Q2, 2026-11-10).
- **D9 — Pigułka z miejscem:** samo miasto lotniska docelowego; gdy lotniska nie ma na liście — kod IATA (odpowiedź na Q4, 2026-11-10).
- **D10 — Podróże, w których użytkownik jest połączonym znajomym, są na liście** — ten sam zbiór co w statystykach (odpowiedź na Q11, 2026-11-10).
- **D11 — Kilku subagentów `frontend` równolegle** (Kacper, 2026-11-10: „Powiedz żeby team leader do profilu odpalił kilku subagentów frontendowych tak żeby sobie nie przeszkadzali”). To decyzja dla tego planu i ma pierwszeństwo przed zasadą „kroki frontendowe po jednym” z `docs/agents/subagents.md`; tego dokumentu nie zmieniamy. Zasady równoległości są w sekcji „Kroki”.

- **D12 (Q3) — Podróż z 0 znajomych:** linia „Podróż solo” / „Solo trip”.
- **D13 (Q5) — Karta:** promień `radii.lg` = 20, wysokość `card.tripImageHeight` = 156 (minimalna).
- **D14 (Q6) — Odznaka PRO** obok nicku, w tym samym wierszu.
- **D15 (Q7) — Kod znajomego** jako własna karta między wierszem profilu a kartą statystyk: podpis, kod, ikona udostępniania po prawej.
- **D16 (Q8) — Tekst udostępniania:** pl „Dodaj mnie do podróży w Travelo. Mój kod znajomego: {{code}}”, en „Add me to your trip in Travelo. My friend code: {{code}}”.
- **D17 (Q9) — Brak minionych podróży:** nagłówek „Minione podróże” + zdanie „Tu pojawią się Twoje zakończone podróże.”.
- **D18 (Q10) — Błąd wczytania bez kopii:** zdanie „Nie udało się wczytać podróży.” bez przycisku „Spróbuj ponownie”.

### Co ustaliłem w kodzie (fakty, nie założenia)

- **F1 — Lista podróży nie ma liczby osób.** `TripListItemSchema` (`src/schemas/trip.ts`) niesie: `id`, `name`, `coverImageUri`, `coverUrls?`, `destination` (IATA), `flights`, `startDate`, `endDate`. Okładka, nazwa i cel są, także offline (kopia w SQLite `trip_list_cache`). **Brakuje liczby podróżnych** — `travellerCount` jest tylko w `TripSummarySchema` (ekran „Podróż”). Zapytanie listy (`fetchList` w `src/data/supabase-trip-repository.ts`) nie pobiera `trip_members`. Stąd jeden krok backendowy.
- **F2 — „Minione” w statystykach:** `travelStats` bierze `tripSections(trips, deviceToday(new Date())).past`, czyli `endDate < dziś` (data telefonu), posortowane od ostatnio zakończonej. Lista użyje dokładnie tej samej funkcji, więc liczba kart = liczba „Podróże” w statystykach.
- **F3 — Podróże połączonego znajomego są na liście.** RLS „Owners and linked members read trips” przepuszcza podróże, w których użytkownik jest połączonym członkiem, a `fetchList` nie filtruje po właścicielu. Dziś liczą się też do statystyk. RLS na `trip_members` pozwala właścicielowi i połączonemu członkowi czytać członków, więc liczba osób jest dostępna dla obu.
- **F4 — Bursztynu dla etykiet przesiadek w kodzie nie ma.** `LayoverLabel` używa `semantic.info.foreground` (niebieskawy), zgodnie z §8.12 („warning dopiero po progu”). `context/app-context.md` §3.5 nadal pisze „amber layover labels” — to nieaktualny opis. Bursztynowe tokeny, które istnieją: `accent.sun` (`#D6A34D` / `#E0B45E`), `semantic.warning.solid` (`#A87512` / `#E0B45E`), `sync.pending`. → rozstrzygnięte w D7.
- **F5 — Gradient bez nowej zależności:** `react-native-svg` (już w projekcie) — `Svg` + `Defs` + `LinearGradient` + `Rect`, tak jak w `src/components/TripHero.tsx`.
- **F6 — Przyciemnienie zdjęcia:** istnieją `hero.scrim` (82%), `hero.controlBackground` (72%), `hero.controlBorder`, `hero.text`. Żaden nie jest „lekki” jako pełne wypełnienie. → rozstrzygnięte w D8.
- **F7 — Wybór bieżącej podróży:** `useSelectTrip().mutate(tripId)` (zapis na telefonie, działa offline), potem ekran „Podróż” czyta `useCurrentTrip()`. Panel boczny pomija `select`, gdy to już bieżąca podróż — zrobimy tak samo.
- **F8 — Kod znajomego jest w profilu** (`ShownProfile.friendCode`, także w kopii offline), nigdzie dotąd niepokazywany.
- **F9 — Istniejąca decyzja profile-screen A2:** gdy lista podróży się nie wczytała i nie ma kopii, statystyki pokazują kreski, **bez „Spróbuj ponownie”** (jest na to test w `ProfileScreen.test.tsx`). → pytanie Q10.
- **F10 — Stara kopia listy na telefonie** nie będzie miała nowego pola. Przy polu wymaganym stara kopia czyta się jako „brak kopii” (tak było przy profile-screen D11).

### Założenia (do potwierdzenia razem z planem)

- **A1 — `travellerCount` na liście jest opcjonalne** (jak `coverUrls` i `organizerUsername`: „stara kopia może go nie mieć”). Dzięki temu stara kopia offline dalej działa, a karta bez tej liczby po prostu nie pokazuje linii o znajomych. Odrzucone: pole wymagane — po aktualizacji aplikacji offline zniknęłaby lista i statystyki do pierwszego połączenia.
- **A2 — Liczba znajomych = `travellerCount − 1`** (organizator nie jest wierszem członka). Dla połączonego znajomego to też liczba pozostałych osób.
- **A3 — Bez migracji i bez regeneracji typów:** tabela `trip_members` istnieje, zmienia się tylko `select`. Pobieramy `trip_members(id)` i liczymy długość (ten sam styl co `flight_segments(from_iata, to_iata)`), bez agregatów PostgREST.
- **A4 — Karta nie pokazuje dat ani budżetu** (D1 ich nie wymienia; §8.10 zabrania gęstych danych na zdjęciu).
- **A5 — Lista to zwykłe `map` w istniejącym `ScrollView`** (bez `FlatList`, bez stronicowania): podróży jest mało. Ograniczenie zapisane w ryzykach.
- **A6 — Nieudane / anulowane udostępnianie nic nie pokazuje** (anulowanie arkusza to nie błąd).
- **A7 — Karta jest przyciskiem** (`accessibilityRole="button"`), stan wciśnięcia przez istniejący `usePressScale` / przyciemnienie zgodnie z §8.9 („nigdy nie unosi się”).

## Podejście

Trzy małe, niezależne elementy w `src/features/profile/`, wpięte w istniejący `ProfileScreen`. Dane listy przychodzą z istniejącego `useTripList()` (ten sam odczyt co statystyki — zero nowych zapytań po stronie ekranu). Jedyna zmiana danych: `travellerCount?` na elemencie listy.

Układ ekranu od góry (do potwierdzenia w Q6, Q7): nagłówek „Profil” + zębatka → wiersz: zdjęcie, nick + odznaka PRO → kod znajomego z przyciskiem udostępniania → karta „Twoje podróże” (bez zmian) → „Minione podróże” (lista kart).

Odrzucona alternatywa: osobne zapytanie / RPC dla minionych podróży z liczbą osób — drugi odczyt i druga kopia offline dla jednej liczby.

## Struktury danych (Zod)

Jedna zmiana, w `src/schemas/trip.ts`:

```ts
export const TripListItemSchema = z
  .object({
    id: tripShape.id,
    name: tripShape.name,
    coverImageUri: tripShape.coverImageUri,
    coverUrls: CoverUrlsSchema.optional(),
    destination: tripShape.destination,
    flights: z.array(FlightRouteSchema),
    startDate: tripShape.startDate,
    endDate: tripShape.endDate,
    /** Organizer + members, for the profile's past-trip cards (profile-upgrade D1). A copy kept from before lacks it. */
    travellerCount: z.int().min(1).optional(),
  })
  .superRefine(/* bez zmian */);
```

- Kod znajomego: **brak zmian w schematach** — `ProfileSchema.friendCode` już istnieje i jest w kopii offline.
- Odznaka PRO: **brak schematu** (D4) — stała w kodzie.
- Tekst udostępniania: tylko klucz i18n z `{{code}}`, bez schematu (nie jest danymi z zewnątrz).
- Baza: bez migracji, `database.types.ts` bez zmian, testy parzystości bez zmian.

## Testy (najpierw, przed kodem)

**Krok 1 `[backend]`**
- `src/schemas/__tests__/trip.test.ts`: element listy z `travellerCount: 3` przechodzi i zachowuje pole; bez pola przechodzi; `0`, liczba ujemna i ułamek są odrzucane. Uwaga: istniejący test „obcina nadmiarowe klucze” używa `travellerCount` jako przykładowego nadmiarowego klucza — zmieniamy tam przykład na inny klucz (pole przestaje być „nadmiarowe”); to zmiana wynikająca wprost z planu, nie osłabienie testu.
- `src/data/__tests__/trip-rows.test.ts`: `listItemFromRow` z 2 wierszami `trip_members` daje `travellerCount: 3`; z pustą tablicą daje `1`.
- `src/data/__tests__/supabase-trip-repository.test.ts`: `list()` prosi o `trip_members(id)`; zwraca i zapisuje do kopii `travellerCount`; podróż połączonego znajomego też ma liczbę.
- `src/data/__tests__/trip-repository.test.ts` (in-memory): `list()` daje `travellerCount = członkowie + 1`; solo = `1`.
- `src/data/__tests__/local-store.test.ts`: kopia listy zachowuje `travellerCount`; **stara kopia bez pola nadal się czyta** (nie `null`).

**Krok 2 `[frontend]` — klucze i18n**
- `src/i18n/__tests__/i18n.test.ts`: każdy nowy klucz `profile.*` istnieje w pl i en; `pastFriends` odmienia się poprawnie (pl: 1 znajomy, 2 / 5 znajomych; en: 1 friend, 2 friends); `shareMessage` wstawia `{{code}}`.

**Krok 3 `[frontend]` — `PastTrips`**
- Lista: karty w kolejności podanej tablicy; nagłówek sekcji z rolą `header`.
- Karta: nazwa (maks. 2 linie), pigułka z miejscem, linia o znajomych z poprawną liczbą mnogą (pl: 1 / 2 / 5; en: 1 / 2); wariant solo wg Q3; bez `travellerCount` — brak linii o znajomych.
- Miejsce: miasto lotniska z `AIRPORTS`; lotnisko spoza listy → kod IATA (D9).
- Okładka przez `CoverImage` (`variant="full"`), ukryta dla czytnika ekranu; nad nią gradient SVG z dwoma `Stop` w kolorze `hero.scrim` (krycie 0 u góry, 1 u dołu) (D8).
- Dostępność: jeden element-przycisk na kartę, etykieta „<nazwa>, <miejsce>, <znajomi>”, podpowiedź „Otwiera podróż”; tapnięcie woła `onOpen(trip.id)`.
- Stany: `loading` → szkielety o wymiarach karty, jeden element „Wczytywanie minionych podróży”, `busy`; pusta lista → wg Q9; błąd bez danych → wg Q10.
- Kolory i wymiary tylko z tokenów (asercje na wartości z `tokens`, jak w istniejących testach).

**Krok 4 `[frontend]` — `FriendCode` (komponent, props: `code`)**
- Widoczny podpis „Twój kod znajomego” i kod; etykieta czytnika czyta kod znak po znaku.
- Przycisk „Udostępnij kod znajomego” woła `Share.share` dokładnie raz z tekstem z Q8 zawierającym kod (pl i en).
- Odrzucone / anulowane `Share.share` nie wywala komponentu i nic nie pokazuje (A6).

**Krok 5 `[frontend]` — `ProBadge`**
- Widoczna odznaka „PRO” z etykietą dostępności „Konto PRO”.
- Gradient: dwa `Stop` o kolorach `brand.primary` i `accent.sun` (D7) — w motywie jasnym i ciemnym; tekst w `brand.onBrand`; promień `radii.pill`.
- Stała `IS_PRO` jest jedna, w `ProBadge.tsx`; przy `false` odznaki nie ma (test przez mock modułu, bez dodatkowej konfiguracji w kodzie).

**Krok 6 `[frontend]` — wpięcie w `ProfileScreen`**
- Pod kartą statystyk jest sekcja minionych podróży; pokazuje tylko podróże z `endDate < dziś`, od ostatnio zakończonej; trwająca i przyszła nie są kartami; podróż połączonego znajomego jest kartą (D10).
- Liczba kart = statystyka „Podróże”. Karta statystyk bez zmian (D6).
- Tapnięcie karty innej niż bieżąca: `select(tripId)` wywołane raz, potem nawigacja do `/`. Tapnięcie bieżącej: bez `select`, sama nawigacja.
- Lista ładuje się → szkielety; lista z danymi i `isError` → karty zostają (dane wygrywają, jak w statystykach); brak danych i błąd → stan błędu wg Q10; offline z kopią → karty widoczne, baner offline bez zmian.
- Z profilem: odznaka PRO i kod znajomego w miejscach wg Q6 i Q7, kod z `profile.friendCode`. Bez profilu (jeszcze się czyta): brak odznaki i brak kodu. Offline: kod i udostępnianie działają (kod jest w kopii).
- Istniejące testy `ProfileScreen.test.tsx` i `ProfileScreenAvatar.test.tsx` przechodzą bez osłabiania (mock `useTrips` dostaje `useSelectTrip` i `useCurrentTrip`).

**Krok 7 (dokumenty)** — bez red/green: sprawdzenie linków, grep starych opisów („not shown yet”, „amber layover labels”), pełny zestaw nadal zielony.

## Pliki

| Krok | Plik | Zmiana |
|---|---|---|
| 1 | `src/schemas/trip.ts` | `travellerCount` (opcjonalne) w `TripListItemSchema` |
| 1 | `src/data/trip-rows.ts` | `TripListRow` + `trip_members: Pick<MemberRow, 'id'>[]`; `listItemFromRow` liczy `travellerCount` |
| 1 | `src/data/supabase-trip-repository.ts` | `select` listy + `trip_members(id)` |
| 1 | `src/data/trip-repository.ts` | in-memory `list()` dodaje `travellerCount` |
| 1 | `src/schemas/__tests__/trip.test.ts`, `src/data/__tests__/{trip-rows,supabase-trip-repository,trip-repository,local-store}.test.ts`, ew. `src/test/fake-supabase.ts` | testy / fake |
| 2 | `src/i18n/locales/pl.json`, `src/i18n/locales/en.json`, `src/i18n/__tests__/i18n.test.ts` | wszystkie nowe klucze naraz, tylko w obiekcie `profile` (mały, lokalny diff — mniej konfliktów z gałęzią Ustawień) |
| 3 | `src/features/profile/PastTrips.tsx` (nowy), `src/features/profile/__tests__/PastTrips.test.tsx` (nowy) | sekcja + karta + szkielet + stany |
| 4 | `src/features/profile/FriendCode.tsx` (nowy), `src/features/profile/__tests__/FriendCode.test.tsx` (nowy) | kod + `Share` |
| 5 | `src/features/profile/ProBadge.tsx` (nowy), `src/features/profile/__tests__/ProBadge.test.tsx` (nowy) | odznaka + stała `IS_PRO` |
| 6 | `src/features/profile/ProfileScreen.tsx`, `src/features/profile/__tests__/ProfileScreen.test.tsx` | wpięcie trzech komponentów, `select` + nawigacja |
| 7 | `docs/architecture/{frontend,shared,overview,decisions,known-limitations}.md`, `docs/architecture/flows/features/` (plik profilu), `context/app-context.md` (§2 pkt 14 i „Ideas”, §3.5 „amber”, §3.9, §5), `context/design-context.md` („Project notes”: wyjątek gradientu PRO, tekst na zdjęciu w karcie minionej podróży) | tylko orkiestrator |

Nie dotykamy: `SettingsScreen.tsx`, `TravelStatsCard.tsx`, `TripsDrawer.tsx`, `src/theme/**`, `supabase/**`, `package.json`.

Reużywane bez zmian: `CoverImage`, `Card`, `SkeletonBlock`, `IconButton`, `TextButton`, `OfflineBanner`, `useTripList`, `useSelectTrip`, `useCurrentTrip`, `useMyProfile`, `tripSections`, `deviceToday`, `AIRPORTS`.

## Teksty (i18n, obiekt `profile`)

| Klucz | pl | en |
|---|---|---|
| `pastTitle` | Minione podróże | Past trips |
| `pastLoading` | Wczytywanie minionych podróży | Loading past trips |
| `pastEmpty` (Q9) | Tu pojawią się Twoje zakończone podróże. | Your finished trips will show up here. |
| `pastError` (Q10) | Nie udało się wczytać podróży. | Couldn't load your trips. |
| `pastFriends_one` | {{count}} znajomy | {{count}} friend |
| `pastFriends_few` / `_many` / `_other` | {{count}} znajomych | {{count}} friends (`_other`) |
| `pastSolo` (Q3) | Podróż solo | Solo trip |
| `pastTripLabel` (czytnik) | {{name}}, {{place}}, {{friends}} | {{name}}, {{place}}, {{friends}} |
| `pastTripHint` (czytnik) | Otwiera podróż | Opens the trip |
| `friendCode` | Twój kod znajomego | Your friend code |
| `friendCodeSpoken` (czytnik) | Twój kod znajomego: {{code}} (kod ze spacjami między znakami) | Your friend code: {{code}} |
| `shareCode` (czytnik, przycisk) | Udostępnij kod znajomego | Share friend code |
| `shareMessage` (Q8) | Dodaj mnie do podróży w Travelo. Mój kod znajomego: {{code}} | Add me to your trip in Travelo. My friend code: {{code}} |
| `pro` | PRO | PRO |
| `proLabel` (czytnik) | Konto PRO | PRO account |

## Stany listy minionych podróży

| Stan | Co widać |
|---|---|
| Ładowanie | nagłówek + 2 szkielety o wymiarach karty (pulsują jak reszta, statyczne przy ograniczonym ruchu); jeden element „Wczytywanie minionych podróży” |
| Pusto (brak zakończonych podróży) | wg Q9 (rekomendacja: nagłówek + jedno zdanie `pastEmpty`) |
| Błąd bez kopii | wg Q10 (rekomendacja: jedno zdanie `pastError`, bez przycisku — spójnie z A2 z profile-screen) |
| Błąd, ale są dane | karty zostają |
| Offline | karty z kopii listy; okładki-presety zawsze, okładka z galerii z pamięci obrazów, inaczej domyślny preset (`CoverImage`); baner offline jak dziś. Tapnięcie działa; podróż nigdy nieotwarta na tym telefonie pokaże na „Podróż” istniejący stan błędu (bez zmian) |

## Skille

- `test-driven-development` — kroki 1–6 — pętla red → green → refactor.
- `incremental-implementation` — kroki 1–6 — jeden spójny diff na krok.
- `javascript-typescript-jest` — kroki 1–6 — struktura testów i mocki (`Share`, `expo-router`).
- `api-and-interface-design` — krok 1 — zmiana kontraktu `TripListItem` / `list()`.
- `supabase` — krok 1 — zagnieżdżony `select` w `supabase-js`.
- `frontend-ui-engineering` — kroki 3, 4 i 6 — dostępność, stany, skalowanie czcionki.
- `frontend-design` — kroki 3 i 5 — budowa karty i odznaki (podrzędny wobec design-context).
- `source-driven-development` — krok 4 — `Share` z aktualnej dokumentacji React Native (kształt wyniku, zachowanie na Androidzie / iOS).
- `ui-taste` — weryfikator po krokach 3, 5 i 6 — przegląd wizualny.
- `code-review-and-quality` — weryfikator po każdym kroku; `code-review` (CodeRabbit) — na końcu planu.
- `documentation-and-adrs` — krok 7 — decyzje do `decisions.md`.
- `git-workflow-and-versioning` — commit po każdym kroku.

## Kroki

- [ ] 1. `[backend]` `travellerCount?` w `TripListItemSchema` (najpierw Zod), potem `TripListRow` / `listItemFromRow`, `select` z `trip_members(id)`, in-memory `list()` — skill: `test-driven-development`, `api-and-interface-design`, `supabase` — najpierw testy: schemat, wiersze, oba repozytoria, kopia w SQLite (stara kopia się czyta) — weryfikacja: pełny zestaw + typecheck + lint, weryfikator; brak zmian w `supabase/` i `database.types.ts`.
- [x] 2. `[frontend]` Wszystkie nowe klucze i18n (tabela „Teksty”) w `pl.json` i `en.json` — jeden agent, tylko te pliki — skill: `test-driven-development`, `javascript-typescript-jest` — najpierw testy: `i18n.test.ts` — weryfikacja: pełny zestaw, weryfikator. **Na nic nie czeka; biegnie równolegle z krokiem 1** (inne pliki).
- [ ] 3. `[frontend]` `PastTrips.tsx`: sekcja, karta (okładka, gradient do `hero.scrim`, pigułka z miastem, nazwa, znajomi), szkielety, stan pusty i błędu — skill: `test-driven-development`, `frontend-ui-engineering`, `frontend-design` — najpierw testy: `PastTrips.test.tsx` — weryfikacja: pełny zestaw, weryfikator (+ `ui-taste`), tokeny bez wartości „z ręki”. **Czeka na kroki 1 i 2.**
- [x] 4. `[frontend]` `FriendCode.tsx`: podpis, kod, przycisk udostępniania z `Share.share` — skill: `test-driven-development`, `source-driven-development`, `frontend-ui-engineering` — najpierw testy: `FriendCode.test.tsx` — weryfikacja: pełny zestaw, weryfikator. **Czeka tylko na krok 2.**
- [ ] 5. `[frontend]` `ProBadge.tsx` ze stałą `IS_PRO = true` (komentarz: do podmiany przez zadanie subskrypcji) i gradientem `brand.primary` → `accent.sun` z `react-native-svg` — skill: `test-driven-development`, `frontend-design` — najpierw testy: `ProBadge.test.tsx` — weryfikacja: pełny zestaw, weryfikator (+ `ui-taste`), kontrast tekstu na obu końcach gradientu w obu motywach. **Czeka tylko na krok 2.**
- [ ] 6. `[frontend]` Wpięcie trzech komponentów w `ProfileScreen`: `tripSections(...).past`, stany z `useTripList`, tapnięcie = `select` (gdy nie bieżąca) + `router.navigate('/')`, odznaka i kod z profilu — jeden agent — skill: `test-driven-development`, `javascript-typescript-jest` — najpierw testy: `ProfileScreen.test.tsx` — weryfikacja: pełny zestaw, weryfikator. **Czeka na kroki 3, 4 i 5.**
- [ ] 7. (orkiestrator) Dokumenty z tabeli „Pliki”; potem weryfikator całej gałęzi z przeglądem CodeRabbit i tester na urządzeniu (jeśli podłączone): lista minionych, tapnięcie → „Podróż”, arkusz udostępniania z kodem, odznaka w obu motywach, offline — skill: `documentation-and-adrs`, `code-review` — weryfikacja: linki, grep starych opisów, pełny zestaw.

### Równoległość (D11)

```
fala A (równolegle):  krok 1 [backend]   krok 2 [frontend, i18n]
fala B (równolegle):  krok 4 FriendCode  krok 5 ProBadge     ← startują po PASS kroku 2, mogą biec obok kroku 1
                      krok 3 PastTrips                       ← startuje po PASS kroków 1 i 2
fala C (jeden agent): krok 6 ProfileScreen                   ← po PASS kroków 3, 4, 5
na końcu:             krok 7 dokumenty, weryfikator gałęzi, tester
```

- **Jeden plik = jeden agent.** Kroki 3, 4, 5 mają każdy własny nowy plik komponentu i własny plik testu. Nikt w krokach równoległych nie edytuje `ProfileScreen.tsx`, jego testów, `pl.json` ani `en.json` — te pliki należą wyłącznie do kroków 2 i 6.
- **Brakujący klucz i18n w kroku 3–5** → agent zwraca `Status: question`, nie dopisuje go sam.
- **Każdy krok jest weryfikowany osobno** (weryfikator po każdym) i commitowany osobno, tylko ze swoimi plikami (`git add <ścieżki>`, nigdy `git add -A`), w kolejności, w jakiej przechodzą weryfikację. Commity robi orkiestrator.
- **Pełny zestaw testów może biec z kilku agentów naraz** w tym samym worktree. Agent **nie „naprawia”** błędu testu, typecheck ani lint, który pochodzi z niedokończonych plików innego agenta — opisuje go w raporcie (plik, komunikat) i kończy swój krok na własnych plikach; orkiestrator powtarza pełne sprawdzenie, gdy tamten krok przejdzie. To zdanie jest w każdym briefie.
- Krok jest `[x]` dopiero, gdy pełny zestaw, typecheck i lint są zielone przy stanie drzewa, w którym nie ma cudzych niedokończonych plików, albo jedyne błędy pochodziły z nich i zniknęły po ich ukończeniu.

## Decyzje odłożone (nie budujemy teraz)

- **O1 — Ekran podsumowania podróży** po tapnięciu karty (zamiast przejścia na „Podróż”). Do decyzji Kacpra później (D2).
- **O2 — Prawdziwy status PRO z subskrypcji** (RevenueCat lub alternatywa): podmienia stałą `IS_PRO`; wtedy też schemat, migracja i RLS (D4).
- **O3 — Kopiowanie kodu do schowka i kod QR** — odrzucone na teraz (D3).
- **O4 — Stronicowanie / `FlatList`** dla bardzo długiej listy minionych podróży (A5).

## Dziennik postępu

- 2026-11-11 — plan zaakceptowany (D12–D18 z rekomendacji), start wykonania.
- 2026-11-11 — krok 2 (klucze i18n) PASS weryfikatora; en ma też `pastFriends_few`/`_many` (wymóg testu parzystości kluczy).
- 2026-11-11 — krok 4 (`FriendCode`) PASS weryfikatora.

## Ryzyka i otwarte pytania

### Ryzyka

- **R1 — Konflikty scalania** z gałęzią Ustawień w `pl.json` / `en.json`, `docs/architecture/` i `context/app-context.md`. Ograniczenie: nasze klucze tylko w obiekcie `profile`, dopisane na końcu; w dokumentach tylko akapity o ekranie Profil.
- **R2 — Tapnięcie zmienia bieżącą podróż na stałe** (jak w panelu bocznym): „Podróż”, „Wydatki” i „Plan” pokażą minioną podróż, dopóki użytkownik nie wybierze innej. To wprost wynika z D2.
- **R3 — Nazwy miast w dołączonej liście lotnisk są po angielsku** („Rome”, nie „Rzym”), także w polskiej wersji — tak jak dziś w domyślnej nazwie podróży.
- **R4 — Czytelność tekstu na jasnym zdjęciu** rozwiązuje gradient do `hero.scrim` (D8); weryfikator sprawdza na najjaśniejszym presecie.
- **R5 — Skalowanie czcionki:** karta ma minimalną, nie sztywną wysokość, nazwa maks. 2 linie; przy dużej czcionce karta rośnie.
- **R6 — `Share` w wersji web** może nie być dostępne; aplikacja jest mobilna, błąd jest po cichu pomijany (A6).
- **R7 — `app-context.md` §3.5 opisuje „bursztynowe” etykiety przesiadek, których w kodzie nie ma** (F4). Poprawiamy opis w kroku 7; samych etykiet nie ruszamy.

### Otwarte pytania do Kacpra

Rozstrzygnięte 2026-11-10: Q1 → D7, Q2 → D8, Q4 → D9, Q11 → D10; przy akceptacji: Q3 → D12, Q5 → D13, Q6 → D14, Q7 → D15, Q8 → D16, Q9 → D17, Q10 → D18. Wszystkie zamknięte; poniżej zapis pytań:

- **Q3 — Podróż solo (0 znajomych).** (a) „Podróż solo” — **rekomendacja**; (b) nie pokazywać tej linii; (c) „0 znajomych”.
- **Q5 — Rogi i wysokość karty.** (a) `radii.lg` = 20 (jak karta statystyk nad nią) i wysokość `card.tripImageHeight` = 156 — **rekomendacja**; (b) `radii.xl` = 24; (c) `radii.xs` = 8 („lekko” dosłownie).
- **Q6 — Gdzie odznaka PRO.** (a) obok nicku, w tym samym wierszu — **rekomendacja**; (b) pod nickiem; (c) w nagłówku obok „Profil”.
- **Q7 — Gdzie kod znajomego.** (a) własna karta między wierszem profilu a statystykami: podpis „Twój kod znajomego”, kod, ikona udostępniania po prawej — **rekomendacja** (blisko wzoru „Invite friends” z obrazka); (b) pod nickiem w wierszu profilu, małym tekstem z ikoną; (c) na dole ekranu, pod listą podróży.
- **Q8 — Tekst udostępniania.** Propozycja: pl „Dodaj mnie do podróży w Travelo. Mój kod znajomego: K7M2QX”, en „Add me to your trip in Travelo. My friend code: K7M2QX”. (a) akceptuję — **rekomendacja**; (b) sam kod; (c) własna treść.
- **Q9 — Brak minionych podróży.** (a) nagłówek „Minione podróże” + zdanie „Tu pojawią się Twoje zakończone podróże.” — **rekomendacja**; (b) cała sekcja ukryta.
- **Q10 — Błąd wczytania listy (brak kopii).** (a) zdanie „Nie udało się wczytać podróży.” bez przycisku, spójnie z kreskami w statystykach — **rekomendacja**; (b) zdanie + „Spróbuj ponownie” (zmienia istniejącą decyzję A2 i jej test); (c) sekcja ukryta, zostają same kreski w statystykach.