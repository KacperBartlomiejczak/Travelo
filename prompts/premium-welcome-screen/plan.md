# Zadanie: ekran „Witaj w Travelo PRO” po zakupie subskrypcji
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-26)

## Zrozumienie i założenia
Prośba Kacpra (2026-11-26): po udanym zakupie PRO użytkownik widzi ekran powitalny „Witaj w PRO”.

Stan dziś (`prompts/revenuecat/`): PRO kupuje się z banera „Przejdź na PRO” w Ustawieniach przez `RevenueCatUI.presentPaywall()` (`src/features/profile/SettingsScreen.tsx`). Z wyników paywalla obsługiwany jest tylko `PAYWALL_RESULT.ERROR` (snackbar). `PURCHASED` i `RESTORED` niczego nie robią. Uprawnienie to `PRO_ENTITLEMENT = 'travelo_pro'` (`src/lib/pro.ts`). PRO dziś niczego nie odblokowuje.

To zadanie odpowiada na P1 („dla osoby, która właśnie kupiła PRO”) i P4 (animacja) szkicu `prompts/pro-paywall-upgrade/plan.md`. P2 (limity PRO) i P3 (okno „Kup PRO” po limicie) zostają w tamtym szkicu.

Decyzje Kacpra (2026-11-26):
- **D1. Treść:** tylko podziękowanie: tytuł, jedno zdanie, przycisk. Bez listy korzyści, dopóki PRO niczego nie odblokowuje. Lista może dojść razem z P2.
- **D2. Kiedy:** tylko po `PAYWALL_RESULT.PURCHASED`, za każdym razem. Wyniki `RESTORED`, `CANCELLED`, `NOT_PRESENTED` nie pokazują ekranu. `ERROR` działa jak dziś (snackbar).
- **D3. Forma:** pełny ekran, nowa trasa `/pro-welcome` w chronionej grupie „app” głównego stosu, `headerShown: false`, `presentation: 'fullScreenModal'` (jak `/avatar`).
- **D4. Animacja:** wejście jak na `/welcome`. Grafika, tytuł, zdanie i przycisk pojawiają się z fade i przesunięciem 16dp w górę w czasie `duration.celebration` (500 ms), z odstępem 150 ms, easing wejścia (0.2, 0.8, 0.2, 1), w core `Animated`, raz po zamontowaniu. Przy ograniczonym ruchu (`useReduceMotion`, także gdy zapytanie się nie powiedzie) wszystko widać od razu. Przycisk działa od pierwszej klatki.
- **D5. Przycisk:** PL „Super!” / EN „Great!” → `router.back()` (powrót do Ustawień, gdzie widać już wiersz „Subskrypcja”). Systemowe „wstecz” robi to samo.
- **D6. Copy:** tytuł PL „Witaj w Travelo PRO” / EN „Welcome to Travelo PRO”. Zdanie PL „Dziękujemy, że wspierasz Travelo. Twoja subskrypcja jest już aktywna.” / EN „Thanks for supporting Travelo. Your subscription is now active.”

Założenia (do potwierdzenia przy akceptacji):
- **A1. Wygląd:** ekran idzie za motywem aplikacji (nie jest zawsze ciemny jak `/welcome`). Tło to `background.canvas`. Na środku jest okrągła grafika z gradientem PRO `brand.primary` → `accent.sun` (jedyny dozwolony gradient dekoracyjny, profile-upgrade D14) i ikoną `Crown` w `brand.onBrand`, jak grafika banera PRO. Grafika jest `aria-hidden`. Tytuł w Display, zdanie w Body, `PrimaryButton` w strefie kciuka z safe area. Przy dużych czcionkach ekran się przewija.
- **A2. Stany:** ekran nie ładuje danych, więc nie ma stanów loading, empty ani error. Offline: ekran działa normalnie (zakup już się odbył), bez banera.
- **A3. Kolejność:** paywall jest zamknięty, gdy `presentPaywall()` zwraca wynik, więc `router.push('/pro-welcome')` idzie od razu po wyniku. Blokada `presenting` zostaje bez zmian.

