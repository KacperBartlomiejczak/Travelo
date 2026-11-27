# Zadanie: poprawki z review CodeRabbit do PR #48 (ticket import)
Status: zrobione (2026-11-24)

Gałąź: `fix/pr48-coderabbit`, z `origin/feature/ticket-import-ai` (commit `47b89b7`), bo kod PR #48 nie jest
jeszcze w `main` (decyzja Kacpra, 2026-11-24). Po zakończeniu: merge do `feature/ticket-import-ai`, PR #48 się
aktualizuje.

## Zrozumienie i założenia
CodeRabbit (review z 2026-11-24, commit `47b89b7`) dodał 14 uwag, wszystkie nierozwiązane. Sprawdziłem każdą
względem kodu na gałęzi PR. Wszystkie są zasadne. Dwie wymagają Twojej decyzji (patrz „Pytania”).

### Backend (parser, Edge Function)
- **U1 [Minor] `src/lib/ticket-parse/text.ts:105`**: `Arrival 2026-02-30 13:00` → `dates(arr)` daje `[null]`,
  fallback bierze dzień wylotu i powstaje błędne `arriveAt = 2026-12-05T13:00`, które przechodzi walidację.
  Poprawka: fallback na dzień wylotu tylko gdy w oknie przylotu **nie ma żadnej** daty; zła data → `arriveAt: null`.
- **U2 [Major] `src/lib/ticket-parse/merge.ts:23`**: gdy jest kod BCBP (np. tylko wylot), loty z samego tekstu
  (np. powrót) lądują w `unused` i są wyrzucane. Poprawka: dołączyć niedopasowane loty z tekstu, z zachowaniem
  kolejności trasy, limitu 8 segmentów i pierwszeństwa BCBP dla dopasowanych lotów.
- **U3 [Minor] `supabase/functions/extract-ticket/handler.ts:116`**: `.find()` bierze tylko pierwszy poprawny kod
  BCBP, więc osobny kod powrotu ginie. Poprawka: zebrać odcinki ze wszystkich poprawnych kodów, w kolejności
  dokumentu, bez duplikatów (ten sam kod pasażera powtórzony na stronie).
- **U4 [Minor] `supabase/functions/extract-ticket/stage1.ts:29`**: `toRgba` ustawia alfę 255, więc maska obrazu
  z unpdf (czarne RGB + przezroczyste tło) zamienia się w czarny prostokąt. Poprawka: piksele RGBA nakładać na
  białe tło; obrazy nieprzezroczyste bez zmian.
- **U5 [Minor] `stage1.ts:49`**: zxing-wasm 3.1.7 cache'uje odrzucony promise, więc reset `ready` nie wystarcza.
  Poprawka: przy błędzie wywołać `purgeZXingModule()`, udane ładowanie dalej w cache.
- **U6 [Major, heavy lift] `stage1.ts:62`**: `extractImages` z unpdf dekoduje **wszystkie** obrazy strony do RGBA,
  zanim zadziała limit `MAX_PDF_IMAGES`. Skompresowany PDF ze 100 obrazami 1024×1024 to ok. 400 MiB. Decyzja → P1.

### Frontend (wizard, import)
- **U7 [Major] `src/app/trips/new/index.tsx:65`**: `ticketImported` sprawdza `draft` z renderu, w którym import
  ruszył. Gdy użytkownik w tym czasie zmieni loty, potwierdzenie zastąpienia jest pomijane. Poprawka: najnowszy
  `draft` w `useRef`, sprawdzany w `ticketImported`.
- **U8 [Minor] `src/features/trip-create/TicketImportSheet.tsx:82`**: arkusz można zamknąć, póki trwa
  przygotowanie pliku (`busy` jeszcze `false`); `send()` dalej wysyła plik, woła `onImported` i rusza `busy`.
  Poprawka: licznik sesji otwarcia; po pickerze i przed każdą zmianą stanu / wysyłką sprawdzić, czy sesja ta sama.
- **U9 [Minor] `src/features/trip-create/ticket-pick.ts:39`**: gdy picker nie poda `size`, 100 MiB PDF jest
  czytany przez `base64()`. Poprawka: sprawdzić `new File(uri).size` przed `base64()`; małe pliki bez `size`
  dalej działają, sprzątanie bez zmian.
- **U10 [Minor] `ticket-pick.ts:80`**: kopia zdjęcia z pickera (`result.assets[0].uri`, w cache aplikacji) nie jest
  kasowana. Poprawka: zewnętrzny `finally` kasujący kopię pickera, także gdy obróbka się wysypie. Oryginał w
  galerii nietknięty.
- **U11 [Minor] `src/features/trip-create/draft.ts:143`**: `suggestedDate` z biletu jest zapisywany, ale nigdzie
  nieużywany; picker startuje od dzisiejszego południa. Poprawka w `SegmentCard.tsx`: gdy pole puste i jest
  `suggestedDate` → podpowiedź `${suggestedDate}T12:00` (wylot; przylot: `departAt`, a gdy puste — ta sama
  podpowiedź). Bez `suggestedDate` zostaje obecne zachowanie (przylot poprzedniego odcinka).

