# Zadanie: poprawki z review CodeRabbit do PR #48 (ticket import)
Status: w trakcie (zaakceptowany 2026-11-24)

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
- [ ] **1a [backend] U1**: `src/lib/ticket-parse/text.ts` + `__tests__/text.test.ts`
- [ ] **1b [backend] U2**: `src/lib/ticket-parse/merge.ts` + `__tests__/merge.test.ts` (sygnatura `mergeParsed` bez zmian)
- [ ] **1c [backend] U3**: `supabase/functions/extract-ticket/handler.ts` + `__tests__/handler.test.ts`. Handler sam
  składa jeden `BoardingPass` z odcinków wszystkich poprawnych kodów (bez duplikatów, kolejność dokumentu) i
  podaje go do `mergeParsed`. Połączonego obiektu **nie** walidować `BoardingPassSchema` (`legs.max(4)`); limit 8
  pilnuje `validateParsed`.
- [ ] **1d [backend] U4 + U5**: `supabase/functions/extract-ticket/stage1.ts` + `__tests__/stage1.test.ts`
  (+ ew. `test-support/stage1-driver.mjs`)
- [ ] **1e [frontend] U7**: `src/app/trips/new/index.tsx` + `src/__tests__/app/trips/new/flights.test.tsx`
- [ ] **1f [frontend] U8**: `src/features/trip-create/TicketImportSheet.tsx` + `__tests__/TicketImportSheet.test.tsx`
- [ ] **1g [frontend] U9 + U10**: `src/features/trip-create/ticket-pick.ts` + `__tests__/ticket-pick.test.ts`
- [ ] **1h [frontend] U11**: `src/features/trip-create/SegmentCard.tsx` + nowy `__tests__/SegmentCard.test.tsx`
- [ ] **1i [orkiestrator] U14**: `docs/architecture/backend.md` (krok migracji przed deployem)

Po fali 1: pełny `pnpm test` zanim 1b i 1c dostaną `[x]` (zmieniają wynik parsera; gdy padnie inny test handlera,
poprawka idzie jako osobny krok do właściciela pliku).

### Fala 2 (po Twoich decyzjach P1 / P2)
- [ ] **2a [backend] U6 (P1 = a)**: `stage1.ts` + `stage1.test.ts` (+ fixture); po 1d, te same pliki.
  Albo **2a' [orkiestrator] (P1 = b)**: `docs/architecture/known-limitations.md`.
- [ ] **2b [frontend] U12 + U13**: `src/i18n/locales/en.json`, `pl.json` (+ test, jeśli sprawdza tekst zgody)
- [ ] **2c [orkiestrator] U12 + U13**: `docs/legal/privacy-policy.en.md`, `docs/legal/privacy-policy.pl.md` (równolegle z 2b)

### Fala 3 (koniec)
- [ ] verifier całej gałęzi + CodeRabbit, `pnpm test` / `typecheck` / `lint` zielone, merge do
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
