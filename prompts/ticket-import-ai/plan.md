# Zadanie: Import biletu (kaskada: parser bez AI → Gemini) + skan kodu aparatem
Status: w trakcie

## Zrozumienie i założenia
Na kroku „Loty” kreatora (`/trips/new`) jest dziś wyłączony przycisk „Wyślij bilet · wkrótce” (`src/app/trips/new/index.tsx:142`, D2 z trip-create-wizard). Włączamy go i dajemy dwie drogi wypełnienia formularza lotów:

1. **Import pliku (PDF / zdjęcie)** — po zgodzie plik idzie do nowej Edge Function `extract-ticket`, która działa **kaskadą**:
   - **Etap 1 (bez AI, 0 zł):** kod kreskowy (`zxing-wasm` = zxing-cpp w WebAssembly; PDF417 / Aztec / QR) → parser BCBP; dla PDF dodatkowo tekst (`unpdf`) → regexy. Wynik walidowany Zod.
   - **Komplet** (D13) = dla każdego segmentu: lotniska IATA z bazy, numer lotu, data i godzina wylotu i przylotu → **koniec, Gemini nie jest wołane**.
   - **Etap 2 (Gemini):** tylko gdy etap 1 się wyłożył albo brakuje pola (np. BCBP nigdy nie ma godzin). Pola znalezione w etapie 1 są pewne: odpowiedź Gemini musi się z nimi zgadzać.
2. **Skan kodu z karty pokładowej aparatem (na telefonie, bez serwera, offline)** — `expo-camera` → ten sam parser BCBP → lotniska, numer, dzień; godziny wpisuje użytkownik.

W obu drogach **nic nie zapisuje się automatycznie**: dane trafiają do szkicu kreatora, użytkownik je sprawdza i sam przechodzi dalej.

Gotowe = obie drogi działają w kreatorze, zgoda przed wysłaniem, wyśrodkowany komunikat dla pliku, który nie jest biletem, testy + `pnpm typecheck` + `pnpm lint` zielone, dokumentacja i polityka prywatności zaktualizowane, Edge Function gotowa do deployu (deploy robi Kacper).

### Decyzje Kacpra (2026-11-19)
- D1. Formaty pliku: **PDF + zdjęcie**. Nowa zależność `expo-document-picker` — zgoda Kacpra. Zdjęcie przez istniejący `expo-image-picker`.
- D2. Zgoda **za każdym razem** przed wysłaniem (checkbox, nic nie zapamiętujemy).
- D3. Gdy w formularzu są już loty: **zastąp wszystkie** — najpierw `ConfirmDialog` „Zastąpić wpisane loty?”, gdy formularz nie jest pusty.
- D4. Limit: **5 wywołań Gemini dziennie** na użytkownika (nowy `kind` `ticket` w `ai_usage`).
- D5. Pliku **nie przechowujemy**: base64 w body, tylko w pamięci funkcji, bez Storage, bez logowania treści.
- D6. `not_a_ticket` **zwraca** jednostkę limitu `ticket`.
- D7. Osobny limit odrzuceń: **10 `not_a_ticket` dziennie** (`kind` `ticket_rejected`, bez zwrotu).
- D8. Limity pliku: PDF — magic bytes `%PDF-` + ≤ 5 MB; zdjęcie zmniejszane na telefonie (`expo-image-manipulator`, JPEG, dłuższy bok ≤ 2000 px) + magic bytes JPEG. Liczby stron nie liczymy.
- D9. **Nie** wyciągamy nazwiska pasażera ani PNR. Tylko: kierunek, numer lotu, IATA skąd/dokąd, czasy lokalne.
- D10. Skan kodu **aparatem na telefonie** (`expo-camera`, nowa zależność — zgoda Kacpra).
- D11. Hybryda „kod z aparatu + plik do AI” — odrzucona.
- D12. **Kaskada** (Kacper, „Scenariusz A”): najpierw parser bez AI, Gemini tylko przy porażce lub brakach. Etap 1 w **TypeScript w Edge Function** (`zxing-wasm` + `unpdf`, dwie nowe zależności Deno — zgoda Kacpra), nie w Pythonie; Zod zostaje jedynym źródłem prawdy (bez Pydantic).
- D13. „Komplet” = pola formularza (IATA z bazy, numer, data + godzina wylotu i przylotu). PNR nie jest wymagany (D9 bez zmian).

### Fakty sprawdzone
- `expo-camera` `CameraView` czyta na żywo `pdf417`, `aztec`, `qr` na iOS i Androidzie; `scanFromURLAsync` na iOS czyta tylko QR — dlatego kod z pliku czytamy na serwerze, nie na telefonie.
- BCBP (IATA Resolution 792) zawiera nazwisko, PNR, IATA, przewoźnika, numer lotu i **dzień roku** — bez roku i bez godzin. Karta pokładowa zawsze więc przejdzie do etapu 2 (Gemini) po godziny.

