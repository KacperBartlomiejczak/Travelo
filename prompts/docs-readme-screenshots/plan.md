# Zadanie: Dokumentacja feature'ów, nowe README i nowe screenshoty (po angielsku)
Status: zrobione, czeka na push/PR (decyzja Kacpra)

## Zrozumienie i założenia
Prośba Kacpra (2026-11-17): (1) przejrzeć workspace explorerem (zrobione, haiku, effort high), (2) opisać każdy feature w osobnym pliku w folderze feature, (3) napisać nowe README, (4) zrobić nowe screenshoty, (5) aplikacja ma być po angielsku.

Decyzje Kacpra z tej sesji:
- **Język:** „Tylko screenshoty i README". Kod aplikacji bez zmian; screenshoty robione przy angielskim ustawionym w Ustawieniach (Język → English), README po angielsku. Domyślny język aplikacji i zahardkodowane polskie teksty NIE są w zakresie.
- **Folder:** uzupełniamy istniejący `docs/architecture/flows/features/` (tam wskazuje CLAUDE.md, jest tam 16 plików). **Nie** tworzymy `docs/flow/feature/`, żeby nie dublować drzewa.

Stan wyjściowy (z raportu explorera, jeszcze nie sprawdzony w kodzie plik po pliku):
- Brakuje własnych plików dla: okładka wyjazdu (jest tylko w `trip-create.md`), strony prawne (`src/features/legal`), zakładka Plan jako placeholder.
- README (311 linii, angielskie) jest nieaktualne: opisuje 5 zakładek z „Miejsca", placeholdery Planu i Wydatków, badge „3,000+ tests".
- `docs/screenshots/` ma 9 PNG, w tym `home.png` i `pill-nav.png` z nieaktualną pigułką („Miejsca") i polskim UI.
- Brak skryptu do screenshotów; robi je `tester` przez mobile-mcp lub adb (`.claude/agents/Tester.md`).

Definicja „zrobione": każdy istniejący w aplikacji feature ma plik w `features/` zgodny z kodem; indeks `flows/README.md` jest kompletny; README jest aktualne i angielskie; wszystkie screenshoty w README są nowe, po angielsku i pokazują obecny UI; pełny zestaw (testy, `pnpm typecheck`, `pnpm lint`) zielony.

Założenia:
- Dokumenty w `docs/` i README piszemy po angielsku (cytaty polskiego UI zostają tylko tam, gdzie opisują polskie teksty); plan jest po polsku.
- Feature'y „w trakcie" (np. `plan-day-change`, AI day plan, „plan vs reality") NIE dostają pliku w `features/`, bo reguła z `flows/README.md` mówi „one file per feature that exists in the app today". Zostają w `prompts/` i `ai-day-plan.md`.
- Edytować `docs/` i `prompts/` może tylko orchestrator; README też piszę ja. Tester zwraca PNG do scratchpada, ja kopiuję je do `docs/screenshots/`.

## Podejście
1. Najpierw audyt: explorery (read-only, równolegle) porównują każdy z 16 plików `features/` z kodem i wskazują nieaktualne fragmenty oraz brakujące feature'y. Odrzucona alternatywa: pisać od zera bez audytu (ryzyko, że opisujemy nieistniejące zachowanie).
2. Potem orchestrator poprawia/dopisuje pliki docs i indeks.
3. Screenshoty po audycie CVE (zgodnie z regułą z pamięci projektu: `cve-auditor` w trybie full przed każdym tester run), potem tester na telefonie/emulatorze z angielskim UI.
4. README piszę na końcu, bo korzysta z poprawionych docs i nowych screenshotów.
Odrzucona alternatywa dla screenshotów: skrypt maestro. Dodałby nową zależność i narzędzie, o co trzeba by pytać osobno.

## Struktury danych (Zod)
Brak zmian. Zadanie dokumentacyjne, bez zmian w `src/schemas/`, migracjach ani kodzie.

## Testy
Krok dokumentacyjny, bez red/green. Weryfikacja zamiast testów:
- sprawdzenie linków (każdy link w `flows/README.md` i README wskazuje istniejący plik/obraz),
- grep po nieaktualnych frazach („Miejsca", „/places", „3,000+", „coming soon" dla Wydatków) w README i `docs/`,
- każdy opisany fakt sprawdzony w kodzie (reguła: nie piszemy niczego, czego nie sprawdzono),
- pełny zestaw: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone (nie powinny się zmienić, bo nie ruszamy kodu).

## Pliki
- Nowe: `docs/architecture/flows/features/trip-cover.md`, `docs/architecture/flows/features/legal-pages.md`, ewentualnie `plan-tab.md` (zależnie od audytu i odpowiedzi na pytanie 2 niżej).
- Zmieniane: `docs/architecture/flows/README.md` (indeks, notka o „Miejsca"), nieaktualne pliki z `features/*.md` (lista z audytu), `README.md`.
- Screenshoty: `docs/screenshots/*.png` (nowe, nadpisanie lub usunięcie nieaktualnych: `home.png`, `pill-nav.png`, `budget-sheet.png`, `wizard-flights.png` jeśli nie wchodzą do nowego zestawu).
- Bez zmian: `src/`, `supabase/`, `package.json`.

## Skille
- documentation-and-adrs — kroki 2 i 5 — zasady pisania dokumentacji (opis stanu faktycznego, bez zgadywania)
- (brak innych; `code-review` / CodeRabbit tylko w end-of-plan przez verifiera)

## Kroki
- [x] 0. Branch: `feature/docs-readme-screenshots` z `main` (jeden branch na zadanie, commit po każdym kroku) — weryfikacja: `git status` czysty poza zadaniem
- [x] 1. [explorer x kilka równolegle] Audyt `features/*.md` względem kodu + lista brakujących feature'ów i nieaktualnych screenshotów — najpierw testy: n/d — weryfikacja: raport z cytatami `plik:linia`, orchestrator wyrywkowo sprawdza 3 twierdzenia
- [x] 2. [orchestrator] Poprawić nieaktualne pliki `features/`, dopisać brakujące (trip-cover, legal-pages, ew. plan-tab), zaktualizować `flows/README.md` — skill: documentation-and-adrs — weryfikacja: sprawdzenie linków + grep nieaktualnych fraz + verifier
- [x] 3. [cve-auditor, full] Audyt CVE przed uruchomieniem testera — weryfikacja: werdykt CLEAN; EXISTS/UNKNOWN → raport do Kacpra i jego decyzja
- [x] 4. [tester] Screenshoty na urządzeniu z angielskim UI (Settings → Język → English); lista w „Ryzyka i pytania" (pyt. 3) — weryfikacja: każdy PNG obejrzany przez orchestratora, brak polskich tekstów i danych osobistych, 1080x2400 lub spójny rozmiar
- [x] 5. [orchestrator] Skopiować PNG do `docs/screenshots/`, usunąć nieaktualne — weryfikacja: żaden plik w README/docs nie wskazuje na usunięty obraz
- [x] 6. [orchestrator] Napisać nowe README (angielskie): zakładki, ekrany, offline, stack, test count z prawdziwego `pnpm test`, nowe screenshoty — skill: documentation-and-adrs — weryfikacja: linki, grep nieaktualnych fraz, verifier
- [x] 7. [orchestrator + verifier] Uzupełnić `docs/architecture/` jeśli audyt wykazał rozbieżności; end-of-plan: verifier całego brancha + CodeRabbit — weryfikacja: PASS, pełny zestaw zielony

## Dziennik postępu
- Plan zaakceptowany przez Kacpra (2026-11-17).
- Krok 0: branch `feature/docs-readme-screenshots` założony z `main`. Niezacommitowane zmiany z `feature/plan-day-change` (Tester.md, Tester.toml, config.toml, subagents.md, .agents/skills/) przeszły do working tree i nie wchodzą do commitów tego zadania.
- Krok 1: 4 explorery (haiku) zrobiły audyt 16 plików `features/` względem kodu + fakty do README. Wynik: każdy plik wymagał poprawek (głównie cytowany polski copy zamiast angielskiego z `en.json`, brak opisu stanów UI, jedno błędne twierdzenie w `profile-screen.md` o `shareMessage`, dwie błędne ścieżki plików w `discover-places.md` i `ai-trip-plan.md`). Odstępstwo: `cve-auditor` NIE jest na `main` (commit 1daba65 tylko na `chore/cve-auditor`); do rozstrzygnięcia przed krokiem 3.
- Krok 2: poprawiono 16 plików `features/`, dodano `trip-cover.md` i `legal-pages.md`, zaktualizowano `flows/README.md`. Weryfikacja własna: sprawdzenie linków (brak zepsutych), grep polskich znaków/„Miejsca” (czysto, poza angielskimi cudzysłowami „“ ” w cytatach), 18 plików w `features/`. Brak `plan-tab.md` (decyzja Kacpra); placeholder Planu opisany w `pill-navigation.md` i `ai-trip-plan.md`. Fakty pochodzą z raportów explorerów (nie z mojego własnego czytania kodu): do sprawdzenia przez verifiera wyrywkowo. Użyty skill: brak (nie ładowałem documentation-and-adrs; odstępstwo od planu).
- Krok 2, weryfikacja: verifier #1 FAIL (5 błędnych cytatów copy: legal-pages.md:3 i :9, auth-and-gate.md, profile-settings.md, trip-cover.md), wszystkie sprawdzone w `en.json` i poprawione; verifier #2 PASS (207 cytatów, 45 linków, 18 plików w indeksie). Typecheck/lint/testy nie uruchamiane (krok tylko w `docs/`).
- Krok 3: `cve-auditor` nie istnieje na `main` (tylko `chore/cve-auditor`, commit 1daba65). Za zgodą Kacpra uruchomiłem general-purpose subagenta (opus, effort low) z treścią jego definicji w trybie full audit. Wynik: VULNERABLE. EXISTS: zod@4.6.5 (GHSA-mrhx-c7xc-m3w5, high; poprawka 4.6.6 jest na niezmergowanym `origin/claude/fix-zod-cve-ae0737`). node-forge 1.4.0 (19 advisories), glob, minimatch: dev-only, NOT AFFECTED. UNKNOWN: `npm:@supabase/supabase-js` w Edge Functions (nie sprawdzono w OSV). Decyzja Kacpra: robić screenshoty mimo to (poprawka zoda to osobny task, nie ten zakres).

## Decyzje Kacpra (2026-11-17, odpowiedzi na pytania)
1. Branch: nowy branch na to zadanie, zakładany z `main` (patrz pyt. A niżej o niezacommitowanych zmianach).
2. Bez osobnego `plan-tab.md`: jedno zdanie o placeholderze Planu dopisujemy w `ai-trip-plan.md`.
3. Lista ok. 10 screenshotów z propozycji: zatwierdzona (logowanie, Home, side panel, menu wyjazdu, kreator flights/budget/summary, Wydatki, Discover, Plan, Profil, Ustawienia).
4. Urządzenie i konto: to, na którym aktualnie jest zalogowana aplikacja. Wyjazd do screenshotów: Warszawa → Dżakarta (istniejący lub utworzony przez tester w kreatorze; do ustalenia przy kroku 4).
5. `cve-auditor` jest na `main`, więc po założeniu brancha z `main` agent będzie dostępny; krok 3 nie jest zablokowany.

- Krok 4: tester (adb, bo mobile-mcp zablokowany przez Smart App Control) na emulatorze `emulator-5554` (Android, 1080x2400, aplikacja `com.anonymous.traveling`, zalogowana, UI już po angielsku, języka nie zmieniano). Zrobił 10 z 12 zdjęć; Profil i Ustawienia odrzucił (prawdziwa twarz, nick, friend code, e-mail), ekran logowania pominięty (wymaga wylogowania). Decyzje Kacpra: zamazać dane na Profilu i Ustawieniach; „Rahma” to prawdziwa osoba, więc zamazać imię. Drugi przebieg testera: surowe `profile-raw.png`, `settings-raw.png` oraz `wizard-flights.png` z wypełnionymi datami (nic nie zapisano, kreator zamknięty przez „Discard”). Redakcja: pikselizacja skryptem PowerShell (System.Drawing) w scratchpadzie, nie w repo; surowe pliki zostają poza repo. `home.png` pominięty (pod półprzezroczystą pigułką zostawał fragment imienia; `home-details.png` pokazuje to samo). Wszystkie 11 PNG obejrzane przez orchestratora: angielski UI, brak danych osobowych po redakcji. Uwaga testera (nie dotyczy tego zadania, niezreprodukowane): przy pierwszym wpisie data odlotu zapisała się o dzień wcześniej w kreatorze (13 → 12 Jul), po powtórzeniu poprawnie.
- Krok 5: `docs/screenshots/` ma teraz 11 nowych PNG (ok. 5,8 MB); usunięte nieaktualne `home.png`, `budget-sheet.png`, `pill-nav.png` (żaden dokument w `docs/` ich nie linkował).
- Krok 6: nowe README (angielskie): badge Expo SDK 58 / RN 0.88, status, tabela 11 screenshotów, opis 4 zakładek, nowe sekcje funkcji (logowanie, wydatki, Discover, plan AI, PRO), roadmapa (statusy wg kodu na `main`), drzewo ekranów, tabela offline, stack (Edge Functions, RevenueCat), zmienne środowiskowe (+ RevenueCat), skrypty (+ `doctor`), struktura. Własna weryfikacja: wszystkie 11 obrazów istnieje, brak nieaktualnych fraz („Miejsca", „Expo SDK 57", „five tabs", „Razem/Osobno"). Do potwierdzenia przez Kacpra: statusy „Done" dla logowania/profilu/AI trip plan wynikają z istnienia kodu na `main`, a niektóre stare plany mają status „w trakcie".
- Krok 6, weryfikacja: verifier #1 (Haiku) FAIL, 7 uwag, wszystkie poprawione w `README.md`: (1) „home zawsze ciemny" było fałszem; zakładka Trip podąża za motywem telefonu (`legacy/useTheme` używa `useColorScheme`, wymuszone ciemne tylko welcome i podgląd zdjęć); (2) timeout: „większość żądań 20 s", 45 s recommend-places, 60 s generate-trip-plan (`src/data/fetch-timeout.ts`); (3) podpis `wizard-budget.png` zgodny z obrazem (kwota dzienna, waluta, suma); (4) podpis `expenses.png` zgodny z pustym stanem; (5) Node 22.13+ (od tej wersji `node:sqlite` działa bez flagi; ustalone z wiedzy o dokumentacji Node, nie sprawdzone w sieci); (6) `npx expo install`, a `pnpm add <pkg>@<wersja>` jako fallback (jak `commands.md`); (7) prawdziwy `pnpm test`: 4380 testów w 220 zestawach, badge i tekst „4,000+".
- Krok 6, weryfikacja #3: verifier PASS (lista zawsze ciemnych ekranów kompletna: welcome, photo viewer, avatar; timeouty zgodne z kodem). Uwaga poboczna verifiera, poza zakresem: komentarz w `src/data/trip-plan.ts:46` (timeout = „server reachable but slow”) nie zgadza się z uzasadnieniem captive portal; wywołania AI przy timeoucie kończą jako `failed`, nie `offline`. README opisuje to tylko dla zwykłych żądań Supabase (20 s).
- Krok 7: end-of-plan verifier (Sonnet 5.5, medium, CodeRabbit) FAIL, typecheck i lint czyste. Poprawione: README krok 5 (Edge Function `delete-account` jest wymagana, reszta opcjonalna; finding major z CodeRabbit), `overview.md` i `frontend.md` (panel boczny otwiera się też z „Wydatki”, pigułka nie jest biała w trybie ciemnym). Świadomie bez zmian: `decisions.md:68` („Miejsca”) to historyczny wpis z datą; drugi finding CodeRabbit (trip-budget.md) odrzucony po sprawdzeniu `local-store.ts:343`. Weryfikacja poprawek: grep; osobny verifier nie był uruchamiany (zmiany to 3 zdania docs, zgodne z raportem verifiera).
- Krok 7, weryfikacja poprawek (e9f427a): verifier FAIL w jednym punkcie: README wymieniał `GEMINI_MODEL` dla wszystkich funkcji, a `generate-trip-plan` czyta `GEMINI_PLAN_MODEL` (`index.ts:25`), `place-details` tylko `GOOGLE_PLACES_API_KEY`. Poprawione: sekret per funkcja. Reszta (delete-account wymagana, panel z Podróż i Wydatki, pigułka `surface.elevated`) PASS. Poza zakresem, do decyzji Kacpra: `supabase/functions/.env.example` nie ma `GEMINI_PLAN_MODEL`.

## Ryzyka i otwarte pytania
A. Niezacommitowane zmiany z `feature/plan-day-change` (`Tester.md`, `Tester.toml`, `config.toml`, `subagents.md`, `.agents/skills/…`) przy przełączeniu na `main` przejdą do working tree nowego brancha. Założenie do potwierdzenia: nie commituję ich w tym zadaniu (commity tylko z plikami zadania), chyba że powiesz inaczej.
B. Jeśli na koncie nie ma wyjazdu Warszawa → Dżakarta, tester utworzy go w kreatorze (dane testowe, bez prawdziwych danych osobowych). Potwierdź, że to ok.
C. Zakres poprawek w kroku 2 znany będzie dopiero po audycie z kroku 1.
