# Zadanie: etykieta dostępności bloku błędu w Odkryj
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-28)

## Zrozumienie i założenia
- Zgłoszenie testera (emulator, 2026-11-28, gałąź `fix/plan-nearby-cities`): w Odkryj blok błędu (`testID="discover-error"`) pokazuje „Couldn't load places.”, a jego etykieta dostępności to nadal „Finding places” (etykieta bloku ładowania).
- Na `main` (8ca9223) blok błędu w `src/features/discover/DiscoverScreen.tsx:100` nie ma `accessibilityLabel`; ma go tylko blok ładowania (linia 87, `t('discover.loading')`). Hipoteza (niepotwierdzona na urządzeniu): React Native ponownie używa tego samego natywnego `View` przy przejściu ładowanie → błąd, a Android zostawia stare `contentDescription`.
- To samo zgłoszenie zawierało błąd motywu („Ciemny” → jasna paleta po odtworzeniu aktywności). Diagnoza: naprawiony już na `main` w `prompts/theme-font-scale/plan.md` (PR #43, 3c69085); gałąź testera odchodzi od `main` przed poprawką (4e9870d, 2026-11-17). Decyzja Kacpra (2026-11-28): opcja A — w tym zadaniu nic z motywem nie robimy; sesja `nearby-cities` scala `origin/main`, a jej tester sprawdza tryb samolotowy i pierwsze uruchomienie w sesji.
- Decyzja Kacpra (2026-11-28): etykieta bloku błędu = tekst błędu (`t('discover.error')`, „Couldn't load places.” / „Nie udało się wczytać miejsc.”).

## Podejście
- `accessibilityLabel={t('discover.error')}` na `View` z `testID="discover-error"`. Jawna etykieta nadpisuje każde stare `contentDescription`, więc naprawia objaw niezależnie od tego, czy hipoteza o ponownym użyciu widoku jest trafna.
- Bez `accessible` na kontenerze, żeby przycisk „Spróbuj ponownie” dalej był osobno dostępny.

## Struktury danych (Zod)
Bez zmian.

## Testy
- `src/features/discover/__tests__/DiscoverScreen.test.tsx`: po błędzie wyszukiwania `screen.getByTestId('discover-error')` ma `accessibilityLabel` równe „Nie udało się wczytać miejsc.”, a przycisk „Spróbuj ponownie” dalej znajduje się przez `getByRole('button', …)`. Najpierw czerwony (dziś etykieta jest pusta).

## Pliki
- `src/features/discover/DiscoverScreen.tsx`, `src/features/discover/__tests__/DiscoverScreen.test.tsx`.
- Docs: bez zmian (`docs/architecture/flows/features/discover-places.md` nie opisuje etykiet dostępności stanów).

## Skille
- test-driven-development — krok 1 — test czerwony przed poprawką

## Kroki
- [x] 1. [frontend] Etykieta bloku błędu w Odkryj — skill: test-driven-development — najpierw testy: z sekcji „Testy” (red ✓ z powodu braku etykiety) — weryfikacja: cały zestaw testów, `pnpm typecheck`, `pnpm lint` zielone; verifier PASS.
- [ ] 2. [orchestrator] cve-auditor (pełny audyt), potem tester na emulatorze (przed tym pytam Kacpra, czy `emulator-5554` jest wolny): Odkryj → wyszukiwanie → wyłączenie sieci w trakcie → blok błędu ma etykietę „Couldn't load places.”, „Retry” osobno dostępny; po „Retry” z siecią wyniki. Potem verifier całej gałęzi (z CodeRabbit), push, PR.

## Dziennik postępu
- Krok 1 (2026-11-28): test „labels the error block for screen readers while keeping the retry reachable” (red ✓: `Expected: "Nie udało się wczytać miejsc."`, `Received: undefined`) · `accessibilityLabel={t('discover.error')}` na `discover-error`, bez `accessible` · green ✓ (244 zestawy, 4784 testy, typecheck, lint) · verifier PASS · użyty skill: test-driven-development · odstępstwa: brak.

## Ryzyka i otwarte pytania
- TalkBack może przeczytać etykietę kontenera i potem tekst w środku (dwa razy ten sam tekst). Sprawdzi tester; jeśli tak, wracam do Kacpra.
- Jest nie odtworzy zachowania natywnego `contentDescription`; test sprawdza tylko, że etykieta jest ustawiona. Prawdziwe potwierdzenie daje tester.