### Założenia do potwierdzenia przy akceptacji (moje propozycje)
- Z1. Zdjęcie do importu tylko **z galerii** (aparat służy skanowi kodu).
- Z2. Skan aparatem: po zeskanowaniu wybór „Wylot / Powrót” (`SegmentedControl`); odcinki z kodu (1–4) **dopisujemy** do kierunku, pusty segment zastępujemy.
- Z3. Rok dla dnia z BCBP: najbliższe wystąpienie tego dnia roku od dziś. Na telefonie w skanie: godziny puste, `DateTimeField` dostaje dzień jako `suggested`.
- Z4. Numer lotu z BCBP: przewoźnik + numer bez zer wiodących (`FR 0123` → `FR123`).
- Z5. Nazwisko i PNR z BCBP są **odrzucane w parserze** (nigdy w stanie, logach, odpowiedzi ani UI).
- Z6. Offline: import pliku wyłączony z podpowiedzią; skan aparatem działa offline.
- Z7. Etap 1 bez Gemini **nie zużywa** limitu 5/dzień (koszt 0 zł). Ochronę przed nadużyciem daje rozmiar pliku, auth i limity platformy Supabase.
- Z8. Gemini niedostępne, limit wyczerpany albo odpowiedź niezgodna z etapem 1, a etap 1 coś znalazł → zwracamy **częściowe dane** (np. lotniska + numer + dzień, godziny puste) z informacją „Uzupełnij godziny”, zamiast błędu. Nic nie znaleziono w żadnym etapie → `not_a_ticket`.
- Z9. Kierunek (wylot/powrót) w etapie 1: segmenty w kolejności z dokumentu; trasa wracająca do pierwszego lotniska wylotu = powrót, reszta = wylot. Gemini ustala kierunek tylko, gdy etap 1 nic nie dał.

## Podejście
**Etap 1 — parser (`src/lib/ticket-parse/`, czyste funkcje, wspólne z telefonem tam, gdzie się da):**
1. Plik sprawdzony na telefonie i w funkcji: typ, magic bytes, rozmiar → `unsupported_file` / `file_too_large` bez żadnego parsowania.
2. Kod kreskowy: zdjęcie → `zxing-wasm` (`readBarcodes`, formaty PDF417/Aztec/QR). PDF → obrazy osadzone na stronach (przez `unpdf`/pdf.js) → `zxing-wasm`. **Wykonalność odczytu obrazów z PDF w Deno sprawdzę na początku kroku 4**; jeśli się nie da bez renderera stron, PDF idzie tylko ścieżką tekstu (wrócę z tym do Kacpra).
3. `parseBcbp(text, today)` → odcinki (IATA w bazie, numer, data). Ten sam parser na telefonie w skanie aparatem.
4. PDF z warstwą tekstową → `unpdf` `extractText` → `parseTicketText` (regexy: kody IATA, numery lotów, daty i godziny w popularnych formatach, z kontekstem „Departure/Wylot/Arrival/Przylot”). Wynik łączony z BCBP (BCBP wygrywa przy konflikcie lotnisk/numeru/dnia).
5. Walidacja Zod (`ParsedTicketSchema`) + `isComplete` (D13). Komplet → 200, `source: 'parser'`, bez limitu.

**Etap 2 — Gemini (tylko braki):**
6. Rezerwacja limitów: po jednej jednostce `ticket` (5) i `ticket_rejected` (10) przez istniejące `consume_ai_quota`; brak → (Z8) częściowe dane, a bez danych 429 `limit_reached`.
7. Gemini dostaje dokument jako `inlineData` + stały `systemInstruction` (`src/lib/ticket-prompt.ts`): dokument niezaufany, instrukcje w nim ignorować, zwrócić segmenty albo `isTicket: false`. Pola z etapu 1 idą jako JSON w treści użytkownika („te pola są pewne, uzupełnij brakujące”). Bez `tools`, `thinkingLevel: 'low'`, timeout 30 s.
8. `responseJsonSchema` z Zod (`GeminiTicketSchema`) — **bez wolnych pól tekstowych** (enum, IATA `^[A-Z]{3}$`, numer wzorcem, czasy `YYYY-MM-DDTHH:mm`).
9. `validateTicket(gemini, parsed, airports, today)`: IATA w bazie, zakres dat (dziś − 1 rok … + 2 lata), przylot po wylocie w strefach lotnisk, `from ≠ to`, 1–8 segmentów, **zgodność z polami etapu 1** (lotniska, numer, dzień). Wynik: bilet → zwrot `ticket_rejected`, `source: 'ai'`; `isTicket:false`/nic → `not_a_ticket` 422 + zwrot `ticket` (D6); niezgodność z etapem 1 → Z8; awaria Gemini → zwrot obu + Z8 albo 502.
10. Auth jak w innych funkcjach (JWT, POST only, `verify_jwt` on), logi tylko nazwy zdarzeń i etap (`parser_complete`, `parser_partial`, `gemini_used`, `not_a_ticket`) — nigdy plik, tekst PDF, kod BCBP, prompt ani odpowiedź modelu.

**Ostatnia linia obrony:** użytkownik zawsze widzi dane w formularzu przed zapisem; snackbar „Sprawdź dane z biletu” (albo „Uzupełnij godziny”, gdy częściowe).

**Odrzucone:** serwis w Pythonie (`zxing-cpp`/`pymupdf`/Pydantic) — nowa infrastruktura poza Supabase, drugie źródło prawdy obok Zod, `pymupdf` na AGPL (D12).