### Copy i dokumentacja
- **U12 [Major] `docs/legal/privacy-policy.en.md:53`** (+ `.pl.md`, `en.json`/`pl.json:721`): „przetwarzany tylko
  w pamięci serwera” jest nieprawdą, gdy plik idzie do Gemini (`inlineData`). Decyzja o treści → P2.
- **U13 [Minor] `en.json:721`** (+ `pl.json`, polityka): „kopia robocza jest kasowana” — `discard()` połyka błąd
  kasowania, więc to „best effort”. Razem z U12 → P2.
- **U14 [Major] `docs/architecture/backend.md:35`**: w notce o deployu brak kroku „najpierw migracja
  `20261119120000_ticket_quota.sql`”, bez niej `consume_ai_quota` z `ticket` / `ticket_rejected` kończy się 500.
  Poprawka: dopisać krok przed `supabase functions deploy extract-ticket`.

## Pytania (do decyzji Kacpra)
- **P1 (U6)** — jak ograniczyć pamięć przy obrazach PDF?
  a) **(rekomendacja)** Własne przejście po operatorach strony (pdf.js `getOperatorList` przez `getDocumentProxy`
     z unpdf): odczytać wymiary obrazów i pominąć stronę/obraz, gdy przekroczony limit liczby (6) lub pikseli
     (np. 2000×2000), zanim cokolwiek zostanie zamienione na RGBA. Więcej kodu w `stage1.ts`, test na fixture.
  b) Zostawić `extractImages`, dopisać do `known-limitations.md` (plik ≤ 5 MB, ryzyko tylko dla złośliwego PDF,
     funkcja i tak pada → częściowe dane / 502).
- **P2 (U12, U13)** — nowe zdanie (EN/PL, w polityce i w zgodzie w aplikacji). Propozycja:
  - EN: „We do not store the file — it is processed in the server's memory and sent to Google Gemini only to read
    the ticket; it never goes to our file storage or logs. The app tries to delete the working copy on your phone
    right after sending.”
  - PL: „Nie przechowujemy pliku — jest przetwarzany w pamięci serwera i wysyłany do Google Gemini tylko po to, by
    odczytać bilet; nie trafia do naszego magazynu plików ani logów. Aplikacja próbuje skasować kopię roboczą na
    telefonie zaraz po wysłaniu.”
  Uwaga: gdy bilet odczyta sam parser (etap 1), Gemini nie jest wołane. Zdanie mówi „wysyłany do Gemini”
  bez „zawsze”; alternatywa: „…a gdy sam odczyt nie wystarczy, wysyłany do Google Gemini…”.

## Struktury danych (Zod)
Brak zmian. `ParsedTicket` / `TicketSegment` (`src/schemas/ticket.ts`) zostają; limit 1–8 segmentów z
`validateParsed`.

## Testy (najpierw red)
- U1: `src/lib/ticket-parse/__tests__/text.test.ts` — nieprawidłowa data przylotu → `arriveAt: null`; brak daty
  przylotu i późniejsza godzina → dalej dzień wylotu.
- U2: `merge.test.ts` — BCBP z wylotem + tekst z wylotem i powrotem → 2 segmenty, wylot z BCBP, powrót z tekstu,
  kolejność trasy; limit 8.
- U3: `supabase/functions/extract-ticket/__tests__/handler.test.ts` — dwa różne kody BCBP → oba odcinki; ten sam
  kod dwa razy → jeden.
- U4, U5 (i U6 gdy a): `__tests__/stage1.test.ts` (subprocess Node) — maska z przezroczystym tłem czytana jako
  kod; drugi `prepare` po błędzie woła `purgeZXingModule` i próbuje ponownie; (U6a) PDF ponad limit obrazów/pikseli
  nie dekoduje obrazów.
- U7: test ekranu `trips/new` — import ruszył przy pustym drafcie, w międzyczasie zmiana lotu → pokazuje się
  `ConfirmDialog`.
- U8: `TicketImportSheet.test.tsx` — zamknięcie arkusza zanim picker się rozwiąże → brak `mutateAsync`, brak
  `onImported`, `busy` bez zmian.
- U9, U10: `ticket-pick.test.ts` — duży lokalny plik bez `size` → `file_too_large` bez `base64()`; zdjęcie: kasowane
  i `saved.uri`, i kopia pickera (realistyczny URI z cache), także gdy `renderAsync` rzuca.
- U11: `SegmentCard.test.tsx` — puste pole + `suggestedDate` → `suggested` = `${date}T12:00`; bez daty bez zmian.

## Pliki
- backend: `src/lib/ticket-parse/text.ts`, `src/lib/ticket-parse/merge.ts`,
  `supabase/functions/extract-ticket/handler.ts`, `supabase/functions/extract-ticket/stage1.ts` + testy
