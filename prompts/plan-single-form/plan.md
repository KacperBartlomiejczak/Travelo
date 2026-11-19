# Zadanie: Plan AI — jeden formularz zamiast kart, wyśrodkowane ekrany
Status: w realizacji (zaakceptowany 2026-11-19)

## Zrozumienie i założenia
Kacper chce dwóch zmian w tworzeniu planu AI (zakładka Plan → „Plan” → „Zaplanuj z AI”):
1. **Jeden ekran zamiast kart.** `PlanWizard` (`src/features/plan/PlanWizard.tsx`) pokazuje dziś 3–4 karty po kolei (`StepIndicator` „Krok 2 z 4”, przyciski „Dalej” / „Wstecz”, slajd `SlideInRight`/`SlideOutLeft`, crossfade przy reduced motion). Po zmianie wszystkie pytania są w jednym przewijanym formularzu, bez kroków, bez animacji przejść.
2. **Wyśrodkowanie** formularza i ekranu generowania (`PlanGenerating`) na ekranie.

**Gotowe gdy:** formularz i generowanie działają jak niżej, testy `PlanWizard` / `PlanGenerating` / `PlanSide` przepisane i zielone, `pnpm test` / `pnpm typecheck` / `pnpm lint` zielone, verifier PASS, docs zaktualizowane.

### Decyzje (Kacper, 2026-11-19)
- **D1 — Kolejność sekcji jak dotąd:** „Gdzie zwiedzamy?” → „W jakim promieniu szukać?” (tylko przy „Też inne miasta”; pojawia się/znika od razu, bez animacji) → własne miasta → „Jaki plan?” (chipy). Na dole „Ułóż plan” i „Anuluj”.
- **D2 — Wyśrodkowanie = pion + tekst:** cały blok na środku ekranu w pionie; tytuły, podpowiedzi, rzędy chipów i miast wyśrodkowane w poziomie. Gdy treść się nie mieści (np. z klawiaturą), przewija się od góry.
- **D4 — Akceptacja (2026-11-19):** plan zaakceptowany razem z Z1–Z5 („Akceptuję”).
- **D3 — Ekran ładowania = tylko generowanie** (`PlanGenerating`: tytuł, komunikat, pasek). Szkielet wczytywania i pusty stan bez zmian.

### Założenia (do potwierdzenia akceptacją)
- **Z1 — `StepIndicator` i `Stepper` zostają.** `StepIndicator` nadal używa kreator tworzenia podróży (`src/features/trip-create/WizardScreen.tsx`); `Stepper` to licznik −/+ (`src/app/trips/new/index.tsx`), niezwiązany z planem. Nic do usuwania.
- **Z2 — Walidacja bez zmian.** Kroki nie miały własnej walidacji; jedyny błąd to „To miasto jest już w planie” przy polu miasta (znika przy pisaniu). Żądanie dalej parsuje `GenerateTripPlanRequestSchema` przy „Ułóż plan”. Promień wybrany przed przełączeniem na „Tylko <miasto>” jest ignorowany (wysyłamy `city_only`) — jak dziś.
- **Z3 — Systemowe Wstecz (D24 z ai-trip-plan) = „Anuluj”:** zamyka formularz (nie ma już poprzedniej karty).
- **Z4 — Tytuły kart zostają jako nagłówki sekcji** (te same klucze i18n). Usuwamy nieużywane klucze `plan.wizard.next` i `plan.wizard.back` (pl + en). Żadnej nowej kopii.
- **Z5 — Nazwa komponentu `PlanWizard` zostaje** (testID kart `plan-wizard-card-*` znikają; formularz dostaje `testID="plan-wizard"`). Zmiana nazwy to szum w diffie bez korzyści.
- Bez nowych zależności, schematów, migracji ani tokenów. Czysty frontend.

## Podejście
`PlanWizard`: usuwam stan pozycji/kierunku, efekt dwufazowy, `Animated`/`useReduceMotion`, `StepIndicator`, „Dalej”/„Wstecz”. Renderuję sekcje jedna pod drugą w jednym `ScrollView` z `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'stretch' }}` (wyśrodkowanie w pionie, przewijanie gdy za długie), tekst `textAlign: 'center'`, rzędy chipów/miast `justifyContent: 'center'`. Przyciski „Ułóż plan” / „Anuluj” na końcu formularza (w przewijanej treści, by blok był wyśrodkowany razem z nimi). Odstępy z tokenów (`spacing[6]` między sekcjami, `spacing[4]` w sekcji).
`PlanGenerating`: kontener `flex: 1, justifyContent: 'center'`, wiersz tytułu `justifyContent: 'center'`, komunikat `textAlign: 'center'`; pasek na pełną szerokość kolumny. `TripPlanSide` już daje mu `flex: 1` (`<View style={{ flex: 1 }}>{body}</View>`), więc tam bez zmian.
*Odrzucone:* przyciski przyklejone na dole ekranu — wtedy blok nie jest „cały na środku”, o co prosił Kacper (D2).