## Struktury danych (Zod)
`src/schemas/ticket.ts` (nowy; Edge Function importuje go ścieżką względną, jak `place.ts`):
```ts
export const TICKET_MAX_BYTES = 5 * 1024 * 1024;
export const TICKET_IMPORTS_PER_DAY = 5;      // wywołania Gemini
export const TICKET_REJECTS_PER_DAY = 10;
export const MAX_TICKET_SEGMENTS = 8;
export const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/;

export const TicketMimeTypeSchema = z.enum(['application/pdf', 'image/jpeg']);
export const ExtractTicketRequestSchema = z.object({
  mimeType: TicketMimeTypeSchema,
  dataBase64: z.string().min(1).max(Math.ceil(TICKET_MAX_BYTES / 3) * 4),
});

// Segment po etapie 1 albo 2. Częściowy (Z8): brakujące pola = null.
export const TicketSegmentSchema = z.object({
  direction: z.enum(['outbound', 'return']),
  fromIata: IataCodeSchema,
  toIata: IataCodeSchema,
  flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN).nullable(),
  flightDate: IsoDateSchema.nullable(),          // dzień (z BCBP / tekstu), gdy brak godzin
  departAt: LocalDateTimeSchema.nullable(),      // czas lokalny lotniska, jak w formularzu
  arriveAt: LocalDateTimeSchema.nullable(),
});
export const ParsedTicketSchema = z.object({ segments: z.array(TicketSegmentSchema).max(MAX_TICKET_SEGMENTS) });

// Gemini: brak wolnych pól tekstowych; z.toJSONSchema → responseJsonSchema.
const LocalTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const GeminiTicketSchema = z.object({
  isTicket: z.boolean(),
  segments: z.array(z.object({
    direction: z.enum(['outbound', 'return']),
    flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN).nullable(),
    fromIata: z.string().regex(/^[A-Z]{3}$/),
    toIata: z.string().regex(/^[A-Z]{3}$/),
    departLocal: LocalTime,
    arriveLocal: LocalTime,
  })).max(MAX_TICKET_SEGMENTS),
});

export const ExtractTicketResponseSchema = z.object({
  segments: z.array(TicketSegmentSchema).min(1).max(MAX_TICKET_SEGMENTS),
  source: z.enum(['parser', 'ai']),
  complete: z.boolean(),                          // false = Z8, „Uzupełnij godziny”
  remainingToday: z.number().int().nonnegative(),
});
export const ExtractTicketErrorSchema = z.object({
  error: z.enum(['invalid_input', 'unauthorized', 'unsupported_file', 'file_too_large',
                 'limit_reached', 'not_a_ticket', 'upstream_failed']),
});

// Skan aparatem / BCBP. Bez nazwiska i PNR (Z5).
export const BoardingPassLegSchema = z.object({
  fromIata: IataCodeSchema, toIata: IataCodeSchema,
  flightNumber: z.string().regex(FLIGHT_NUMBER_PATTERN),
  flightDate: IsoDateSchema,
});
export const BoardingPassSchema = z.object({ legs: z.array(BoardingPassLegSchema).min(1).max(4) });
```
Migracja (bez nowych kolumn): `supabase/migrations/<ts>_ticket_quota.sql` — check `ai_usage.kind in ('places','trip_plan','ticket','ticket_rejected')`. `kind` to `text`, więc `database.types.ts` bez zmian (sprawdzę `pnpm db:types`).