- frontend: `src/app/trips/new/index.tsx`, `src/features/trip-create/TicketImportSheet.tsx`,
  `src/features/trip-create/ticket-pick.ts`, `src/features/trip-create/SegmentCard.tsx`, `src/i18n/locales/en.json`,
  `src/i18n/locales/pl.json` + testy
- orkiestrator: `docs/architecture/backend.md`, `docs/legal/privacy-policy.en.md`, `docs/legal/privacy-policy.pl.md`,
  (U6b) `docs/architecture/known-limitations.md`, ten plan

## Kroki (fale z task-plannera)
Każdy krok: najpierw test (red), potem kod, potem verifier. Żadne dwa kroki w jednej fali nie dotykają tego samego pliku.

### Fala 1 (od razu, wszystko równolegle)
- [x] **1a [backend] U1**: `src/lib/ticket-parse/text.ts` + `__tests__/text.test.ts`
- [x] **1b [backend] U2**: `src/lib/ticket-parse/merge.ts` + `__tests__/merge.test.ts` (sygnatura `mergeParsed` bez zmian)
- [x] **1c [backend] U3**: `supabase/functions/extract-ticket/handler.ts` + `__tests__/handler.test.ts`. Handler sam
  składa jeden `BoardingPass` z odcinków wszystkich poprawnych kodów (bez duplikatów, kolejność dokumentu) i
  podaje go do `mergeParsed`. Połączonego obiektu **nie** walidować `BoardingPassSchema` (`legs.max(4)`); limit 8
  pilnuje `validateParsed`.
- [x] **1d [backend] U4 + U5**: `supabase/functions/extract-ticket/stage1.ts` + `__tests__/stage1.test.ts`
  (+ ew. `test-support/stage1-driver.mjs`)
- [x] **1e [frontend] U7**: `src/app/trips/new/index.tsx` + `src/__tests__/app/trips/new/flights.test.tsx`
- [x] **1f [frontend] U8**: `src/features/trip-create/TicketImportSheet.tsx` + `__tests__/TicketImportSheet.test.tsx`
- [x] **1g [frontend] U9 + U10**: `src/features/trip-create/ticket-pick.ts` + `__tests__/ticket-pick.test.ts`
- [x] **1h [frontend] U11**: `src/features/trip-create/SegmentCard.tsx` + nowy `__tests__/SegmentCard.test.tsx`
- [x] **1i [orkiestrator] U14**: `docs/architecture/backend.md` (krok migracji przed deployem)

Po fali 1: pełny `pnpm test` zanim 1b i 1c dostaną `[x]` (zmieniają wynik parsera; gdy padnie inny test handlera,
poprawka idzie jako osobny krok do właściciela pliku).

### Fala 2 (po Twoich decyzjach P1 / P2)
- [x] **2a [backend] U6 (P1 = a)**: `stage1.ts` + `stage1.test.ts` (+ fixture); po 1d, te same pliki.
  Albo **2a' [orkiestrator] (P1 = b)**: `docs/architecture/known-limitations.md`.
- [x] **2b [frontend] U12 + U13**: `src/i18n/locales/en.json`, `pl.json` (+ test, jeśli sprawdza tekst zgody)
- [x] **2c [orkiestrator] U12 + U13**: `docs/legal/privacy-policy.en.md`, `docs/legal/privacy-policy.pl.md` (równolegle z 2b)

### Fala 3 (koniec)
- [x] verifier całej gałęzi + CodeRabbit, `pnpm test` / `typecheck` / `lint` zielone, merge do
  `feature/ticket-import-ai`, odpowiedzi w 14 wątkach PR #48

## Weryfikacja
- po każdym kroku: verifier (PASS → `[x]`)
- na końcu: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone; verifier całej gałęzi + CodeRabbit; odpowiedzi na
  14 wątków w PR #48
- bez nowych zależności → cve-auditor tylko jeśli chcesz testów na telefonie (tester: import PDF z dwoma kodami,
  zamknięcie arkusza w trakcie, data z biletu w pickerze)

## Ryzyka
- U2/U3 zmieniają wynik parsera: więcej segmentów → częściej `complete` bez Gemini. Testy handlera muszą pokryć
  zgodność z Gemini (liczba segmentów).
- U6a: pdf.js API (operator list) bez renderera w Deno — możliwe, że wymiary obrazów są dostępne dopiero po
  dekodowaniu; wtedy wracam z pytaniem zamiast zgadywać.

## Decyzje (2026-11-24)
- Plan zaakceptowany ("Akceptuje").
- P1 = a: własny limit wymiarów/liczby obrazów przed dekodowaniem (krok 2a, po 1d).
- P2 = wersja warunkowa:
  - PL: „Nie przechowujemy pliku — jest przetwarzany w pamięci serwera, a gdy sam odczyt nie wystarczy, wysyłany do Google Gemini; nie trafia do naszego magazynu plików ani logów. Aplikacja próbuje skasować kopię roboczą na telefonie zaraz po wysłaniu.”
  - EN: “We do not store the file — it is processed in the server's memory and, when our own reading is not enough, sent to Google Gemini; it never goes to our file storage or logs. The app tries to delete the working copy on your phone right after sending.”