## Struktury danych (Zod)
Bez zmian. `GenerateTripPlanRequestSchema` pozostaje jedyną granicą (parsowanie przy „Ułóż plan”).

## Testy (najpierw, widziane na czerwono)
**Krok 1 — `src/features/plan/__tests__/PlanWizard.test.tsx`** (przepisany):
- wszystkie sekcje widoczne naraz: „Gdzie zwiedzamy?”, pole „Dodaj miasto”, chipy preferencji, „Ułóż plan”, „Anuluj”; brak „Dalej”, „Wstecz”, „Krok … z …”.
- „W jakim promieniu szukać?” niewidoczne przy „Tylko <miasto>”; po „Też inne miasta” widoczne od razu (bez czekania na animację) z 100 km zaznaczonym; po powrocie na „Tylko” znika.
- submit `city_only` (z miastem i chipami) i submit `nearby` z wybranym promieniem — te same oczekiwane obiekty co dziś.
- przełączenie nearby → wybór 200 km → „Tylko” → submit wysyła `city_only`.
- istniejące przypadki bez zmian treści: duplikat miasta / miasto docelowe → błąd, który znika przy pisaniu; max 2 miasta (pole znika); usuwanie miasta; chipy tempa wykluczają się.
- systemowe Wstecz wywołuje `onCancel` (zwraca `true`); listener usuwany przy odmontowaniu; brak listenera przy `backActive={false}`.
- „Anuluj” wywołuje `onCancel`.
- formularz wyśrodkowany: `contentContainerStyle` przewijania ma `justifyContent: 'center'` i `flexGrow: 1`; tytuł sekcji ma `textAlign: 'center'`.
- usunięte testy animacji kart (Slide*/Fade*) — zachowania już nie ma.

**Krok 2 — `src/features/plan/__tests__/PlanGenerating.test.tsx`** (dopisane): kontener z `testID` ma `flex: 1` i `justifyContent: 'center'`; komunikat ma `textAlign: 'center'`. Istniejące testy (zmiana komunikatów co 4 s, pasek, reduced motion) bez zmian.

**`PlanSide.test.tsx`:** poprawione tylko miejsca, które klikały „Dalej” przez karty (jeśli są) — oczekiwania co do zachowania bez zmian.

## Pliki
- `src/features/plan/PlanWizard.tsx`, `src/features/plan/PlanGenerating.tsx`
- `src/features/plan/__tests__/PlanWizard.test.tsx`, `PlanGenerating.test.tsx`, (ew.) `PlanSide.test.tsx`
- `src/i18n/locales/pl.json`, `en.json` (usunięcie `plan.wizard.next`, `plan.wizard.back`)
- docs: `docs/architecture/flows/features/ai-trip-plan.md` (sekcja „Question cards” → „Form”, „Generating” wyśrodkowane), `docs/architecture/overview.md` jeśli opis się zmienia; ten plan.

## Skille
Brak (zmiana prostego układu; TDD wg `docs/development/testing.md`).

## Kroki
- [x] 1. [frontend] `PlanWizard` jako jeden wyśrodkowany formularz (D1, D2, Z2–Z5) + usunięcie kluczy i18n `next`/`back` (`PlanSide.test.tsx` bez zmian — nie klikał „Dalej”). Verifier PASS (2026-11-19): pełny suite 4384 testy, typecheck, lint.
- [x] 2. [frontend] `PlanGenerating` wyśrodkowany (D3). Verifier PASS (2026-11-19): typecheck, lint, test PlanGenerating 10/10.
- [ ] 3. Docs (orchestrator): `ai-trip-plan.md`, `overview.md`; końcowy verifier całej gałęzi (CodeRabbit).

Kroki 1 i 2 są niezależne (różne pliki) → dwa frontend subagenty równolegle, każdy z własnym verifierem.

## Weryfikacja
Każdy krok: test na czerwono z właściwego powodu → kod → `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone → verifier PASS → `[x]` + commit na gałęzi `feature/plan-single-form`. Przed testem na urządzeniu (jeśli Kacper zechce): audyt CVE, potem tester — scenariusze: otwarcie formularza (wyśrodkowany, jasny/ciemny), przełączenie zasięgu (promień pojawia się bez animacji), dodanie miasta z klawiaturą (przewijanie), „Ułóż plan” → generowanie wyśrodkowane, systemowe Wstecz zamyka formularz.

## Ryzyka i otwarte pytania
- Długi formularz z otwartą klawiaturą: przy `justifyContent: 'center'` + `flexGrow: 1` treść dłuższa niż ekran zaczyna się od góry i przewija — sprawdzi tester.
- Wyśrodkowany `SegmentedControl` i pole miasta zostają na pełną szerokość kolumny (wyśrodkowany jest tylko tekst i rzędy chipów).