## Testy (najpierw, każdy krok red → green)
- **Schematy** (`src/schemas/__tests__/ticket.test.ts`): mime, za długi base64, wzorce IATA/numeru/czasu, > 8 segmentów; strażnik: `toJSONSchema(GeminiTicketSchema)` nie ma pola `string` bez `pattern`/`enum`.
- **`sniffTicketFile`**: `%PDF-` ok; inny początek → `unsupported_file`; JPEG `FF D8 FF` ok; PNG jako JPEG → błąd; > 5 MB → `file_too_large`; pusty → błąd.
- **`parseBcbp`**: przykłady z IATA 792 (1 i 2 odcinki); `0123` → `FR123`; dzień roku → najbliższa data (przełom roku, rok przestępny); nieznane IATA / zły format → `null`; wynik bez nazwiska i PNR.
- **`parseTicketText`**: fikstury tekstu (zanonimizowane) → segmenty; tekst bez lotów → pusto; tekst z „ignore previous instructions” → pusto; konflikt z BCBP → BCBP wygrywa.
- **`isComplete`**, **łączenie etapów**, **`validateTicket`**: braki → niekomplet; Gemini niezgodne z etapem 1 → odrzucone; `isTicket:false`; zakres dat; przylot przed wylotem; 30 lutego; zły numer → `null`.
- **`ticket-prompt`**: zawiera zasadę ignorowania instrukcji z dokumentu, nie zawiera danych użytkownika.
- **SQL** (`supabase/tests/ai_usage.sql`): nowe `kind` przyjmowane, nieznane odrzucane; liczniki osobne.
- **Edge Function** (`supabase/functions/extract-ticket/__tests__/handler.test.ts`, fakes dla zxing/unpdf/Gemini/RPC): 405; 401; 400; 415 / 413 bez parsowania i limitu; **komplet z etapu 1 → 200 `source:'parser'`, Gemini NIE wołane, limit NIE zużyty**; BCBP bez godzin → Gemini dostaje pola pewne, wynik zgodny → 200 `source:'ai'` + zwrot `ticket_rejected`; Gemini niezgodne → częściowe dane `complete:false`; limit wyczerpany + częściowe dane → 200 `complete:false`; limit wyczerpany bez danych → 429; `isTicket:false` → 422 + zwrot `ticket`; awaria Gemini → zwrot obu + częściowe albo 502; żądanie do Gemini ma `systemInstruction`, `inlineData`, `responseJsonSchema`, **brak `tools`**; logi bez base64, tekstu PDF, BCBP i odpowiedzi modelu.
- **Adaptery** (`ports.ts`): odczyt kodu z prawdziwego JPEG z fikstury (PDF417 i Aztec) przez `zxing-wasm`; tekst z prawdziwego małego PDF przez `unpdf` — fikstury wygenerowane przez nas, bez danych osobowych.
- **Warstwa danych** (`src/data/__tests__/ticket-import.test.ts`): mapowanie odpowiedzi i błędów na klasy; zła odpowiedź serwera → błąd; timeout 45 s dla `extract-ticket`.
- **Szkic** (`draft.test.ts`): `draftFromTicket` (pełne i częściowe segmenty → `SegmentDraft`, strefy z `airports.json`, `suggested` dzień przy brakach); `withBoardingPass` (Z2, Z3).
- **UI** (`flights.test.tsx` + komponenty): przycisk online/offline; arkusz: PDF/zdjęcie, „Wyślij” nieaktywne bez checkboxa, link do `/legal/privacy`; ładowanie; sukces wypełnia formularz + właściwy snackbar (komplet / „Uzupełnij godziny”); niepusty formularz → `ConfirmDialog`; `not_a_ticket` → wyśrodkowany komunikat (testID `ticket-not-a-ticket`); limit/inne błędy; skan: odmowa uprawnień, kod → kierunek → wpis, nierozpoznany kod. `Checkbox`: `role="checkbox"`, `checked`.

## Pliki
- Nowe: `src/schemas/ticket.ts`; `src/lib/ticket-parse/{sniff,bcbp,text,merge,validate}.ts`; `src/lib/ticket-prompt.ts`; `supabase/migrations/<ts>_ticket_quota.sql`; `supabase/functions/extract-ticket/{handler,ports,index}.ts` + `deno.json` (`npm:zxing-wasm`, `npm:unpdf`, wersje przypięte) + `__tests__/` + fikstury; `src/data/ticket-import.ts`; fake w `src/test/`; `src/hooks/useExtractTicket.ts`; `src/features/trip-create/{ticket-pick.ts,TicketImportSheet.tsx,BoardingPassScanner.tsx}`; `src/components/Checkbox.tsx` + testy.
- Zmieniane: `src/schemas/index.ts`, `src/data/fetch-timeout.ts`, `src/features/trip-create/draft.ts`, `src/app/trips/new/index.tsx`, `src/i18n/locales/{pl,en}.json`, `supabase/tests/ai_usage.sql`, `supabase/functions/.env.example` (bez nowych sekretów), `package.json` / `app.json` (`expo-document-picker`, `expo-camera` + opis uprawnienia aparatu), `docs/legal/*.md`, `docs/architecture/{overview,backend,frontend,shared,decisions,known-limitations}.md`, `flows/features/trip-create.md` + nowy `flows/features/ticket-import.md`.
- Zależności Jest (Kacper, 2026-11-20): `zxing-wasm@3.1.7` i `unpdf@2.1.0` idą też do `devDependencies` — testy adapterów na prawdziwych fiksturach w `pnpm test`.

## Skille
- `security-and-hardening` — kroki 1, 4 — niezaufany plik, prompt injection, nowe zależności.
- `supabase`, `supabase-postgres-best-practices` — kroki 3, 4.
- `source-driven-development` — kroki 4, 6, 8 — `zxing-wasm`, `unpdf`, Gemini `inlineData`/`responseJsonSchema`, `expo-document-picker`, `expo-camera`.
- `doubt-driven-development` — krok 4.
- `test-driven-development`, `incremental-implementation` — wszystkie kroki z kodem.
- `frontend-design`, `frontend-ui-engineering` — kroki 7, 8.