- P1, doprecyzowanie (2026-11-24): pdf.js dekoduje wszystkie obrazy już w `getOperatorList`, więc liczby obrazów nie da się ograniczyć przed dekodowaniem. Kacper wybrał limit rozmiaru pojedynczego obrazu: `maxImageSize` = 400 000 pikseli (~640×640). Większe obrazy są pomijane, wtedy działa tekst albo Gemini. Nieograniczona liczba obrazów trafia do `known-limitations.md`.
- Ponad 8 segmentów (2026-11-24): Kacper wybrał „wynik niepełny”: gdy parser obcina loty do 8, wynik nie może być `complete`, żeby aplikacja pokazała „sprawdź loty”. Krok 2d.

### Krok dodatkowy
- [x] **2d [backend]**: obcięcie do 8 segmentów (merge i tekst) → `complete: false`; test najpierw.
- Kolejność w obrębie dnia (2026-11-24): loty z godziną wylotu po kolei, lot bez godziny na końcu dnia (Kacper).

## Wynik (2026-11-24)
- Końcowy verifier (Sonnet 5.5 + CodeRabbit): PASS; 4689 testów, typecheck, lint zielone.
- Fast-forward `feature/ticket-import-ai` do `e530b7c` (PR #48), odpowiedzi w 14 wątkach.
- Trzy rzadkie przypadki z końcowego CodeRabbita naprawione w dodatku (E1–E3).

## Dodatek: 3 rzadkie przypadki z końcowego CodeRabbita (2026-11-24)
Status: zrobione (2026-11-24; verifier PASS, 4694 testy). Ta sama gałąź `fix/pr48-coderabbit` → push do `feature/ticket-import-ai` (PR #48).
Pliki: tylko `src/lib/ticket-parse/merge.ts` + `__tests__/merge.test.ts` (backend, jeden krok, testy najpierw).

- **E1 — lot z tekstu bez daty łapany przed lotem z datą.** Dziś `findIndex` bierze pierwszy pasujący (ta sama trasa, ta sama data **albo** brak daty). Poprawka: najpierw szukać lotu z tą samą trasą i datą, dopiero potem lotu bez daty.
  Test: tekst [WAW→BCN bez daty, WAW→BCN 12-05 10:00] + BCBP WAW→BCN 12-05 → odcinek z BCBP dostaje 10:00.
- **E2 — sortowanie po czasie lokalnym.** Dziś w obrębie dnia porównujemy `departAt` jako tekst (czas lokalny lotniska). Poprawka: porównywać chwilę wylotu w UTC (`zonedLocalToDate(departAt, strefa lotniska wylotu)` z `src/lib/time.ts`, strefa z `airports`). Grupowanie po dniu i „bez godziny na koniec dnia” bez zmian.
  Test: ten sam dzień, NRT 17:00 (+09) i LAX 12:00 (−08) → NRT pierwszy (08:00 UTC przed 20:00 UTC).
- **E3 — przesiadka bez godziny.** Doprecyzowanie Twojej decyzji „bez godziny na koniec dnia”: wyjątek, gdy lot bez godziny kończy się tam, gdzie zaczyna się lot z godziną tego samego dnia (np. WAW→BCN bez godziny, BCN→MAD 12:00) — wtedy idzie tuż przed nim (ciągłość trasy). W pozostałych przypadkach dalej na koniec dnia.
  Test: [BCN→MAD 12:00, WAW→BCN bez godziny] → WAW→BCN, BCN→MAD, oba `outbound`.

Ryzyko: `merge.ts` jest też w Edge Function (Deno) — import `../time.ts` musi działać w Deno (`deno check`).
Weryfikacja: verifier kroku, pełny `pnpm test`/`typecheck`/`lint`, `deno check`, push, bez nowego przeglądu całej gałęzi (zmiana w jednym pliku).
- E3, doprecyzowanie przy wykonaniu: wyjątek nie działa, gdy lot z godziną tego samego dnia kończy się tam, gdzie lot bez godziny się zaczyna (lot bez godziny kontynuuje wcześniejszy lot) — wtedy zostaje na końcu dnia. To ta sama zasada ciągłości trasy.

## Dodatek 2: drugie review CodeRabbita (commit 221e27b, 2026-11-24)
Status: zrobione (2026-11-24; 4699 testów, deno check OK). Ta sama gałąź `fix/pr48-coderabbit` → push do `feature/ticket-import-ai` (PR #48).
CodeRabbit nie przejrzał jeszcze `d2b5cfe` (check „skipping”). 13/14 pierwotnych wątków rozwiązane.

### Uwagi i decyzje
- **F1 [Minor] `merge.ts:12` — dopasowanie bez numeru lotu.** Dwa loty z kodów na tej samej trasie i w tym samym dniu z różnymi numerami → godziny z tekstu mogą się zamienić. Poprawka: gdy oba źródła mają `flightNumber` i się różnią, to nie jest dopasowanie; kolejność szukania: trasa+dzień+numer → trasa+dzień (numer brak po którejś stronie) → trasa bez daty (numer zgodny lub brak).
  Test: BCBP [WAW→BCN LO123 12-05, WAW→BCN LO125 12-05], tekst w odwrotnej kolejności z godzinami → każdy lot dostaje swoje godziny.
- **F2 [Minor] `stage1.ts` — brak `registerImageDecoders()`.** Nasze własne przejście po obrazach (U6) pominęło krok, który robił `extractImages`; obrazy CCITT / JBIG2 / JPEG 2000 mogą się nie zdekodować. Poprawka: wywołać `registerImageDecoders()` z `unpdf` raz w `createStage1Ports` (działa w Node-teście i w Deno, bez zmian w `index.ts`).
  Test: kod z obrazu w jednym z tych formatów, jeśli fixture da się wygenerować małym kosztem; inaczej wstrzykiwana funkcja (jak `purge`, „only for tests”) i asercja, że jest wywołana przed pierwszym `getDocumentProxy`.
- **F3 [Minor] `stage1.ts` — dokumenty PDF nie są zamykane.** Poprawka: w `decodeBarcodes` i `extractPdfText` praca na dokumencie w `try`/`finally` z `await doc.destroy()` (również przy błędzie).
  Test: dokument zniszczony po sukcesie i po błędzie (wstrzykiwane otwieranie dokumentu albo licznik w driverze).
- **F4 — wątek U6 (liczba obrazów).** Bez zmian w kodzie: to Twoja decyzja P1 (limit rozmiaru pojedynczego obrazu, liczba obrazów nieograniczona przed dekodowaniem, bo pdf.js dekoduje w `getOperatorList`; opisane w `known-limitations.md`). Odpowiedź w wątku z tym uzasadnieniem.
- **F5 — sortowanie po strefach czasowych.** Już naprawione w `d2b5cfe` (E2). Odpowiedź w wątku.

### Kroki (fala 1 równolegle, różne pliki)
- [x] **A [backend] F1**: `src/lib/ticket-parse/merge.ts` + `__tests__/merge.test.ts`
- [x] **B [backend] F2 + F3**: `supabase/functions/extract-ticket/stage1.ts` + `__tests__/stage1.test.ts` (+ `test-support/`)
- [x] **C [orkiestrator]**: po PASS obu — pełny `pnpm test`/`typecheck`/`lint`, `deno check`, push, odpowiedzi w wątkach (F1–F5).
- F1, doprecyzowanie (Kacper, 2026-11-24): różne numery lotów nadal się łączą, gdy dopasowanie trasa+dzień jest jednoznaczne (dokładnie jeden lot z kodu i jeden z tekstu na tej trasie i w tym dniu; BCBP wygrywa na numerze). Przy dwóch lub więcej lotach na tej samej trasie i w tym samym dniu łączymy tylko po numerze.

## Dodatek 3: trzecie review CodeRabbita (commit fbf6378, 2026-11-24)
Status: zrobione (2026-11-24; zaakceptowany przez Kacpra: P4 = a, P5 = a, P6 = proponowany tekst). Push `fbf6378..1832136` do PR #48, odpowiedzi i rozwiązanie wszystkich 10 wątków. Ta sama gałąź `fix/pr48-coderabbit` (= `origin/feature/ticket-import-ai`, `fbf6378`) → push do PR #48.

### Skąd „te same błędy”
10 otwartych wątków. Tylko **jeden** to powtórka (G1): poprawka E2 sortowała po UTC tylko w obrębie **tej samej lokalnej daty**,
a komparator dalej najpierw porównuje `flightDate`. Pozostałe 9 to nowe uwagi: każdy push uruchamia nowy przegląd, a CodeRabbit
znajduje kolejne przypadki brzegowe w świeżym kodzie. Żeby nie kręcić się w kółko: poprawiamy zasadne, a na resztę odpowiadamy
w wątku (z uzasadnieniem albo wpisem w `known-limitations.md`) i rozwiązujemy wątek.

### Uwagi (sprawdzone w kodzie)
- **G1 [Minor, powtórka] `src/lib/ticket-parse/merge.ts:42` — sortowanie przez północ.** NRT→HNL 6.12 00:30 (Tokio) jest przed
  HNL→SFO 5.12 15:00 (Honolulu), a komparator stawia HNL→SFO pierwszy, bo porównuje datę lokalną. Przyczyna: dwa klucze (data, potem
  chwila). Poprawka: **jeden klucz liczbowy** — lot z godziną: chwila wylotu w UTC; lot bez godziny z datą: koniec tego dnia
  (zachowuje „bez godziny na koniec dnia” i regułę przesiadki E3); bez daty: na końcu. Jeden klucz = sortowanie przechodnie.
  Test: przypadek NRT/HNL powyżej + istniejące testy E2/E3 bez zmian.
- **G2 [Minor] `src/lib/ticket-parse/text.ts:96` — data przylotu brana jako data wylotu.** `WAW -> BCN FR123 Departure 23:00
  Arrival 2026-12-06 01:00` → `blockDate` = 6.12 (jedyna data w bloku, ale z okna przylotu) → wylot 6.12 23:00. Poprawka: `blockDate`
  liczony z bloku **bez okna przylotu**; brak daty wylotu → `null`.
  Test: ten przypadek → `flightDate: null`, `departAt: null`.
- **G3 [Minor] `text.ts:120-124` — mieszane formaty tras.** Gdy wylot jest w formacie `WAW -> BCN`, a powrót `Departure Barcelona
  (BCN) … Arrival Warsaw (WAW)`, formaty `PAREN_ROUTE` / `labelledRoutes` w ogóle się nie uruchamiają → powrót ginie i parser może
  zwrócić `complete: true` z jednym lotem. Poprawka: zbierać trasy ze **wszystkich** formatów, sortować po pozycji, usuwać
  nakładające się dopasowania (pierwsze wygrywa), potem dzielić na bloki.
  Test: ten przypadek → 2 loty, powrót `return`; istniejące testy formatów bez zmian.
  Doprecyzowanie przy wykonaniu (verifier FAIL, 2026-11-24): nagłówek `Warszawa (WAW) - Barcelona (BCN)` + szczegóły
  `Departure Warsaw (WAW) Arrival Barcelona (BCN)` dawały 2 identyczne loty. Trasa o tych samych `from`/`to` co poprzednia
  zachowana trasa **i z innego formatu zapisu** jest pomijana, więc blok pierwszej trasy obejmuje też szczegóły — tak jak przed
  zmianą. Powtórki w tym samym formacie zostają osobnymi lotami (istniejący test 8 lotów WAW → BCN w różne dni).
  Zauważone, poza zakresem: `dates()` traktuje „NN Słowo RRRR” bez nazwy miesiąca (np. `45 Arrival 2026`) jak złą datę (`null`),
  co może przypadkiem wyzerować `blockDate`. Błąd sprzed tej gałęzi.
- **G4 [Minor] `stage1.ts` (`MAX_PDF_PAGES` = 3) + `handler.ts:142` — PDF dłuższy niż 3 strony.** Tekst czytamy z 3 stron; lot ze
  strony 4 ginie, a wynik z pierwszych stron może wyjść jako `complete: true` (`parser`, bez AI). Decyzja → **P4**.
- **G5 [Major] `supabase/functions/extract-ticket/index.ts:29` — brak limitu rozmiaru body.** `req.json()` wczytuje całe body przed
  sprawdzeniem 413. Uwaga CodeRabbita, że trasa działa bez logowania, **jest błędna** (`verify_jwt = true` w `config.toml`), ale
  zalogowany użytkownik dalej może wysłać ogromne body. Poprawka: mały helper (nowy plik obok handlera, testowalny w Jest) czyta
  body strumieniowo z limitem bajtów (5 MB pliku w base64 ≈ 6,67 MB + zapas na JSON, np. 7 MB); po przekroczeniu 413
  `{ error: 'file_too_large' }`, bez czekania na resztę. `index.ts` tylko go woła.
  Test: body poniżej limitu → obiekt; powyżej (też bez `Content-Length`) → 413; zły JSON → `undefined` jak dziś.
- **G6 [Minor] `ports.ts:50` — zwrot limitu po północy UTC.** Rezerwacja przed północą, `not_a_ticket` po północy → zwrot trafia
  w licznik nowego dnia. Okno ~45 s na dobę, skutek: najwyżej 1 dodatkowe wywołanie Gemini. Decyzja → **P5**.
- **G7 [Major] `src/app/trips/new/index.tsx:199` — skaner otwierany w trakcie zamykania arkusza.** `onScan` zamyka `BottomSheet`
  (natywny `Modal`) i w tym samym renderze montuje `BoardingPassScanner` (drugi `Modal`). Na iOS drugi modal może się nie pokazać
  (iOS nie prezentuje modala, gdy poprzedni się jeszcze zamyka). Poprawka: `BottomSheet` dostaje opcjonalny `onDismissed`
  (z `Modal.onDismiss`, iOS); ekran otwiera skaner dopiero w nim. Android: bez zmian (otwiera od razu), tam problemu nie ma.
  Test: `onScan` nie montuje skanera od razu; po `onDismiss` arkusza — montuje.
- **G8 [Major] `src/features/trip-create/TicketImportSheet.tsx:93` — zgoda odznaczona w trakcie przygotowania pliku.** Po powrocie
  z pickera (czytanie base64 / zmniejszanie zdjęcia) widok zgody jest dalej aktywny; odznaczenie nie zatrzymuje wysyłki. Poprawka:
  aktualna zgoda w `useRef`, sprawdzana tuż przed `extract.mutateAsync(file)`; odznaczona → bez wysyłki.
  Test: odznaczenie po wyborze pliku, przed wysyłką → `mutateAsync` nie wywołany; zgoda zostaje → wysyłka jak dziś.
- **G9 [Minor] `src/i18n/locales/pl.json:73` / `en.json:73` — copy „nie wlicza się do dziennego limitu”.** Prawda tylko dla limitu
  analiz AI (5); próba dalej liczy się do limitu odrzuconych plików (10). Treść → **P6**.
- **G10 [Major] `src/features/trip-create/__tests__/draft.test.ts:297` — rzekomy błąd TS7053.** **Fałszywy alarm**: `pnpm typecheck`
  przechodzi (exit 0) na `fbf6378`. Bez zmian w kodzie, odpowiedź w wątku.

### Pytania (do decyzji Kacpra)
- **P4 (G4) — PDF dłuższy niż 3 strony.** Bilety często mają 2–5 stron (dalej regulamin).
  a) **(rekomendacja)** Gdy PDF ma więcej stron niż przeczytaliśmy, etap 1 nigdy nie zwraca `complete` → idzie do Gemini, który
     widzi cały plik. Koszt: 1 analiza AI z limitu dla takich biletów. Bez zmian w schemacie (flaga tylko między `stage1` a handlerem).
  b) Czytać więcej stron (np. 6) i dopiero powyżej → jak a). Mniej wywołań AI, ale bliżej budżetu CPU (2 s).
  c) Zostawić, wpis w `known-limitations.md`.