## Podejście
Tylko frontend, bez nowych zależności, bez zmian danych. Nowy komponent `ProWelcomeScreen` w `src/features/profile/` z wejściem na wzór `WelcomeScreen` (to samo `Animated`, te same tokeny ruchu) i grafiką na wzór `ProBanner`. Cienka trasa `src/app/pro-welcome.tsx`. W `SettingsScreen` handler banera rozróżnia `PURCHASED` i robi push. Dwa kroki są niezależne (różne pliki), więc mogą iść równolegle.

## Struktury danych (Zod)
Brak. Ekran nie przyjmuje parametrów ani danych z zewnątrz. Wynik paywalla to enum SDK (`PAYWALL_RESULT`), porównywany bez parsowania.

## Testy
- `src/features/profile/__tests__/ProWelcomeScreen.test.tsx`: tytuł, zdanie i przycisk w PL i EN; „Super!” woła `router.back()`; grafika ukryta dla czytnika ekranu; przy ograniczonym ruchu elementy mają od razu opacity 1; przy ruchu animacja startuje z opacity 0 (wzór z testów `WelcomeScreen`); przycisk działa przed końcem animacji.
- `src/features/profile/__tests__/SettingsScreen.test.tsx` (rozszerzenie): `PURCHASED` → `router.push('/pro-welcome')`; `RESTORED`, `CANCELLED`, `NOT_PRESENTED` → bez push; `ERROR` → snackbar jak dziś, bez push.
- Ręcznie na telefonie (tester, RevenueCat Test Store): zakup miesięczny → ekran z animacją → „Super!” → Ustawienia z wierszem „Subskrypcja”; systemowe wstecz; anulowanie paywalla → brak ekranu; ograniczony ruch → bez animacji; motyw ciemny; język EN.

## Pliki
- nowe: `src/features/profile/ProWelcomeScreen.tsx`, `src/features/profile/__tests__/ProWelcomeScreen.test.tsx`, `src/app/pro-welcome.tsx`
- zmiany: `src/app/_layout.tsx` (Stack.Screen `pro-welcome`), pliki i18n PL/EN (klucze `proWelcome.*`), `src/features/profile/SettingsScreen.tsx`, `src/features/profile/__tests__/SettingsScreen.test.tsx`
- dokumentacja (orkiestrator): `docs/architecture/frontend.md` (trasa `/pro-welcome`, Ustawienia), `context/app-context.md` (punkt 19 i drzewo tras), `prompts/pro-paywall-upgrade/plan.md` (P1 i P4 rozwiązane tutaj)

## Skille
- test-driven-development: kroki 1–2, czerwone testy przed kodem
- frontend-ui-engineering: krok 1, dostępność i ruch
- code-review: krok 3, przegląd CodeRabbit całej gałęzi

## Kroki
- [ ] 1. [frontend] `ProWelcomeScreen` + trasa `/pro-welcome` + klucze i18n PL/EN. Skill: test-driven-development, frontend-ui-engineering. Najpierw testy: `ProWelcomeScreen.test.tsx` (lista wyżej). Weryfikacja: verifier (Haiku).
- [ ] 2. [frontend] `SettingsScreen`: `PURCHASED` → `router.push('/pro-welcome')`, reszta bez zmian. Skill: test-driven-development. Najpierw testy: rozszerzenie `SettingsScreen.test.tsx`. Weryfikacja: verifier (Haiku). Może iść równolegle z krokiem 1.
- [ ] 3. Docs (orkiestrator) + verifier całej gałęzi z CodeRabbit (Sonnet 5.5) + `pnpm test`, `pnpm typecheck`, `pnpm lint` na zielono. Skill: code-review.
- [ ] 4. cve-auditor (pełny audyt), potem tester na telefonie (scenariusze wyżej). Przy EXISTS lub UNKNOWN pytam Kacpra.
- [ ] 5. PR do `main`.

## Dziennik postępu

## Ryzyka i otwarte pytania
- **R1.** RevenueCat Test Store nie był jeszcze sprawdzony na urządzeniu (`prompts/revenuecat/`), więc krok 4 może wyłapać problemy samego zakupu, nie tego ekranu.
- **R2.** Gdyby później zakup był możliwy też z okna „Kup PRO” (P3 szkicu pro-paywall-upgrade), to miejsce też powinno robić push na `/pro-welcome`. Robimy to w tamtym zadaniu.
