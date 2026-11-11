# Zadanie: Nowy wygląd ekranu Ustawienia (settings-redesign)
Status: w trakcie

Akceptacja: Kacper, 2026-11-10, na pytanie „Akceptujesz oba plany razem z pozostałymi rekomendacjami leaderów?”: „Akceptuję oba”; potwierdzone 2026-11-11: „plany sa zaakceptowane kontynuuj prace”. Obejmuje D1–D10 i rekomendacje lidera w P3, P5, P7 (D11–D13).

Gałąź: `claude/settings-redesign-a3adac` (jedyna gałąź zadania). Równolegle inny lider robi ekran „Profil" (`prompts/profile-upgrade/`); tego planu nie dotyczą `ProfileScreen.tsx`, `TravelStatsCard.tsx` ani ich testy.

## Zrozumienie i założenia

Ekran `/settings` dostaje nowy układ wzorowany na obrazku od Kacpra. Zachowanie zostaje, zmienia się wygląd i to, gdzie siedzą „Motyw" i „Język". „Zrobione" = nowy układ działa w obu motywach i obu językach, wszystko co Ustawienia robią dziś dalej działa, cały zestaw testów, `pnpm typecheck` i `pnpm lint` są zielone, dokumenty opisują stan faktyczny.

### Decyzje Kacpra (2026-11-10) — nie pytamy ponownie
- **D1. Układ z obrazka.** Górny pasek: okrągły przycisk ze strzałką wstecz po lewej, tytuł na środku. Niżej, na środku: okrągły awatar, nick dużym tekstem, pod nim e-mail małym szarym tekstem. Potem jeden wyróżniony baner na całą szerokość (ikona i etykieta po lewej, miękki gradient z ilustracją po prawej). Potem osobne zaokrąglone karty, każda to grupa wierszy; wiersz = ikona konturowa po lewej, etykieta, małe okrągłe kółko ze strzałką po prawej; wiersze w karcie dzieli cienka linia, karty dzieli odstęp. Spokojnie, jasno, dużo powietrza. Z obrazka bierzemy tylko układ, nie fiolet.
- **D2. Tokeny bez zmian.** Każdy kolor, odstęp, promień i styl tekstu pochodzi z istniejących tokenów Sunline (`context/design-context.md`, `src/theme/`). Brak tokenu = pytanie do Kacpra, nigdy własna wartość.
- **D3. „Motyw" i „Język" znikają z głównego poziomu.** Każde jest wierszem, który otwiera podkategorię z trzema opcjami (Systemowy + dwie). Zachowanie jak dziś: wybór działa od razu i zostaje na telefonie.
- **D4. Baner „PRO".** Docelowa reguła: „widoczny, gdy użytkownik nie ma PRO". Subskrypcji jeszcze nie ma (RevenueCat lub zamiennik w osobnym zadaniu), więc na razie baner widzi KAŻDY. Dotknięcie niczego nie kupuje, pokazuje komunikat „Wkrótce". Gradient koral → bursztyn z istniejących kolorów motywu (`brand.primary` i bursztyn), zgodny z odznaką PRO, którą drugi lider robi na profilu; bez wspólnego kodu z tamtą gałęzią — jedna opisana komentarzem stała w jednym miejscu, którą zadanie z subskrypcją podmieni. To **wyjątek** od zasady design-context „bez dekoracyjnych gradientów", tylko dla tego banera. Bez schematu, migracji i kodu zakupów.
- **D5. Wszystko, co Ustawienia robią dziś, zostaje:** „Edytuj profil", wersja aplikacji, „Polityka prywatności", „Regulamin", „Wyloguj się" (potwierdzenie, ostrzeżenie o niewysłanych zmianach, wyłączone offline z powodem), „Usuń konto" (dialog, wyłączone offline z powodem), baner offline.