- **P5 (G6) — zwrot po północy.**
  a) **(rekomendacja)** Zostawić, wpis w `known-limitations.md` (najwyżej 1 dodatkowe wywołanie Gemini na użytkownika na dobę). Poprawka
     wymaga nowej migracji dla wspólnych RPC `consume_ai_quota` / `refund_ai_quota` (też plan dnia AI) i regeneracji typów.
  b) Naprawić: nowa migracja, oba RPC dostają `p_day`; handler przekazuje ten sam dzień do rezerwacji i zwrotu.
- **P6 (G9) — nowa treść `notTicketBody`** (propozycja):
  - PL: „Nie znaleźliśmy w pliku danych lotu. Wgraj PDF lub zdjęcie biletu albo karty pokładowej. Ta próba nie zużywa dziennego
    limitu analiz AI, ale liczy się do dziennego limitu odrzuconych plików.”
  - EN: “We didn't find any flight details in the file. Upload a PDF or a photo of a ticket or boarding pass. This attempt doesn't
    use one of your daily AI imports, but it counts towards the daily limit of rejected files.”

### Kroki (fala 1 równolegle, różne pliki; testy najpierw)
- [x] **A [backend] G1**: `src/lib/ticket-parse/merge.ts` + `__tests__/merge.test.ts`
- [x] **B [backend] G2 + G3**: `src/lib/ticket-parse/text.ts` + `__tests__/text.test.ts`
- [x] **C [backend] G5**: nowy helper body w `supabase/functions/extract-ticket/` + test, `index.ts` (wywołanie)
- [x] **D [backend] G4 (po P4)**: `stage1.ts`, `handler.ts` + ich testy
- [x] **E [frontend] G7**: `src/components/BottomSheet.tsx`, `src/app/trips/new/index.tsx` + testy
- [x] **F [frontend] G8**: `src/features/trip-create/TicketImportSheet.tsx` + `__tests__/TicketImportSheet.test.tsx`
- [x] **G [frontend] G9 (po P6)**: `src/i18n/locales/pl.json`, `en.json`
- [-] **H [backend] G6**: pominięty (P5 = a)
- [x] **I [orkiestrator]**: wpisy w `docs/architecture/known-limitations.md` (P4 = a / P5 = a), flows `ticket-import.md` jeśli
      zmienia się zachowanie (G4)