## Kroki
Gałąź: `feature/ticket-import-ai`, commit po każdym kroku.
- [x] 1. [backend] Zod `ticket.ts` + `sniff.ts` + `bcbp.ts` — najpierw testy schematów, sniff, BCBP — weryfikacja: verifier.
- [x] 2. [backend] `text.ts` (regexy), `merge.ts` (łączenie + `isComplete`), `validate.ts`, `ticket-prompt.ts` — najpierw testy — weryfikacja: verifier.
- [x] 3. [backend] Migracja `ticket_quota` + test SQL (równolegle z 2) — weryfikacja: `pnpm test:db`, verifier.
- [x] 4. [backend] Edge Function `extract-ticket`: najpierw spike wykonalności (zxing-wasm + unpdf w Deno, kod z obrazu w PDF) → handler + ports + index, bez deployu — najpierw testy handlera i adapterów — weryfikacja: verifier.
- [x] 5. [backend] Warstwa danych `ticket-import.ts` + fake + timeout 45 s (równolegle z 4) — weryfikacja: verifier.
- [x] 6. [frontend] Zależności `expo-document-picker`, `expo-camera` (`pnpm expo install`), uprawnienie aparatu; `ticket-pick.ts` + `useExtractTicket` — najpierw testy — weryfikacja: verifier.
- [x] 7. [frontend] `draftFromTicket` / `withBoardingPass` + `Checkbox` (równolegle z 6) — najpierw testy — weryfikacja: verifier.
- [x] 8. [frontend] UI: arkusz („Wczytaj z pliku” / „Zeskanuj kartę pokładową”), zgoda, ładowanie, wyśrodkowany `not_a_ticket`, częściowe dane, błędy, `ConfirmDialog`, snackbar, skaner + kierunek, offline; i18n pl/en — najpierw testy UI — weryfikacja: verifier + `ui-taste`.
- [x] 9. [frontend + orchestrator] Polityka prywatności i regulamin (i18n przez frontend, `docs/legal/*.md` przez orchestratora) — weryfikacja: test `legal`, verifier.
- [ ] 10. [orchestrator] Docs architektury, CVE audit (4 nowe zależności), tester na urządzeniu, verifier końcowy (cała gałąź + CodeRabbit). Deploy funkcji i migracji — Kacper.

Kolejność: 1 → (2 ‖ 3) → (4 ‖ 5) → (6 ‖ 7 ‖ 9-i18n) → 8 → 10.

### Proponowane teksty (do akceptacji)
- Przycisk: „Wczytaj bilet” / „Import ticket”.
- Zgoda (PL): „Plik zostanie odczytany na naszym serwerze, a jeśli to będzie potrzebne — przeanalizowany przez AI (Google Gemini). Nie zapisujemy go. Odpowiadasz za to, co przesyłasz — wgrywaj tylko swój bilet albo bilet osoby, która się na to zgodziła. Po odczytaniu sprawdź dane przed zapisaniem podróży.” Checkbox: „Rozumiem i akceptuję Politykę prywatności” (link). Przycisk: „Wyślij”.
- Zgoda (EN): „The file will be read on our server and, if needed, analysed by AI (Google Gemini). We don't store it. You're responsible for what you upload — only upload your own ticket or one you have permission to share. Check the details before saving the trip.” / „I understand and accept the Privacy Policy” / „Send”.
- Nie-bilet (wyśrodkowany): „To nie wygląda na bilet lotniczy” / „Nie znaleźliśmy w pliku danych lotu. Wgraj PDF lub zdjęcie biletu albo karty pokładowej. Ta próba nie wlicza się do dziennego limitu.” / „Wybierz inny plik”.
- Snackbar: komplet — „Wpisaliśmy loty z biletu. Sprawdź je przed dalszym krokiem.”; częściowe — „Wpisaliśmy lotniska i numery lotów. Uzupełnij godziny.”
- Polityka prywatności, nowy punkt „Import biletu”: plik (PDF/zdjęcie biletu) trafia na nasz serwer, gdzie jest odczytywany automatycznie; tylko gdy to nie wystarczy, trafia do Google Gemini API (płatna wersja, bez trenowania) wyłącznie w celu odczytania danych lotu; nie przechowujemy pliku; aplikacja dostaje tylko lotniska, numery lotów, daty i godziny; podstawa: art. 6 ust. 1 lit. b. Skan kodu aparatem odbywa się wyłącznie na telefonie. Regulamin: limit 5 analiz AI dziennie.

## Weryfikacja
Każdy krok: red → green, pełny suite + `pnpm typecheck` + `pnpm lint`, verifier PASS → `[x]`. Ręcznie (tester): e-bilet PDF z warstwą tekstową → komplet bez AI (log `parser_complete`); zdjęcie karty pokładowej → lotniska z kodu + godziny z AI; PDF z „ignore previous instructions…” → wyśrodkowany komunikat; `.txt` przemianowany na `.pdf` → błąd pliku; skan karty z ekranu drugiego telefonu → lotniska + numer + dzień; tryb samolotowy → import wyłączony, skan działa.