### Odpowiedzi Kacpra na pytania (2026-11-10, przekazane przez managera) — nie pytamy ponownie
- **D6 (P1 = A).** E-mail pokazujemy pod nickiem, gdy da się go odczytać; gdy nie, wiersza po prostu nie ma. Krok 1 `[backend]` zostaje.
- **D7 (P2 = A).** „Motyw" i „Język" otwierają arkusz od dołu z istniejącym `SegmentedControl` (trzy opcje); wybór działa od razu, arkusz zostaje otwarty.
- **D8 (P4 = A).** „Wyloguj się" i „Usuń konto" zostają dwoma przyciskami destrukcyjnymi na samym dole, bez zmian.
- **D9 (P6).** Bursztyn gradientu PRO to `accent.sun`; lider profilu używa tego samego tokenu do odznaki. (Sformułowanie „bursztyn etykiet przesiadek" było pomyłką w briefie.) Gradient: `brand.primary` → `accent.sun`.
- **D10 (P7, część).** Używamy ISTNIEJĄCYCH tokenów: `spacing[8]` (32) na kółko ze strzałką, `components.input.amountHeight` (72) na wysokość banera. Nie dodajemy tokenów, `src/theme/` zostaje nietknięte.
- **Wciąż otwarte** (przyjdą razem z akceptacją): P3 (grupy i kolejność), P5 (forma „Wkrótce" i teksty banera), rozmiar awatara (64 czy 96).

### Co ustaliłem w kodzie (fakty, nie założenia)
- **E-maila nie ma dziś w aplikacji po zalogowaniu.** `SessionState` niesie tylko `userId`, profil (`ShownProfile`) nie ma e-maila, kopia profilu w SQLite też nie. E-mail siedzi w sesji Supabase zapisanej na telefonie (`auth.getSession()`), więc da się go odczytać bez sieci, ale po starcie offline z wygasłym tokenem sesji nie da się odczytać i e-maila wtedy nie ma. → rozstrzygnięte w D6; pokazanie e-maila wymaga małego kroku `[backend]`.
- **Awatar z profilu nie nadaje się do użycia wprost.** `ProfilePhoto` jest prywatną funkcją w `ProfileScreen.tsx` (nieeksportowana, klikalna, 96 dp, z logiką galerii i podglądu), a tego pliku nie ruszamy. Ustawienia dostają własny, mały, **nieklikalny** awatar (zdjęcie z `profile.avatarUrl`, w razie braku lub błędu inicjał nicku na `background.sunken`, w trakcie ładowania okrągły szkielet — §8.7). To drobne powtórzenie; wspólny komponent `Avatar` to osobne zadanie po scaleniu obu gałęzi (wpis do `known-limitations.md`).
- **„Bursztyn z etykiet przesiadek" nie istnieje.** `LayoverLabel` używa `semantic.info.foreground` (morski niebieski). Bursztynowe tokeny w motywie to `accent.sun` (jasny `#D6A34D`, ciemny `#E0B45E`) i `semantic.warning.solid`. → rozstrzygnięte w D9: `accent.sun`.
- **Nagłówek** Ustawień to dziś natywny nagłówek stosu z `HeaderBackButton` (`src/app/_layout.tsx`), nie część ekranu.
- **Gradient bez nowej zależności:** `react-native-svg` (`LinearGradient`), tak jak w `TripHero.tsx`.
- **Nie ma komponentu `ListRow`**, są tylko tokeny `components.listRow` (min. wysokość 56, odstęp poziomy 16) i opis w §8.8.
- Nie ma tokenu przezroczystości dla „miękkiego" gradientu ani tokenu rozmiaru kółka ze strzałką → rozstrzygnięte w D10 (istniejące tokeny, bez nowych).

### Założenia (do potwierdzenia akceptacją planu albo odpowiedziami na pytania)
- Z1. Tytuły sekcji („Konto", „Wygląd", „O aplikacji") znikają, jak na obrazku (P3).
- Z2. (rozstrzygnięte: D8) „Wyloguj się" i „Usuń konto" zostają dwoma przyciskami destrukcyjnymi na dole, bez zmian w kodzie i zachowaniu.
- Z3. Awatar w Ustawieniach jest tylko ozdobą (ukryty przed czytnikiem ekranu, nieklikalny); zmiana zdjęcia zostaje na „Profilu".
- Z4. „Edytuj profil" działa jak dziś także offline (otwiera ekran, który sam pokazuje baner i blokuje zapis).
- Z5. „Motyw" i „Język" działają offline (są tylko na telefonie).

## Podejście

Przebudowa w miejscu: `SettingsScreen.tsx` dostaje nowy układ z małych lokalnych kawałków (wiersz, grupa, awatar, baner), nagłówek stosu dostaje okrągły przycisk z istniejącego `IconButton`. Podkategorie to istniejący `BottomSheet` z istniejącym `SegmentedControl` w środku (zero nowych komponentów wyboru, zero nowych tras). „Wkrótce" to istniejący `Snackbar`. Bez nowych zależności, bez nowych komponentów w `src/components/`, `Card.tsx` bez zmian (grupa wierszy potrzebuje karty bez wewnętrznego odstępu, więc jest lokalnym `View` na tokenach `components.card`).

Odrzucona alternatywa: własny nagłówek w ekranie (`headerShown: false`) i osobne trasy `/settings/theme`, `/settings/language` — więcej kodu, nowe wpisy w stosie i przepisanie testów nagłówka bez zysku dla użytkownika.

### Proponowany układ, od góry do dołu

| # | Element | Szczegóły |
|---|---|---|
| 0 | **Nagłówek stosu** | Po lewej `IconButton` (44×44, okrągły, `surface.primary`) z ikoną `ArrowLeft`, etykieta dostępności jak dziś „Wróć, Profil". Tytuł „Ustawienia" na środku (`headerTitleAlign: 'center'`, styl `headingSM` jak dziś). Tło `background.canvas`, bez cienia. |
| 1 | **Blok tożsamości** (wyśrodkowany) | Awatar okrągły `components.avatar.xl` (64 dp, P7) → nick `headingLG`, `text.primary` → e-mail `bodySM`, `text.secondary` (D6). Odstępy `spacing[3]` / `spacing[1]`. |
| 2 | **Baner PRO** (jeden `Pressable`, promień `components.card.radius`, min. wysokość 72 = `components.input.amountHeight`, D10; tło `surface.primary`, ramka `border.subtle`) | Po lewej ikona `Crown` (20 dp) + tytuł `labelLG` + podtytuł `bodySM`/`text.secondary`. Po prawej gradient SVG poziomy: przezroczysty do ok. 40 % szerokości, dalej `brand.primary` → `accent.sun` (D9); na nim ilustracja z ikon Lucide (§6.2): duża `Crown` (32 dp) i mały `Plane` (20 dp) w `brand.onBrand`, ukryte przed czytnikiem. Dotknięcie → Snackbar „Wkrótce" (P5). |
| 3 | **Karta A** | `UserRound` Edytuj profil → `/edit-profile` · `Palette` Motyw (po prawej bieżąca wartość, np. „Systemowy") → arkusz · `Languages` Język (bieżąca wartość) → arkusz |
| 4 | **Karta B** | `ShieldCheck` Polityka prywatności → `/legal/privacy` · `FileText` Regulamin → `/legal/terms` · `Info` Wersja — po prawej numer wersji, bez strzałki, nie jest przyciskiem |
| 5 | (tylko offline) | `OfflineBanner` „Jesteś offline. Ustawienia konta wymagają internetu." + dwa powody jak dziś |
| 6 | **Dół ekranu** | `TextButton` destrukcyjny „Wyloguj się", pod nim „Usuń konto" — bez zmian (D8). Blok dosunięty do dołu, gdy treść jest krótsza niż ekran. |

**Wiersz** (lokalny `SettingsRow`): cały wiersz to jeden `Pressable` (`accessibilityRole="button"`), min. wysokość `components.listRow.minHeight` (56 ≥ 44 pt), odstęp poziomy `listRow.horizontalPadding` (16). Ikona konturowa 20 dp, `strokeWidth` z tokenu, `icon.primary`, ukryta przed czytnikiem. Etykieta `bodyMD`, `text.primary`. Po prawej opcjonalna wartość (`bodyMD`, `text.secondary`) i ozdobne kółko 32 dp (`spacing[8]`, D10) na `background.sunken` z `ArrowRight` 16 dp — kółko nie jest osobnym przyciskiem. Wciśnięty wiersz: `background.sunken` (§8.8). Linia między wierszami: 1 dp `border.subtle`, zaczyna się na wysokości tekstu (§8.8).
**Grupa**: `surface.primary`, promień `components.card.radius` (20), ramka 1 dp `border.subtle`, `overflow: 'hidden'`; odstęp między kartami `spacing[4]`, między blokami ekranu `spacing[6]`.

### Jak otwierają się „Motyw" i „Język" (D7)
Dotknięcie wiersza otwiera `BottomSheet` z tytułem „Motyw" / „Język" i istniejącym `SegmentedControl` z trzema opcjami. Wybór działa od razu (jak dziś: `usePreferences().setTheme` / `setLanguage`), arkusz zostaje otwarty, żeby było widać efekt; zamyka go przeciągnięcie w dół, dotknięcie tła albo systemowe „wstecz". Wiersz po zamknięciu pokazuje nową wartość.

### Stany
- **Ładowanie:** profil jest zwykle już w pamięci (bramka wpuszcza dopiero z profilem). Gdy go jeszcze nie ma: okrągły szkielet w miejscu awatara i blok szkieletu w miejscu nicku; reszta ekranu działa. Zdjęcie w trakcie pobierania: szkielet w kółku.
- **Błąd:** nieudane zdjęcie → inicjał nicku (§8.7), bez ikony zepsutego obrazka. Brak profilu / błąd odczytu → bez bloku nicku, „Usuń konto" wyłączone jak dziś. Brak e-maila → wiersza e-maila nie ma (D6).
- **Offline:** baner offline i powody przy obu przyciskach jak dziś; „Wyloguj się" i „Usuń konto" wyłączone. Baner PRO, „Motyw", „Język", dokumenty prawne i „Edytuj profil" działają. Zdjęcie bez adresu (start offline) → inicjał.
- **Pusty:** nie dotyczy (ekran nie ma listy danych).

### Teksty (nowe klucze i18n; reszta kluczy `settings.*` zostaje)
| Klucz | pl | en |
|---|---|---|
| `settings.pro.title` | Przejdź na PRO | Go PRO |
| `settings.pro.subtitle` | Więcej możliwości w Travelo | More from Travelo |
| `settings.pro.comingSoon` | Wkrótce! Subskrypcja PRO jest w przygotowaniu. | Coming soon! The PRO subscription is on its way. |
| `settings.rowValue` (etykieta dostępności wiersza z wartością) | {{label}}, {{value}} | {{label}}, {{value}} |

Etykiety wierszy to istniejące klucze: `settings.editProfile`, `settings.theme`, `settings.language`, `settings.privacyPolicy`, `settings.terms`, `settings.version`. Tytuły arkuszy: `settings.theme`, `settings.language`. Usuwane (przestają być używane przy Z1): `settings.account`, `settings.appearance`, `settings.about`. Treść tekstów banera do potwierdzenia w P5.

### Dostępność
- Każdy wiersz i baner to `button` z etykietą; wiersz z wartością czyta się „Motyw, Systemowy"; baner „Przejdź na PRO. Więcej możliwości w Travelo".
- Cele dotyku: wiersze 56 dp, baner ≥ 56 dp, przycisk wstecz 44×44, przyciski na dole jak dziś (≥ 44).
- Ikony, kółka ze strzałką, ilustracja banera, gradient i awatar ukryte przed czytnikiem (`aria-hidden`).
- „Wersja" to tekst, nie przycisk. Snackbar ogłasza się sam (`announceForAccessibility`, już w komponencie).
- Tekst nigdy nie leży na gradiencie (lewa strona banera jest na `surface.primary`), więc kontrast tekstu to istniejące pary tokenów.

## Struktury danych (Zod)

**Brak nowych schematów i brak zmian w istniejących.** Redesign nie zmienia żadnego kształtu danych: preferencje (`ThemePreferenceSchema`, `LanguagePreferenceSchema`) i profil zostają. Baner PRO nie ma stanu (D4: bez schematu). E-mail jest widoczny (D6): odczytany z sesji adres przechodzi na granicy przez istniejący `EmailSchema` (`src/schemas/auth.ts`); niepoprawny lub brak → `null`. Bez migracji i bez regeneracji typów Supabase.

## Testy

Zasada dla istniejących testów: żadna asercja zachowania nie znika. Zmienia się tylko droga dojścia (najpierw otwarcie arkusza) i asercje opisujące stary układ, wymienione niżej wprost.

**Krok 1 `[backend]` (D6: robimy)** — `src/data/__tests__/session-source.test.ts`, `src/providers/__tests__/Session.test.tsx`:
- `email()` zwraca adres z zapisanej sesji; `null` bez sesji, dla sesji anonimowej, gdy odczyt się nie powiedzie i gdy adres nie przechodzi `EmailSchema`; nigdy nie odrzuca.
- `useSession().email()` oddaje to, co źródło; fałszywe źródło w `src/test/fake-session-source.ts` ma ustawialny e-mail.

**Krok 2 `[frontend]` nagłówek** — `src/__tests__/app/settings.test.tsx`:
- bez zmian: tytuł „Ustawienia" / „Settings", przycisk „Wróć, Profil", powrót na `/profile`, „the back control calls router.back()".
- zmiana: test iOS — przycisk ma 44×44 (zamiast `minWidth`/`minHeight` 44; wymóg 44 dp zostaje). Test Androida — dziś sprawdza „44 wysokości, ale nie szerzej, bo pchałoby tytuł"; po wyśrodkowaniu tytułu powód znika, nowa asercja: 44×44 także na Androidzie (wymóg mocniejszy, nie słabszy).
- nowe: ikona przycisku ukryta przed czytnikiem; opcja `headerTitleAlign` = `center`.

**Krok 3 `[frontend]` wiersze i grupy** — `src/__tests__/app/settings-list.test.tsx`, `settings.test.tsx`:
- zmiana (Z1): testy „shows the three sections" przestają szukać „Konto / Wygląd / O aplikacji" (i „Account / Appearance / About"), a sprawdzają komplet wierszy w obu językach: Edytuj profil, Motyw, Język, Polityka prywatności, Regulamin, Wersja + numer.
- bez zmian: „Edytuj profil" otwiera `/edit-profile`; wersja z `expo-constants`; oba linki prawne (`legal.test.tsx` zostaje nietknięty i zielony); „Wyloguj się" i „Usuń konto" jako dwa ostatnie przyciski; cały `settings-delete-account.test.tsx`; wszystkie testy potwierdzenia, offline i wyniku wylogowania.
- zmiana: „puts the button in the bottom part" — zamiast `justifyContent: 'flex-end'` na liście sprawdza, że blok przycisków jest dosunięty do dołu (`marginTop: 'auto'` przy `flexGrow: 1`); minimalna wysokość przycisku zostaje.
- nowe: każdy wiersz ma min. wysokość 56 i rolę `button`; „Wersja" nie jest przyciskiem; ikony i kółka ukryte przed czytnikiem; kolejność wierszy; tło wciśniętego wiersza; marginesy boczne 20/16 jak dziś (istniejący test zostaje).

**Krok 4 `[frontend]` arkusze „Motyw" i „Język"** — `settings-list.test.tsx`:
- istniejące testy przełączników dostają na początku „dotknij wiersza Motyw / Język"; ich asercje zostają co do słowa: zapisany wybór zaznaczony, domyślnie „Systemowy", wybór motywu zapisuje `light` i przesuwa zaznaczenie, wybór języka zapisuje `en` i przełącza ekran (oczekiwany tekst po przełączeniu: „Edit profile" zamiast usuniętego „Appearance"), nazwy języków w nowym języku.
- nowe: na głównym poziomie nie ma żadnego `radio` (D3); wiersz pokazuje bieżącą wartość i ma etykietę „Motyw, Ciemny"; arkusz otwiera się z tytułem, zamyka tłem i „wstecz"; po wyborze arkusz zostaje otwarty, a wiersz po zamknięciu ma nową wartość; oba arkusze działają offline.

**Krok 5 `[frontend]` blok tożsamości** — nowy `src/features/profile/__tests__/SettingsScreen.test.tsx`:
- nick z profilu; e-mail pod nim, gdy jest; brak wiersza e-maila, gdy `null` (bez pustego miejsca i bez zastępczego tekstu); długi e-mail w jednej linii z wielokropkiem.
- awatar: zdjęcie z `avatarUrl`; bez zdjęcia / bez adresu / po błędzie obrazka → inicjał na `background.sunken`; profil w trakcie ładowania → szkielet; awatar nie jest przyciskiem i jest ukryty przed czytnikiem.
- motyw jasny i ciemny: kolory z tokenów.

**Krok 6 `[frontend]` baner PRO** — ten sam nowy plik:
- baner widać u każdego użytkownika, online i offline; rola `button`, etykieta z tytułu i podtytułu, pl i en; min. wysokość ≥ 56.
- dotknięcie pokazuje Snackbar z `settings.pro.comingSoon` (pl i en), nie zmienia trasy, nie woła repozytoriów; drugi raz po zniknięciu działa znowu.
- gradient: przystanki SVG mają kolory z bieżącego motywu (jasny i ciemny) z jednej stałej; ilustracja i gradient ukryte przed czytnikiem.

**Krok 7 (dokumenty)** — bez red/green; sprawdzenie linków i `grep` po nieaktualnych opisach („SegmentedControl changed in place", „one scrolling list: Konto").

## Pliki

Zmieniane:
- `src/features/profile/SettingsScreen.tsx` — nowy układ (lokalne: `SettingsRow`, grupa, awatar, baner PRO ze stałą gradientu).
- `src/app/_layout.tsx` — tylko opcje ekranu `settings`: `headerLeft` na `IconButton`, `headerTitleAlign`.
- `src/i18n/locales/pl.json`, `src/i18n/locales/en.json` — tylko blok `settings` (3–4 nowe klucze, 3 usunięte).
- `src/__tests__/app/settings.test.tsx`, `src/__tests__/app/settings-list.test.tsx` — zmiany opisane wyżej.
- Krok 1 (D6): `src/data/session-source.ts`, `src/providers/Session.tsx`, `src/test/fake-session-source.ts` i ich testy.

Nowe:
- `src/features/profile/__tests__/SettingsScreen.test.tsx`
- `src/hooks/useAccountEmail.ts` (+ test) — krok 5 (D6).

Dokumenty (orkiestrator, krok 7): `context/app-context.md` (§3.9, akapit „Ustawienia"), `context/design-context.md` (notatka projektowa „Settings screen" + wyjątek gradientu banera PRO), `docs/architecture/frontend.md` (wiersz `/settings`), `docs/architecture/flows/features/profile-settings.md`, `docs/architecture/decisions.md`, `docs/architecture/known-limitations.md` (baner PRO dla wszystkich do czasu subskrypcji; powtórzony awatar).

Nie ruszamy: `ProfileScreen.tsx`, `TravelStatsCard.tsx` i ich testy, `Card.tsx`, `BottomSheet.tsx`, `SegmentedControl.tsx`, `IconButton.tsx`, `Snackbar.tsx`, `usePreferences.ts`, `src/theme/`, `src/schemas/`, `supabase/`.

## Skille
- `test-driven-development` — kroki 1–6 — pętla red → green → refactor.
- `javascript-typescript-jest` — kroki 1–6 — testy routera, atrapy, asercje stylów.
- `incremental-implementation` — kroki 1–6 — jeden spójny diff na krok.
- `frontend-design` — kroki 3, 5, 6 — struktura nowych kawałków ekranu (podporządkowany design-context).
- `frontend-ui-engineering` — kroki 2–6 — dostępność, stany, cele dotyku.
- `source-driven-development` — krok 2 — opcje nagłówka native-stack w expo-router (`headerLeft`, `headerTitleAlign`) według aktualnej dokumentacji.
- `ui-taste` — krok 6 (frontend) i weryfikator na końcu — przegląd wizualny gotowego ekranu.
- `code-review-and-quality`, `code-review` (CodeRabbit) — weryfikator, tryb końca planu.
- `git-workflow-and-versioning` — orkiestrator, commit po każdym kroku.
- `documentation-and-adrs` — krok 7 — zapis decyzji D1–D5 i wyjątku gradientu.

## Kroki
- [ ] 1. [backend] E-mail konta: `SessionSource.email()` (z zapisanej sesji, przez `EmailSchema`, nigdy nie odrzuca), wystawione w `useSession()`, obsłużone w fałszywym źródle (D6). — skill: `test-driven-development`, `javascript-typescript-jest` — najpierw testy: adres / brak sesji / sesja anonimowa / błąd odczytu / zły format → `null` — weryfikacja: nowe testy red → green, pełny zestaw, typecheck, lint, weryfikator.
- [ ] 2. [frontend] Nagłówek: okrągły `IconButton` ze strzałką i wyśrodkowany tytuł w opcjach ekranu `settings`. — skill: `test-driven-development`, `source-driven-development`, `frontend-ui-engineering` — najpierw testy: zmienione testy rozmiaru przycisku (iOS, Android), nowy test wyśrodkowania; reszta testów nagłówka bez zmian — weryfikacja: jw. + tester na urządzeniu (czy nagłówek Androida nie przycina przycisku 44 dp).
- [ ] 3. [frontend] Wiersze i grupy: karty A i B z ikonami, liniami i kółkami ze strzałką; „Motyw" i „Język" w tym kroku jeszcze jako dotychczasowe przełączniki pod kartami (ekran działa po każdym kroku); przyciski na dole dosunięte do dołu; usunięcie tytułów sekcji i trzech kluczy i18n. — skill: `test-driven-development`, `frontend-design`, `frontend-ui-engineering`, `incremental-implementation` — najpierw testy: komplet wierszy pl/en, wysokość 56, role, kolejność, blok przycisków na dole — weryfikacja: jw.
- [ ] 4. [frontend] „Motyw" i „Język" jako wiersze z bieżącą wartością, otwierające `BottomSheet` z `SegmentedControl`; przełączniki znikają z głównego poziomu. — skill: `test-driven-development`, `javascript-typescript-jest`, `frontend-ui-engineering` — najpierw testy: brak `radio` na głównym poziomie, otwarcie/zamknięcie arkusza, dotychczasowe asercje wyboru po otwarciu arkusza, wartość w wierszu, offline — weryfikacja: jw.
- [ ] 5. [frontend] Blok tożsamości: awatar, nick, e-mail (`useAccountEmail` na wyniku kroku 1). — skill: `test-driven-development`, `frontend-design`, `frontend-ui-engineering` — najpierw testy: nick, e-mail jest/nie ma, zdjęcie/inicjał/szkielet, oba motywy — weryfikacja: jw.
- [ ] 6. [frontend] Baner PRO: układ, gradient ze stałej z komentarzem „do podmiany przez zadanie subskrypcji", ilustracja, Snackbar „Wkrótce", nowe klucze i18n. — skill: `test-driven-development`, `frontend-design`, `frontend-ui-engineering`, `ui-taste` — najpierw testy: widoczny u każdego (online/offline), etykieta pl/en, dotknięcie → Snackbar i nic poza tym, kolory gradientu z motywu — weryfikacja: jw. + tester: cały ekran w jasnym i ciemnym motywie, pl i en, mały ekran, duża czcionka.
- [ ] 7. [orkiestrator] Dokumenty: `app-context.md` §3.9, notatka i wyjątek gradientu w `design-context.md`, `frontend.md`, `flows/features/profile-settings.md`, `decisions.md`, `known-limitations.md`. — skill: `documentation-and-adrs` — weryfikacja: linki, `grep` po starych opisach, pełny zestaw zielony, weryfikator; potem weryfikator w trybie końca planu (cała gałąź + CodeRabbit). Push i PR dopiero na polecenie managera.

Ręczne scenariusze dla testera (po krokach 2, 4, 6): wejście z „Profilu" i powrót strzałką; zmiana motywu i języka w arkuszu i ich trwałość po ponownym uruchomieniu; baner PRO → „Wkrótce"; tryb samolotowy: baner offline, wyłączone „Wyloguj się" i „Usuń konto" z powodami, arkusze dalej działają; wylogowanie z potwierdzeniem; dialog usuwania konta (bez potwierdzania).

## Dziennik postępu
- 2026-11-11: plan zaakceptowany (D11–D13 dopisane), start realizacji.

## Ryzyka i otwarte pytania

### Odroczone (osobne zadanie)
- **Prawdziwy status PRO i zakup** (RevenueCat lub zamiennik): schemat, źródło prawdy o subskrypcji, reguła „baner tylko bez PRO", ekran oferty. Do tego czasu baner widzi każdy i nic nie sprzedaje; miejsce podmiany to jedna stała i jeden `onPress` w `SettingsScreen.tsx`.
- Wspólny komponent `Avatar` dla „Profilu" i Ustawień — po scaleniu obu gałęzi.

### Ryzyka
- **Konflikty przy scalaniu z gałęzią „profile-upgrade":** `pl.json` / `en.json` (edytujemy tylko blok `settings`), `app-context.md` §3.9 (tylko akapit „Ustawienia"), `design-context.md` (notatki projektowe), `frontend.md`. Zmiany trzymamy małe i lokalne.
- **Gradient i odznaka PRO muszą się zgadzać** między dwiema gałęziami bez wspólnego kodu: obie strony biorą te same dwa tokeny: `brand.primary` i `accent.sun` (D9).
- **Nagłówek na Androidzie:** własny `headerLeft` 44×44 w natywnym nagłówku; wcześniej (profile-screen D26) nagłówek przycinał obszar dotyku w pionie. Sprawdza tester na urządzeniu; jeśli przycina, wracam z pytaniem zamiast obchodzić.
- **„Miękkość" gradientu** nie ma tokenu przezroczystości: plan robi ją przejściem od przezroczystego do pełnego koloru, bez nowej wartości. Jeśli na urządzeniu wyjdzie za mocno, potrzebna decyzja o tokenie.
- **E-mail offline:** po starcie bez sieci z wygasłą sesją adresu nie da się odczytać; wiersza wtedy nie ma (D6).
- Zmienione asercje w istniejących testach (rozmiar przycisku wstecz na Androidzie, tytuły sekcji, `flex-end`) wynikają wprost z D1/D3 i są wypisane w sekcji „Testy"; weryfikator dostaje tę listę, żeby odróżnić je od osłabiania testów.

### Otwarte pytania do Kacpra
Wszystkie rozstrzygnięte: P1 → D6, P2 → D7, P3 → D11, P4 → D8, P5 → D12, P6 → D9, P7 → D10 i D13. Poniżej treść pytań dla historii:
- **P3. Grupy i kolejność.** (A, rekomendacja) dwie karty bez tytułów, jak na obrazku: [Edytuj profil, Motyw, Język] i [Polityka prywatności, Regulamin, Wersja]; (B) trzy karty z tytułami jak dziś: Konto, Wygląd, O aplikacji; (C) inna kolejność — podaj.
- **P5. Komunikat „Wkrótce" i teksty banera.** (A, rekomendacja) krótki pasek na dole ekranu (Snackbar), znika sam; (B) okno dialogowe z przyciskiem „OK"; (C) arkusz od dołu z opisem PRO. Oraz: czy teksty „Przejdź na PRO" / „Więcej możliwości w Travelo" / „Wkrótce! Subskrypcja PRO jest w przygotowaniu." są w porządku?
- **P7 (reszta). Rozmiar awatara.** 64 dp (`avatar.xl`, jak na obrazku, rekomendacja) czy 96 dp (`avatar.xxl`, jak na „Profilu")?