- [x] **J [orkiestrator]**: każdy krok → verifier; potem pełny `pnpm test` / `typecheck` / `lint`, `deno check`, push, odpowiedzi
      i rozwiązanie wszystkich 10 wątków (G10 i ewentualne „zostawiamy” z uzasadnieniem).

Wynik (2026-11-24): kroki A–G i I zrobione, każdy z PASS verifiera; 240 zestawów / 4717 testów, typecheck, lint, deno check zielone;
końcowy verifier gałęzi (Sonnet 5.5) PASS. Lokalny CodeRabbit (`fbf6378..HEAD`) zgłosił 3 uwagi. Decyzja Kacpra (2026-11-24):
najpierw poprawić K1 i K2, K3 wpisać do `known-limitations.md`, potem push.
- [x] **K1 [frontend]** · [x] **K2 [backend]** (oba PASS verifiera; K2: 0 różnic względem HEAD na 4034 wejściach, 20 000 tras: 18 zamiast 40 000 odczytów lotnisk; pełny `pnpm test` 4718 zielony) · [x] **K3 [orkiestrator]**
- K1 [nit] `TicketImportSheet.tsx:79` — `acceptedRef` aktualizowany w `useEffect`; prościej i pewniej ustawiać go w `onChange` checkboxa i w `startOver`.
- K2 [niska] `text.ts:136` — usuwanie duplikatów tras jest kwadratowe; spreparowany tekst z tysiącami tras kosztuje dużo CPU. Poprawka: przestać zbierać po 9 zachowanych trasach (limit 8 + 1 do flagi `truncated`).
- K3 [rzadki przypadek] `text.ts:135` — ta sama trasa w innym formacie i z inną datą jest traktowana jak ten sam lot. Do `known-limitations.md`.