## Dziennik postępu
- 2026-11-19: plan zaakceptowany przez Kacpra („Akceptuję”), razem z Z1–Z9 i tekstami. O1: brak próbek — zaczynamy od ogólnych wzorców, niepewne przypadki idą do Gemini; próbki można dosłać później.
- Krok 1: testy napisane (red ✓ — „Cannot find module” dla `ticket`, `sniff`, `bcbp`) · `src/schemas/ticket.ts` (+ re-eksport w `index.ts`), `src/lib/ticket-parse/sniff.ts`, `bcbp.ts` + 3 pliki testów · green ✓ (223 suites, 4407 testów), typecheck ✓, lint ✓ · verifier: 1. FAIL (strażnik „brak wolnego tekstu” nie łapał `type: ["string","null"]`) → poprawka testu (`freeTextStrings` + test kontrolny) → PASS · skill: test-driven-development, security-and-hardening · odstępstwa: dzień 366 z BCBP → najbliższy 31 XII roku przestępnego; `atob` w Hermes do sprawdzenia przy kroku na telefonie.
- Krok 3 (równolegle z krokiem 1): testy SQL w `supabase/tests/ai_usage.sql` (red ✓ — `violates check constraint "ai_usage_kind_check"` dla `ticket`) · nowa migracja `20261119120000_ticket_quota.sql` (tylko wymiana checka `kind` na 4 wartości) · green ✓ na lokalnym Supabase (Docker uruchomił Kacper); `pnpm db:types` bez zmian treści; suite/typecheck/lint ✓ · verifier PASS (sam powtórzył red w wycofanej transakcji; RLS/granty bez zmian) · skill: supabase-postgres-best-practices, test-driven-development · odstępstwa: `pnpm test:db` nie działa na tej maszynie (brak `DB_URL` i `psql`), testy SQL uruchamiane przez `docker exec … psql -f -`; migracja niewdrożona na hostowany projekt (Kacper).
- Krok 5 (przed krokiem 4 — zależy tylko od schematów z kroku 1): testy napisane (red ✓ — brak `@/data/ticket-import`; `EXTRACT_TICKET_TIMEOUT_MS` undefined) · `src/data/ticket-import.ts` (`extractTicket`, `NotATicketError`, `TicketLimitError`, `UnsupportedTicketFileError`, `TicketImportError` `unauthorized | failed`; brak połączenia / timeout → `ServerUnreachableError`), `fetch-timeout.ts` (`/functions/v1/extract-ticket` 45 s) + testy · green ✓ (228 suites, 4473), typecheck ✓, lint ✓ · verifier PASS · skill: test-driven-development, api-and-interface-design · odstępstwa: bez nowego fake'a (wystarczył istniejący `fakeSupabase().invoke`); wzorzec błędów jak w repozytoriach (`ServerUnreachableError`), nie `kind` jak w `places.ts` — verifier uznał za spójne.
- 2026-11-20: porządki w planie (Z1–Z9 potwierdzone). Spike kroku 4 (Deno 2.9, `unpdf@2.1.0`, `zxing-wasm@3.1.6`; pliki spike'u przeniesione poza repo, do notatek sesji): (a) `extractText` czyta tekst PDF ✓ (~0,4 s z inicjalizacją); (b) `readBarcodes` czyta PDF417 i Aztec ✓ (obraz 2000×1500: 0,1–0,2 s); (c) `extractImages` wyciąga obraz osadzony w PDF **bez renderera** ✓ → kod z obrazu w PDF działa. Ograniczenie: kod narysowany wektorowo (nie obraz) nie zostanie odczytany → ścieżka tekstu / Gemini. R2: limity Supabase 256 MB RAM, **2 s CPU**/żądanie, 20 MB po bundlu — pomiary mieszczą się. R3: docs Supabase nie podają limitu body; 6,7 MB base64 do sprawdzenia testerem po deployu. R4: Gemini przyjmuje inline PDF (`application/pdf`) i JPEG; limit całego żądania 20 MB ✓. **Znalezisko:** `zxing-wasm` domyślnie pobiera `.wasm` z jsDelivr — Kacper: wasm dołączony do funkcji i ładowany lokalnie (`prepareZXingModule({ overrides: { wasmBinary } })`, sprawdzone z `--deny-net`). Kacper: `zxing-wasm`/`unpdf` także w `devDependencies` (Jest).
- Krok 2: `text.ts`, `merge.ts`, `validate.ts`, `ticket-prompt.ts` + testy (napisane w poprzedniej sesji; red-run nieudokumentowany — kolejność mtime test→kod tylko dla `ticket-prompt`) · testy kroku ✓ (75) · verifier PASS (`ff33ea5`) · uwagi przeniesione do kroku 4: test wstrzyknięcia z trasą w tekście, test 1–8 segmentów w `validateTicket`, test braku nazwiska/PNR w `parseTicketText`, nieużywany `_today` w `text.ts:116`, `validateParsed` bez wywołań (użyć w handlerze albo usunąć), `!` w `validate.ts:32`.
- Kroki 6 i 7: verifier FAIL (6: lint `react/display-name` w teście hooka + kopia biletu w cache wbrew D5; 7: testy `Checkbox` czerwone — goły string w `View`) → poprawki zlecone frontendowi.
- Krok 6 (po poprawce): nazwany `Wrapper` w teście hooka; `discard(uri)` usuwa kopię PDF z cache (`finally`) i zapisany JPEG po sniff — nigdy oryginału z galerii (D5); testy usuwania red ✓ (5) → green · suite ✓ (231 suites, 4516), typecheck ✓, lint ✓ · verifier PASS · uwaga: brak testu, że błąd `delete()` nie zasłania wyniku (try/catch poprawny w kodzie).
- Krok 7 (po poprawce): `Checkbox` owija etykietę-string w `Text` z tokenów (red ✓ „Text strings must be rendered within a <Text>” → green); test `flightDate: null` bez godzin → brak `suggestedDate` · suite ✓ (233 suites, 4545), typecheck ✓, lint ✓ · verifier PASS · uwagi: `borderWidth: 1` na sztywno w `Checkbox.tsx:40-41`, brak testu braku znacznika przy odznaczonym.
- Krok 4, faza A: `handler.ts` (porty wstrzykiwane), `ports.ts` (Gemini fetch + RPC limitów), `index.ts`, `deno.json`, testy handlera (20) i portów — red ✓ → green; poprawki z kroku 2 (bez `_today`, bez `!`, 1–8 segmentów, test wstrzyknięcia z trasą, test bez nazwiska/PNR; `validateParsed` użyty w etapie 1) · suite ✓ (233/4545). Decyzje Kacpra (2026-11-20): `remainingToday` przy wyniku z parsera = **prawdziwy stan** licznika (odczyt bez zużycia); gdy Gemini mówi „nie bilet”, a etap 1 coś znalazł → częściowe dane, jednostka `ticket` **nie wraca** (Gemini było opłacone).
- Krok 9: `docs/legal/*` (orchestrator) + `legal.*` w i18n (frontend): wersja 20 XI 2026, pkt 2.8 „Import biletu lotniczego”, wiersz w tabeli celów, Gemini w pkt 4, regulamin pkt 6.6 · test `legal` red ✓ → green · verifier 1. FAIL (akapit „nie używamy reklam…” wylądował pod 2.8) → przeniesiony na koniec 2.7 + test położenia → PASS (porównanie md↔i18n: 0 różnic).
- Krok 4, faza B: `stage1.ts` (`zxing-wasm` z lokalnym `zxing_reader.wasm` przez `static_files` w `config.toml`, `unpdf`; limity 3 strony / 6 obrazów — 2 s CPU), port `readQuota`; testy adapterów w procesie Node (`test-support/stage1-driver.mjs`), bo Jest nie ładuje ESM-only `unpdf` · fikstury bez danych osobowych · verifier FAIL: (a) tekst PDF z wszystkich stron mimo limitu, (b) `remainingToday` po zwrotach źle, + drobne → poprawki. Orchestrator: zwrot `ticket_rejected`, gdy Gemini „nie bilet”, a etap 1 coś znalazł — **zostaje** (licznik odrzuceń liczy tylko odpowiedzi `not_a_ticket`, pkt 9 Podejścia). Docs Supabase: `static_files` wymaga CLI ≥ 2.7.0 i deployu przez Docker CLI (nie `--use-api`).
- Krok 4 (po poprawkach): tekst PDF tylko z pierwszych 3 stron (fikstura z lotem na str. 4), `remainingAfter` czyta prawdziwy licznik po zwrotach, nieudane ładowanie wasm nie jest cache'owane, mocniejsze testy · suite ✓ (236/4581), typecheck ✓, lint ✓, `deno check` ✓ · verifier PASS · uwagi: przy wyjątku z `consume_ai_quota` częściowy wynik ma `remainingToday: 0`; cap obrazów (6) przypięty tylko stałą; do sprawdzenia przy deployu: bundlowanie importów `../../../src`, odczyt wasm ze `static_files`, model Gemini (R4).
- Krok 8: `TicketImportSheet.tsx`, `BoardingPassScanner.tsx`, przycisk w `trips/new/index.tsx`, i18n `newTrip.flights.import.*` + testy (red ✓ → green; suite 236/4579). Kacper (2026-11-20): akceptuje dopisane teksty (błędy, skaner, dialog, ładowanie) z neutralnym PL „Loty z biletu zastąpią loty wpisane w obu kierunkach.”; zostaje przełącznik PDF/Zdjęcie nad „Wyślij”.
- Krok 8 (po poprawkach): zgoda czyszczona po „Wybierz inny plik” / „Spróbuj ponownie” (D2), skaner bierze lokalną datę (`deviceToday`), cofnięty zbędny reflow, wskaźnik ładowania aparatu z etykietą, arkusz nie zamyka się w trakcie wysyłki · red ✓ → green · suite ✓ (236/4586), typecheck ✓, lint ✓ · verifier 1. FAIL (D2) → PASS (`e1e4637`) · nowy tekst do akceptacji: `cameraLoading` „Ładowanie aparatu” / „Loading the camera” · `ui-taste` niedostępny w tej sesji — pominięty. Dodatkowo `.gitattributes` (`*.pdf`, `*.wasm` binary — fikstury bez konwersji końców linii, `59c69ba`).
- Krok 10 (w toku): docs architektury zaktualizowane (overview, backend, shared, frontend, decisions, known-limitations, flows README + `trip-create.md` + nowy `ticket-import.md`); audyt CVE (pełny): **CLEAN** — znaleziska tylko w narzędziach dev/build (node-forge, glob, minimatch przez `@expo/cli`/jest), nowe zależności bez advisories, pdf.js 6.4.299 w `unpdf` poza zakresem CVE-2024-4367 · verifier końcowy (Sonnet 5.5 + CodeRabbit, 76 plików): **PASS**; drobne uwagi CodeRabbit dopisane do `known-limitations.md` · tester: zablokowany (brak Expo Go na emulatorze) — Kacper instaluje.
- Krok 10, tester (2026-11-20): Expo Go 58.0.5 jest już na `Pixel_10a`; zależności bez zmian od audytu CVE (bez powtórki). `extract-ticket` i migracja limitu niewdrożone na hostowany projekt → scenariusze PDF / zdjęcie / injection czekają na deploy (Kacper). Częściowy test (Kacper: „Częściowy test teraz”) — Metro z worktree na 8082 + Expo Go: aplikacja nie startuje, `Cannot find native module 'ExpoSQLite'` / `'ExpoCrypto'` (już w `src/app/_layout.tsx`, niezwiązane z importem biletu). Test w Expo Go niemożliwy; potrzebny development build z tej gałęzi (expo-camera, document picker). Emulator zwolniony dla sesji „Wykres wydatków”.
- Krok 10, tester na development buildzie (2026-11-20, Kacper: „Tak, build EAS”): do gałęzi dodana konfiguracja EAS (`eas.json`, `app.json` `extra.eas`/`owner`/`android.package` — ta sama co `e5066e1` na `feature/trip-spend-chart`, commit `340668a`); build EAS `development` (APK debug) z Metro z worktree. Wyniki: `.txt` przemianowany na `.pdf` → „This file isn't supported…” + „Try again”, zgoda czyszczona ✓ · tryb samolotowy → baner offline, „Import from a file” wyłączony, skan dostępny ✓ · zdjęcie (prawdziwy e-bilet EaseMyTrip, PNG) przyjęte i wysłane bez awarii ✓ (serwer: ogólny błąd „We couldn't read the ticket…”, bo funkcja niewdrożona) · PDF `text.pdf` → ten sam ogólny błąd (obserwacja). **FAIL skanera:** w manifeście brak `android.permission.CAMERA` — `expo-image-picker` z `cameraPermission: false` (z `29191f7`) dodawał CAMERA do zablokowanych uprawnień. Poprawka (frontend, test-first w `src/__tests__/app-config.test.ts`, red ✓ → green; suite 236/4588, typecheck ✓, lint ✓): ten sam tekst aparatu co w `expo-camera` · verifier PASS (sprawdził też manifest przez mody wtyczek: stary config → CAMERA `tools:node="remove"`, nowy → CAMERA obecne, RECORD_AUDIO dalej zablokowane) · commit `7de19f3`. Retest na nowym buildzie: dialog uprawnień → widok aparatu ✓, w trybie samolotowym skan otwiera aparat ✓ (wcześniej trzeba było usunąć z emulatora `expo.modules.permissions.asked.xml` — pozostałość po starym buildzie). Niesprawdzone: wskaźnik „Loading the camera” (zbyt krótki), prawdziwy odczyt kodu (kamera emulatora), polskie teksty. Uwaga testera do decyzji Kacpra: arkusz pokazuje „Reading your ticket…” już przy otwartym systemowym wyborze pliku (`setBusy(true)` przed pickerem). Czekają na deploy (Kacper): PDF z warstwą tekstu → komplet bez AI, zdjęcie karty → godziny z AI, PDF z injection → wyśrodkowany komunikat; skan ekranu drugiego telefonu — na fizycznym telefonie.
- O1 (2026-11-20): pierwsza prawdziwa próbka od Kacpra — zrzut e-biletu EaseMyTrip (PNG, bez warstwy tekstu → etap AI). Układ (bez danych pasażera): nagłówek „Delhi 16:05 / Thu-02May2019 / Terminal 3” → „Bangalore 18:50 / Thu-02May2019 / Terminal”, czas „2h 45m”; linia lotnicza i numer pod logo („Vistara”, „UK-817” — kod z myślnikiem); tabela pasażerów z kolumnami Airline „UK”, Sector „DEL-BLR” (kody IATA tylko tu, w nagłówku nazwy miast), AirLine PNR (6 znaków); data w formacie `Thu-02May2019`, godziny 24 h lokalne. Do regexów: numer lotu `[A-Z0-9]{2}-?\d{1,4}`, sektor `[A-Z]{3}-[A-Z]{3}`, data `\w{3}-\d{2}[A-Za-z]{3}\d{4}`. Wynik importu na serwerze — po deployu.