Ryzyka: G1/G3 zmieniają kolejność/liczbę lotów — istniejące testy merge/text muszą zostać zielone bez zmian; `merge.ts` i
`text.ts` działają też w Deno (`deno check`). G7: `Modal.onDismiss` jest tylko na iOS — test musi pokryć obie platformy.

## Dodatek 4: czwarte review CodeRabbita (commit 8192ca0, 2026-11-27)
Status: zaakceptowany przez Kacpra (2026-11-27: P7 = a). Ta sama gałąź → push `HEAD:feature/ticket-import-ai`. CI (CodeRabbit) zielone,
PR `MERGEABLE`. Otwarte są 2 wątki.

### Uwagi (sprawdzone w kodzie)
- **H1 [Minor] `prompts/coderabbit-pr48-fixes/plan.md:281`**: krok I podawał „P4 = c”, a decyzja to P4 = a (linia 203, krok D).
  Poprawione w tym dodatku (orkiestrator). Odpowiedź w wątku.
- **H2 [Major] `src/lib/ticket-parse/validate.ts:75` (wywołanie w `supabase/functions/extract-ticket/handler.ts:219`): lot ze
  strony 4 i tak ginie.** P4 = a wysyła PDF z nieprzeczytanymi stronami do Gemini, ale `validateTicket` wymaga, żeby Gemini zwrócił
  **dokładnie tyle** lotów co etap 1. Etap 1 widzi 1 lot (strony 1–3), Gemini poprawnie zwraca 2 (strona 4) → `mismatch` → odpowiedź
  502 z częściowymi danymi z etapu 1 (`complete: false`), a analiza AI zostaje zużyta. P4 = a w praktyce nic nie daje. Uwaga zasadna.
  Poprawka → **P7**.