## Ryzyka i otwarte pytania
- O1. **Regexy wymagają prawdziwych przykładów.** Formaty e-biletów różnią się między przewoźnikami; bez próbek regexy to zgadywanie. Prośba: 2–3 zanonimizowane PDF-y (np. Ryanair, Wizz Air, LOT) albo zgoda, żebym zaczął od ogólnych wzorców, a niepewne przypadki szły do Gemini.
- R1. Odczyt kodu z obrazów osadzonych w PDF w Deno — niepewny; spike na początku kroku 4.
- R2. Rozmiar/czas: `zxing-wasm` (~1 MB wasm) i `unpdf` w Edge Function — limity pamięci/CPU Supabase do sprawdzenia w spike'u.
- R3. Limit body Edge Function (base64 5 MB ≈ 6,7 MB) — do sprawdzenia w docs Supabase w kroku 4.
- R4. Model Gemini z `GEMINI_MODEL` musi czytać PDF/obrazy — do potwierdzenia w docs `@google/genai`.
- R5. Rok w BCBP wyliczany heurystycznie (Z3).
- R6. Prompt injection może podmienić wartości tam, gdzie etap 1 nic nie dał; chronią wąskie pola, walidacja i przegląd przez użytkownika.
- Z1–Z9, O1 i teksty — potwierdzone przez Kacpra 2026-11-19 (zob. dziennik).