### Pytania (do decyzji Kacpra)
- **P7 (H2): jak porównać loty z etapu 1 z dłuższą odpowiedzią Gemini, gdy były nieprzeczytane strony.**
  a) **(rekomendacja)** Tylko gdy `skippedPages`: Gemini może zwrócić **co najmniej** tyle lotów co etap 1. Każdy lot z etapu 1 musi
     mieć odpowiednik w odpowiedzi Gemini **w tej samej kolejności** (podciąg, bo lot ze strony 4 może być wcześniej w czasie), a znane
     pola muszą się zgadzać jak dziś. Dopasowane loty dostają kierunek z etapu 1 (Z9), dodatkowe zostają z kierunkiem od Gemini. Bez
     `skippedPages`: bez zmian (liczba musi być równa). `validateTicket` dostaje flagę z handlera.
  b) Jak a), ale odpowiedniki tylko jako **pierwsze** N lotów Gemini (prefiks). Prościej, ale odrzuca poprawny bilet, gdy lot ze strony 4
     jest wcześniejszy w czasie.
  c) Zostawić, wpis w `known-limitations.md`.

### Kroki (po akceptacji; testy najpierw)
- [x] **A [backend] H2 (po P7)**: `src/lib/ticket-parse/validate.ts` + `__tests__/validate.test.ts`, `handler.ts` (przekazanie
      `skippedPages`) + jego test. Testy: etap 1 = 1 lot, `skippedPages`, Gemini = 2 loty zgodne → `ok`, 2 loty, `complete` wg
      `isComplete`; to samo bez `skippedPages` → `mismatch` (jak dziś); `skippedPages`, ale lot z etapu 1 niezgodny w znanym polu →
      `mismatch`; lot z etapu 1 nieobecny w odpowiedzi → `mismatch`; Gemini z mniejszą liczbą lotów → `mismatch`.
- [x] **B [orkiestrator]**: verifier kroku A; pełny `pnpm test` / `typecheck` / `lint`, `deno check`; flows `ticket-import.md`, jeśli
      opisuje porównanie; push; odpowiedzi w obu wątkach i ich rozwiązanie.

Ryzyka: `validate.ts` działa też w Deno (`deno check`). Istniejące testy `validate` muszą zostać zielone bez zmian.

Wynik (2026-11-27): krok A zrobiony, testy widziane na czerwono (`mismatch` z porównania liczby lotów), verifier PASS. 240 zestawów /
4725 testów, typecheck, lint, `deno check` zielone. Dopasowanie zachłanne (najwcześniejszy zgodny lot Gemini po poprzednim), co
wystarcza do sprawdzenia podciągu. Flows `ticket-import.md` zaktualizowane. Push i odpowiedzi w obu wątkach.
