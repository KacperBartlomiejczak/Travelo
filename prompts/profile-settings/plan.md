# Zadanie: Awatar i ustawienia
Status: w trakcie (zaakceptowany przez Kacpra 2026-11-02; tekst ostrzeżenia A10 i zmiana awatara D13 także)

## Zrozumienie i założenia
Trzy rzeczy na istniejących ekranach „Profil” i „Ustawienia”:
1. **Awatar** — kliknięcie zdjęcia na profilu pozwala je zmienić z galerii albo usunąć.
2. **Ustawienia** — motyw, język, edycja profilu (nick, zainteresowania), „O aplikacji”, wylogowanie (już jest).
3. **Usuwanie konta** — nieodwracalne, przez pierwszą w projekcie Edge Function.

„Gotowe” = wszystkie kroki `[x]`, PASS verifiera, pełny zestaw testów + typecheck + lint + `pnpm test:db` na zielono, funkcja wdrożona przez Kacpra, scenariusze ręczne przejdą na urządzeniu, `Architecture.md` i `context/app-context.md` zaktualizowane.

**Warunek startu:** ~~feature Wydatki jest skończony i scalony~~ uchylony przez D14: praca idzie na `feature/profile-settings`, do której scalono `origin/feature/expenses` (kroki 0–8, z migracją `expenses`).

### Decyzje Kacpra (2026-11-02)
- **D1 — Usunięcie konta kasuje wszystko:** podróże organizatora, plany, wydatki i zdjęcia, także dla połączonych znajomych. Ostrzeżenie mówi o tym wprost.
- **D2 — Potwierdzenie:** dialog z ostrzeżeniem, przycisk aktywny dopiero po wpisaniu własnego nicku.
- **D3 — Zawartość ustawień** oprócz wylogowania i usuwania konta: motyw (systemowy / jasny / ciemny), język (systemowy / polski / angielski), edycja profilu (nick, zainteresowania), „O aplikacji” (wersja, polityka prywatności, regulamin; linki zmienia D5).
- **D4 — Awatar:** kliknięcie zdjęcia na profilu pozwala je zmienić z galerii albo usunąć; stary plik jest kasowany ze Storage; wymaga internetu.
- **D5 (P1) — Dokumentów jeszcze nie ma.** „O aplikacji” pokazuje na razie tylko wersję; linki do polityki i regulaminu dojdą po podaniu adresów, poza tym planem (R6).
- **D6 (P2) — Usuwanie konta wymaga internetu.** Przycisk jest nieaktywny offline, z podaniem powodu, jak przy wylogowaniu. Bez osobnego ostrzeżenia o niewysłanych wydatkach, bo i tak znika wszystko.
- **D7 (P3) — Ekran ustawień to jedna przewijana lista z sekcjami:** Konto (Edytuj profil), Wygląd (Motyw i Język jako trzyopcyjne `SegmentedControl` na miejscu), O aplikacji (wersja), a na dole Wyloguj się i Usuń konto.
- **D8 (P4) — Motyw i język zostają na telefonie** po wylogowaniu i po usunięciu konta.
- **D9 (P5) — Nick bez limitu zmian.**
- ~~**D10 (P6) — Kliknięcie zdjęcia:** bez zdjęcia od razu galeria; ze zdjęciem bottom sheet „Zmień zdjęcie” / „Usuń zdjęcie”; usunięcie bez dodatkowego potwierdzenia.~~ Zastąpione przez D13.
- **D11 (P7a) — Połączony znajomy usuwa swoje konto:** w podróży organizatora zostaje jego wiersz z nickiem jako znajomy bez konta oraz jego wydatki; ostrzeżenie mówi o tym wprost (R7). Dotyczy tylko tego przypadku: wydatki w podróżach organizatora znikają razem z tymi podróżami (D1).
- **D12 (P7b) — Po usunięciu:** ekran powitalny z komunikatem „Konto usunięte.”.
- **D13 (2026-11-02, zastępuje D10) — Kliknięcie zdjęcia otwiera duży podgląd.** Ze zdjęciem: pełny ekran z całym zdjęciem, u góry krzyżyk po lewej i trzy kropki po prawej; kropki otwierają bottom sheet „Zmień zdjęcie” / „Usuń zdjęcie”.
  - **Bez zdjęcia:** kliknięcie od razu otwiera galerię, bez podglądu.
  - **Po zmianie:** podgląd zostaje otwarty; podczas wysyłania widać zajętość, potem nowe zdjęcie. Anulowanie galerii nic nie zmienia.
  - **Po usunięciu:** bez dodatkowego potwierdzenia (bez zmian względem D10); podgląd się zamyka, bo nie ma czego pokazać, a profil pokazuje puste kółko.
  - **Offline:** podgląd zdjęcia widocznego na telefonie działa, kropki są nieaktywne, a na dole podgląd podaje powód. Gdy zdjęcia nie ma na telefonie (szkielet na profilu) kółko nie reaguje. Bez zdjęcia kółko jest nieaktywne, powód podaje `OfflineBanner` profilu i opis dla czytnika ekranu.
- **D14 (2026-11-02) — Start bez czekania na koniec Wydatków.** Kacper polecił ruszyć ustawienia teraz. Baza to niescalona gałąź `origin/feature/expenses`, którą co jakiś czas i przed końcem scalamy do `feature/profile-settings`. Jedna gałąź na całe zadanie, bez gałęzi na krok.
- **D15 (2026-11-02) — Krok 11 od nowa, testy najpierw.** Pierwsza wersja powstała przed testami, więc Kacper kazał ją wyrzucić.
- **D16 (2026-11-02) — Nieaktualny nick przy usuwaniu.** Gdy serwer odpowie `username_mismatch`, nic nie zostało skasowane: aplikacja pobiera aktualny profil, pole się czyści, a pod nim jest „Twój nick się zmienił. Wpisz aktualny nick.”; etykieta pola pokazuje nowy nick. Tekst A5 zostaje dla prawdziwych awarii.
- **D17 (2026-11-02) — Podczas usuwania** przycisk „Usuń konto” pokazuje wskaźnik zajętości, dialog zablokowany.
- **D18 (2026-11-02) — Dialog z polem nicku przesuwa się nad klawiaturę**, tylko dialogi z polem; pozostałe użycia `ConfirmDialog` bez zmian.

### Ustalenia z kodu (sprawdzone 2026-11-02 na `origin/expenses/step-1-schemas-wip`)
- `supabase/functions/` nie istnieje; `config.toml` ma włączone `edge_runtime` (Deno 2). Usunięcie z `auth.users` wymaga klucza service role, więc to pierwsza Edge Function.
- Klucze obce: `trips.owner_id` → cascade (dalej `trip_members`, `flight_segments`, `trip_photos`), `profiles.id` → cascade, `trip_members.user_id` → **set null**. Plan nie zakłada migracji, o ile kaskady przejdą z `expenses` (R8).
- **Dokumentacja Supabase (`guides/auth/managing-user-data`):** nie da się usunąć użytkownika będącego właścicielem obiektów w Storage. Kolejność „najpierw pliki, potem użytkownik” jest więc obowiązkowa, nie tylko bezpieczniejsza.
- Pliki: `avatars/<userId>/<avatarId>.jpg`, `trip-photos/<tripId>/...` (także okładki z galerii). Do `trip-photos` pisze tylko właściciel podróży, więc połączony znajomy nie ma plików w cudzych podróżach. Wzorzec usuwania folderu: `supabase-trip-repository.ts:286` (`removeTripFiles`).
- Klient ma limit 20 s na każde żądanie (`fetch-timeout.ts`), więc przy wielu zdjęciach aplikacja może nie dostać odpowiedzi, choć funkcja działa dalej. Dlatego funkcja musi być idempotentna (A4).
- `auth.signOut({ scope: 'local' })` usuwa sesję także przy błędzie żądania, a `SIGNED_OUT` uruchamia `clearUserData` (`session-source.ts:102`). Po usunięciu konta używamy tej samej ścieżki.
- `clearUserData` (`local-store.ts:264`) czyści tylko SQLite. Cache obrazów expo-image i pliki w `Paths.cache` (np. `avatar-*` z `avatar-download.ts:34`) zostają po wylogowaniu.
- **Motyw:** oba `useTheme` (`src/theme/useTheme.ts`, `src/theme/legacy/useTheme.ts`) oraz `DateTimeField.web.tsx` opierają się na `useColorScheme()`. `Appearance.setColorScheme('light' | 'dark' | 'unspecified')` z React Native zmienia wynik tego hooka w całej aplikacji, także dla natywnych pickerów i klawiatury. Hooków motywu nie trzeba ruszać. `DarkThemeScope` ma pierwszeństwo przed schematem (`forced ?? ...`), więc ekran powitalny i przeglądarka zdjęć zostają ciemne. Na Androidzie to `AppCompatDelegate.setDefaultNightMode`, co trzeba sprawdzić na urządzeniu (R3).
- **Język:** urządzenie czyta tylko `src/i18n/index.ts`. Daty, kwoty i liczby dostają `i18n.language` jako locale (`money.ts`, `date-time.ts`, `TravelStatsCard`), więc po `changeLanguage` formatowanie idzie za wybranym językiem. Poza testami nie ma `i18n.t(` na poziomie modułu. Formularz wpisany kwotą (`BudgetSheet`, kreator) nie jest otwarty podczas zmiany języka, bo ustawienia są osobnym ekranem.
- **Zapis ustawień musi być synchroniczny**, bo i18n startuje synchronicznie, a motyw ma być znany przed pierwszym renderem. `expo-sqlite/kv-store` ma `getItemSync` / `setItemSync`, jest już zainstalowany (sesja używa `expo-sqlite/localStorage` z tej samej biblioteki) i nie wymaga migracji `local-db.ts`.
- `ProfileRepository` nie ma metody update; granty bazy już pozwalają na update `username`, `interests`, `avatar_id` (`20261018150000_profiles.sql:139`), a polityki Storage na upload i delete własnego pliku.
- `AvatarPicker` jest w `features/auth`, importuje `FormError` z auth. Na profilu nie używamy tego komponentu, wspólne jest tylko otwarcie galerii.
- `ConfirmDialog` nie ma pola tekstowego ani nieaktywnego przycisku potwierdzenia.
- **`PhotoViewer` nie nadaje się do ponownego użycia dla awatara:** jest związany z `useTripPhotos(tripId)` i `ShownTripPhoto`, ma pager, licznik i usuwanie zdjęcia podróży, a jego `Chrome` jest prywatny. Wzorzec jest ten sam (trasa w `DarkThemeScope`, `HeroIconButton`, sheet jako Modal ekranu); ikonę trzech kropek ma już `TripMenuButton` (`EllipsisVertical`).
- `ProfilePhoto` przy odczycie bez adresu pokazuje ostatni wczytany adres (profile-screen D23), który istnieje tylko w jego stanie.
- Nick połączonego znajomego w cudzej podróży to migawka, bez aktualizacji na żywo (friend-invite A1). Zmiana nicku tego nie rusza.

### Założenia
- **A1 — Nick z dialogu jest sprawdzany także na serwerze.** Funkcja porównuje go z `profiles.username`; niezgodność = 403 i nic nie jest kasowane. Chroni przed błędem klienta, koszt to jedno zapytanie.
- **A2 — Id użytkownika pochodzi wyłącznie z JWT**, nigdy z treści żądania.
- **A3 — Kolejność w funkcji:** weryfikacja → odczyt id podróży właściciela → pliki `trip-photos` → pliki `avatars` → `auth.admin.deleteUser` → drugie, ciche przejście po tych samych folderach (plik wgrany w międzyczasie z drugiego telefonu, jak `deleteTrip`). Odrzucone: najpierw użytkownik, bo przy awarii zostałyby osierocone prywatne zdjęcia bez możliwości ponowienia.
- **A4 — Idempotencja.** Awaria w połowie = błąd, konto zostaje, ponowienie kończy pracę. Token, którego użytkownika już nie ma (`user_not_found`), dostaje 200 `{ deleted: true }`, więc ponowienie po utraconej odpowiedzi kończy się sukcesem.
- **A5 — Częściowa awaria jest mówiona wprost:** „Nie udało się dokończyć usuwania konta. Część zdjęć mogła już zniknąć. Spróbuj ponownie.”
- **A6 — Zmiana awatara:** odczyt `avatar_id` z serwera → upload pod nowym id → update wiersza → ciche usunięcie starego pliku. Usunięcie: update na null → ciche usunięcie pliku. Wiersz nigdy nie wskazuje brakującego pliku; plik osierocony po awarii znika najpóźniej przy usuwaniu konta (cały folder). Błąd update z odpowiedzią serwera 4xx usuwa nowy plik, a przy braku odpowiedzi lub 5xx plik zostaje, jak w `createProfile`.
- **A7 — Czyszczenie plików po wylogowaniu** (obrazy, `Paths.cache`) jest w tym samym `clearUserData` dla wylogowania i usunięcia konta, ale **nie blokuje** wylogowania: błąd jest ignorowany, bo kluczowe dane są w SQLite, a blokada zostawiłaby użytkownika na ekranie błędu.
- **A8 — Nowe ekrany i `SettingsScreen` przechodzą na motyw Sunline** (`@/theme/useTheme`); `ProfileScreen` zostaje na legacy poza dodanym kliknięciem.
- **A9 — Bez powiadamiania znajomych** o zniknięciu podróży: podróż po prostu znika z ich listy. Niewysłane wydatki znajomego dla usuniętej podróży zostają widoczne jako `failed`, tak samo jak po zwykłym usunięciu podróży.
- **A10 — Tekst ostrzeżenia** (do zatwierdzenia z planem): tytuł „Usunąć konto?”, treść „Trwale usuniemy Twoje konto, profil i zdjęcie oraz wszystkie podróże, które organizujesz, z planami, wydatkami i zdjęciami. Znikną też u połączonych znajomych. W cudzych podróżach zostaną Twój nick i Twoje wydatki. Tego nie da się cofnąć.”, pole „Wpisz swój nick: <nick>”, przycisk „Usuń konto”.

## Podejście
**Usuwanie konta.** Logika w `supabase/functions/delete-account/handler.ts` z wstrzykniętymi zależnościami, bez globali Deno, więc testuje ją Jest z fałszywym klientem. `index.ts` to cienkie `Deno.serve`, które buduje klienta z kluczem service role. Aplikacja woła `supabase.functions.invoke`, a po sukcesie `signOut` z istniejącej ścieżki. Odrzucone: RPC `security definer` usuwający z `auth.users`, bo Storage nie pozwala kasować plików z SQL, a pliki muszą zniknąć pierwsze.

**Motyw.** `Appearance.setColorScheme` na starcie i przy zmianie. Odrzucone: nowy kontekst motywu w obu hookach (więcej kodu, a natywne pickery i klawiatura zostałyby przy motywie systemu).

**Język.** `i18n.changeLanguage` plus odczyt zapisanej wartości w `src/i18n/index.ts`.

**Podgląd awatara.** Nowa trasa `/avatar` w `DarkThemeScope` z małym `AvatarViewer`: jedno zdjęcie, dwa przyciski `HeroIconButton`, `AvatarSheet` jako Modal tego ekranu, więc Modal nie otwiera się na innym Modalu. Adres bierze z `useMyProfile`, a gdy odczyt go nie ma, z parametru trasy, czyli adresu pokazywanego właśnie przez `ProfilePhoto` (D23). Odrzucone: rozbudowa `PhotoViewer` albo wydzielenie jego `Chrome` (rozszerzałoby działający ekran podróży dla dwóch przycisków). Bez przybliżania gestem, bo nikt o to nie prosił.

**Edycja profilu.** Osobny ekran na `AuthFormScreen`, z tymi samymi polami co profile setup. Nie wydzielamy wspólnego formularza: `ProfileSetupScreen` ma logikę podpowiedzi z konta, której edycja nie potrzebuje.

## Struktury danych (Zod)
Bez zmian w bazie i bez migracji (o ile krok 2 to potwierdzi, R8).

`src/schemas/account.ts` — **importuje tylko `zod`**, bo importuje go też funkcja Deno:
```ts
export const DeleteAccountInputSchema = z.object({ confirmUsername: z.string().min(1).max(64) });
export const DeleteAccountResultSchema = z.object({ deleted: z.literal(true) });
export const DeleteAccountErrorSchema = z.object({
  error: z.enum(['invalid_input', 'unauthorized', 'username_mismatch', 'storage_failed', 'auth_failed']),
});
```
`src/schemas/preferences.ts`:
```ts
export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark']);
export const LanguagePreferenceSchema = z.enum(['system', 'pl', 'en']);
// Odczyt: nieznana lub brakująca wartość = 'system'.
```
`src/schemas/profile.ts` — dodane:
```ts
export const ProfileEditInputSchema = ProfileSetupInputSchema.pick({ username: true, interests: true });
```
Nowe metody `ProfileRepository`:
```ts
updateProfile(input: ProfileEditInputValues): Promise<ShownProfile>; // UsernameTakenError, ZodError
changeAvatar(pickedUri: string): Promise<ShownProfile>;
removeAvatar(): Promise<ShownProfile>;
deleteAccount(confirmUsername: string): Promise<void>; // ServerUnreachableError przy braku odpowiedzi
```

## Testy
- **Krok 1:** poprawne i błędne fixture'y każdego schematu; `ProfileEditInputSchema` normalizuje nick (trim, małe litery) i odrzuca pustą listę zainteresowań.
- **Krok 2 (`supabase/tests/account_delete.sql`):** organizator usunięty → znikają jego `trips`, `trip_members`, `flight_segments`, `trip_photos`, `expenses`, `profiles`; **także gdy podróż ma wydatki członków, również miękko usunięte** (`expenses.member_id` ma RESTRICT, R8); znajomy usunięty → podróż, wiersz członka (z `user_id` null, ta sama nazwa) i jego wydatki zostają, a organizator dalej je edytuje; cudza podróż nietknięta. Test opisuje klucze obce, które już istnieją po Wydatkach, więc może nie mieć fazy red; czerwony wynik oznacza błąd kaskady i **stop, pytanie do Kacpra**.
- **Krok 3 (handler, Jest):** brak / zły token → 401, nic nie skasowane; zła treść → 400; zły nick → 403, nic nie skasowane; id z treści żądania jest ignorowane; kolejność: wszystkie pliki przed `deleteUser`; więcej niż 1000 plików idzie partiami, a lista stronami; błąd Storage → 500 i `deleteUser` niewołany; błąd `deleteUser` → 500; ponowienie po częściowej awarii kończy pracę; `user_not_found` → 200; błąd drugiego przejścia nie psuje sukcesu; podróże, gdzie użytkownik jest tylko członkiem, nie są ruszane; odpowiedzi zgodne ze schematami.
- **Krok 4 (repozytorium):** `updateProfile`: zajęty nick → `UsernameTakenError`, odpowiedź trafia do kopii w SQLite. `changeAvatar`: kolejność z A6, stary plik usunięty, błąd usunięcia starego pliku nie jest błędem, błąd 4xx usuwa nowy plik, 5xx i brak odpowiedzi go zostawiają. `removeAvatar`: najpierw wiersz, potem plik. `deleteAccount`: wysyła nick, mapuje brak odpowiedzi na `ServerUnreachableError`, a błąd HTTP na zwykły błąd; odpowiedź parsowana Zodem. Wszystko także w wersji in-memory i `delegatingProfileRepository`.
- **Krok 5:** `clearUserData` z aplikacji czyści SQLite, pamięć i dysk expo-image oraz zawartość `Paths.cache`; błąd czyszczenia plików nie odrzuca (A7); błąd SQLite dalej odrzuca.
- **Krok 6:** zapis i odczyt obu ustawień; wartość nieznana → `system`; `clearUserData` ich nie rusza (D8).
- **Krok 7:** język zapisany wygrywa z urządzeniem, `system` wraca do języka urządzenia; `Appearance.setColorScheme` dostaje właściwą wartość na starcie i przy zmianie, `system` → `unspecified`; oba `useTheme` dają wybrany motyw; `DarkThemeScope` dalej wymusza ciemny.
- **Krok 8:** ekran pokazuje sekcje; przełączniki odzwierciedlają zapisany wybór i zmieniają go; wersja z `expo-constants`; brak linków do dokumentów (D5); wylogowanie działa jak dotąd (istniejące testy zostają).
- **Krok 9:** formularz wypełniony obecnymi danymi; zapis nieaktywny bez zmian, offline i przy błędnym nicku; zajęty nick → błąd na polu; sukces wraca do ustawień, a profil pokazuje nowy nick; inny błąd → stały tekst, dane zostają.
- **Krok 10 (D13):**
  - Profil: bez zdjęcia kliknięcie otwiera galerię, nie podgląd; ze zdjęciem otwiera `/avatar`, nie galerię; podczas szkieletu kółko nie reaguje; offline bez zdjęcia nieaktywne z opisem powodu; offline z widocznym zdjęciem podgląd się otwiera.
  - Podgląd: pokazuje całe zdjęcie (`contain`) z krzyżykiem i trzema kropkami, oba z etykietami; krzyżyk zamyka; kropki otwierają sheet z dwiema akcjami; przy odczycie bez adresu używa adresu z parametru (D23); nieudane wczytanie pokazuje błąd, a krzyżyk i kropki działają.
  - Zmiana: po sukcesie podgląd zostaje i pokazuje nowe zdjęcie; anulowanie galerii nic nie zmienia; podczas pracy widać zajętość i nie ma drugiego wywołania; błąd galerii i błąd wysyłania są widoczne i ogłaszane, a stare zdjęcie zostaje.
  - Usunięcie: bez potwierdzenia, po sukcesie podgląd się zamyka; błąd jest widoczny i podgląd zostaje.
  - Offline w podglądzie: kropki nieaktywne, widoczny powód.
  - `AvatarPicker` działa jak przed wydzieleniem.
- **Krok 11:** przycisk nieaktywny bez nicku i z błędnym nickiem, aktywny po poprawnym (także wielkie litery i spacje na końcu); anulowanie nic nie wywołuje; podczas usuwania dialog nie daje się zamknąć; sukces → `signOut` i komunikat „Konto usunięte.” na ekranie powitalnym (D12), a zwykłe wylogowanie go nie pokazuje; błąd → tekst A5, dialog zostaje, ponowienie możliwe; offline nieaktywne z powodem; podwójne kliknięcie = jedno wywołanie.

## Pliki
- **Nowe:** `src/schemas/account.ts`, `src/schemas/preferences.ts`, `supabase/tests/account_delete.sql`, `supabase/functions/delete-account/{index.ts,handler.ts,deno.json}`, `supabase/functions/delete-account/__tests__/handler.test.ts`, `src/data/preferences.ts`, `src/hooks/usePreferences.ts`, `src/hooks/usePickAvatar.ts`, `src/hooks/useDeleteAccount.ts`, `src/features/profile/EditProfileScreen.tsx`, `src/features/profile/AvatarViewer.tsx`, `src/features/profile/AvatarSheet.tsx`, `src/features/profile/DeleteAccountDialog.tsx`, `src/app/edit-profile.tsx`, `src/app/avatar.tsx`.
- **Zmieniane:** `src/schemas/profile.ts`, `src/schemas/index.ts`, `src/data/profile-repository.ts`, `src/data/supabase-profile-repository.ts`, `src/test/fake-profile-repository.ts`, `src/data/session-source.ts`, `src/data/app-session-source.ts`, `src/i18n/index.ts`, `src/i18n/locales/{pl,en}.json`, `src/app/_layout.tsx`, `src/providers/Session.tsx` (znacznik „konto usunięte” dla komunikatu), `src/features/auth/WelcomeScreen.tsx`, `src/components/ConfirmDialog.tsx` (opcjonalne `children`, `confirmDisabled`, `busy`), `src/features/auth/AvatarPicker.tsx`, `src/features/profile/ProfileScreen.tsx`, `src/features/profile/SettingsScreen.tsx`, `tsconfig.json` (bez `supabase/functions/**/index.ts`), `jest.setup.ts` jeśli trzeba.
- **Dokumenty:** `context/design-context.md` (linia 7 i nowy opis ekranu), `context/app-context.md`, `CLAUDE.md` (bez zmian, chyba że decyzje tego wymagają), `Architecture.md`.

## Skille
- `domain-modeling`, `test-driven-development` — krok 1 — schematy.
- `supabase-postgres-best-practices`, `doubt-driven-development` — krok 2 — nieodwracalne kasowanie danych.
- `supabase`, `source-driven-development`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development` — krok 3 — pierwsza Edge Function, service role.
- `api-and-interface-design`, `test-driven-development` — krok 4 — kontrakt repozytorium.
- `security-and-hardening`, `test-driven-development` — krok 5 — dane prywatne na telefonie.
- `source-driven-development`, `test-driven-development` — kroki 6, 7 — `kv-store`, `Appearance`.
- `frontend-design`, `frontend-ui-engineering`, `test-driven-development`, `ui-taste` — kroki 8–11.
  Krok 10 używa `frontend-design`, bo dochodzi nowy ekran podglądu.
- `doubt-driven-development` — krok 11 — nieodwracalna akcja w UI.
- `documentation-and-adrs` — kroki 0, 13.

## Kroki
Kroki 2–6 mogą iść równolegle po kroku 1 (rozłączne pliki, żaden nie potrzebuje wyniku innego). Frontend po kolei.

- [x] 0. [docs, orkiestrator] `context/design-context.md`: motyw idzie za wyborem użytkownika, domyślnie za telefonem; opis ekranu ustawień według D7 — skill: documentation-and-adrs — najpierw testy: brak (tylko dokumenty, bez zachowania) — weryfikacja: verifier sprawdza spójność z planem.
- [x] 1. [backend] Schematy `account.ts`, `preferences.ts`, `ProfileEditInputSchema` — skill: domain-modeling, test-driven-development — najpierw testy: fixture'y kroku 1 — weryfikacja: testy, typecheck, lint.
- [x] 2. [backend, równolegle] Test kaskad `account_delete.sql`, zależny od testu kroku 2 Wydatków (R8) — skill: supabase-postgres-best-practices, doubt-driven-development — najpierw testy: sam krok jest testem; bez kodu produkcyjnego, chyba że test wykaże brak (wtedy stop) — weryfikacja: `pnpm test:db`.
- [x] 3. [backend, równolegle] Edge Function `delete-account`: `handler.ts`, `index.ts`, `deno.json`, wyłączenie `index.ts` z `tsc` — skill: supabase, source-driven-development, security-and-hardening, doubt-driven-development, test-driven-development — najpierw testy: lista kroku 3 — weryfikacja: pełny zestaw; `supabase functions serve` lokalnie na koncie testowym z plikami (R1). Bez wdrożenia na zdalny projekt.
- [x] 4. [backend, równolegle] `ProfileRepository`: `updateProfile`, `changeAvatar`, `removeAvatar`, `deleteAccount` — skill: api-and-interface-design, test-driven-development — najpierw testy: lista kroku 4 — weryfikacja: pełny zestaw.
- [x] 5. [backend, równolegle] Czyszczenie cache obrazów i plików w `clearUserData` aplikacji — skill: security-and-hardening, test-driven-development — najpierw testy: lista kroku 5 — weryfikacja: pełny zestaw.
- [x] 6. [backend, równolegle] `src/data/preferences.ts` na `expo-sqlite/kv-store` — skill: source-driven-development, test-driven-development — najpierw testy: lista kroku 6 — weryfikacja: pełny zestaw.
- [x] 7. [frontend] Zastosowanie ustawień: `src/i18n/index.ts`, start w `_layout.tsx`, `usePreferences` — skill: source-driven-development, test-driven-development — najpierw testy: lista kroku 7 — weryfikacja: pełny zestaw, kroki ręczne M1–M2.
- [x] 8. [frontend] Nowy `SettingsScreen`: motyw, język, wejście do edycji profilu, „O aplikacji” (tylko wersja, D5), wylogowanie, miejsce na „Usuń konto” — skill: frontend-design, frontend-ui-engineering, test-driven-development, ui-taste — najpierw testy: lista kroku 8 — weryfikacja: pełny zestaw, ui-taste, M3.
- [x] 9. [frontend] `EditProfileScreen` i trasa `/edit-profile` — skill: frontend-ui-engineering, test-driven-development — najpierw testy: lista kroku 9 — weryfikacja: pełny zestaw, M4.
- [x] 10. [frontend] Awatar na profilu (D13): `usePickAvatar` (wydzielone z `AvatarPicker`), kliknięcie w `ProfilePhoto`, trasa `/avatar` z `AvatarViewer`, `AvatarSheet` — skill: frontend-design, frontend-ui-engineering, test-driven-development, ui-taste — najpierw testy: lista kroku 10 — weryfikacja: pełny zestaw, M5.
- [x] 10a. [backend] `deleteAccount` rozpoznaje 403 `username_mismatch` jako `UsernameMismatchError` (D16), odpowiedź błędu parsowana `DeleteAccountErrorSchema`; inne błędy bez zmian — skill: api-and-interface-design, test-driven-development — najpierw testy: 403 z tym kodem daje nowy błąd; 403 z innym kodem, zła treść i 500 dają zwykły błąd — weryfikacja: pełny zestaw.
- [x] 11. [frontend] `DeleteAccountDialog`, rozszerzenie `ConfirmDialog`, `useDeleteAccount`, komunikat na ekranie powitalnym — skill: frontend-ui-engineering, doubt-driven-development, test-driven-development — najpierw testy: lista kroku 11 — weryfikacja: pełny zestaw, verifier ze skillem doubt-driven-development.
- [ ] 12. [Kacper + tester] Kacper wdraża funkcję (`supabase functions deploy delete-account`) i potwierdza sekret klucza service role; tester przechodzi M1–M7 na koncie testowym — skill: brak — najpierw testy: brak (wdrożenie i próba na urządzeniu; automaty są w krokach 3 i 11) — weryfikacja: raport PASS / FAIL.
- [ ] 13. [docs, orkiestrator] `Architecture.md`, `context/app-context.md` (m.in. §1 „język z urządzenia”, §3.9, §6 „Edge Functions: none yet”), status planu — skill: documentation-and-adrs — najpierw testy: brak (tylko dokumenty) — weryfikacja: verifier porównuje dokumenty z kodem, pełny zestaw zielony.

### Scenariusze ręczne
- **M1 motyw:** każda z trzech opcji, zmiana bez restartu, po restarcie bez mignięcia złego motywu; ekran powitalny i przeglądarka zdjęć zostają ciemne; pasek statusu i picker daty pasują. Na Androidzie i iOS.
- **M2 język:** każda z trzech opcji, zakładki, tytuły, daty i kwoty się zmieniają; po restarcie zostaje.
- **M3 ustawienia:** układ w jasnym, ciemnym i przy dużej czcionce (czy `SegmentedControl` mieści trzy opcje na wąskim ekranie); wersja; offline.
- **M4 edycja:** zmiana nicku, zajęty nick, zainteresowania; offline; nick widoczny na profilu i po restarcie offline.
- **M5 awatar:** bez zdjęcia kliknięcie otwiera galerię; ze zdjęciem otwiera duży podgląd na ciemnym tle, w jasnym i ciemnym motywie aplikacji; pionowe i poziome zdjęcie widać w całości; krzyżyk i przycisk wstecz na Androidzie wracają na profil; kropki otwierają sheet. Zmiana: podgląd zostaje z nowym zdjęciem, a po powrocie jest ono też na profilu. Anulowanie galerii nic nie zmienia. Usunięcie: powrót na profil z pustym kółkiem. Stary plik znika z bucketa (sprawdza Kacper w panelu). Offline: podgląd działa, kropki nieaktywne z powodem; offline bez zdjęcia kółko nieaktywne.
- **M6 usuwanie, organizator:** konto testowe z podróżą, zdjęciami, okładką z galerii, awatarem i wydatkami; przejście do ekranu powitalnego z komunikatem „Konto usunięte.”; w panelu puste foldery i brak wierszy; ponowne logowanie tym samym mailem = nowe konto z pustym stanem i wolnym nickiem.
- **M7 usuwanie, znajomy i awaria:** połączony znajomy usuwa konto → podróż organizatora zostaje z jego wierszem i wydatkami; organizator usuwa konto → podróż znika znajomemu; samolotowy w trakcie usuwania → komunikat, ponowienie kończy pracę.

## Dziennik postępu
- Krok 0 (2026-11-02): tylko dokumenty, bez testów (zatwierdzone w planie) · `context/design-context.md`: linia 7 (motyw za wyborem użytkownika), opis ekranu ustawień i podglądu awatara w notatkach projektu · start według D14 · użyty skill: documentation-and-adrs.
- Krok 1 (2026-11-02): testy napisane (red ✓: 21 testów, schematy niezdefiniowane) · `src/schemas/account.ts` (tylko `zod`), `src/schemas/preferences.ts`, `ProfileEditInputSchema` + `ProfileEditInputValues`, eksporty w `index.ts` · green ✓: 157 zestawów, 3319 testów, typecheck, lint · verifier: PASS (2 pełne przebiegi; red znany tylko z raportu implementatora, bo krok nie był jeszcze w gicie) · użyty skill: domain-modeling, test-driven-development · uwaga: implementator raz zobaczył jeden padający test w niepowiązanym zestawie, bez nazwy; 4 kolejne przebiegi zielone, obserwujemy.
- Krok 2 (2026-11-02): `supabase/tests/account_delete.sql` · bez fazy red, zgodnie z planem (test opisuje istniejące klucze); kopia z celowo złą asercją padła, więc test potrafi wykryć błąd · **R8 potwierdzone przez `auth.users`:** kaskady przechodzą także z miękko usuniętymi wydatkami członków, bez migracji · green ✓: wszystkie pliki `supabase/tests` w kontenerze, przez `psql` w `supabase_db_Travelo` (brak lokalnego `psql`) · verifier: PASS · użyty skill: supabase-postgres-best-practices, doubt-driven-development · pełny jest uruchomi się po krokach równoległych.
- Krok 6 (2026-11-02): testy napisane (red ✓: brak modułu) · `src/data/preferences.ts` na `Storage` z `expo-sqlite/kv-store`, to osobna baza `ExpoSQLiteStorage`, więc `clearUserData` jej nie rusza (D8) · nieznana wartość, brak wartości i błąd odczytu dają `system`; błąd zapisu leci do wywołującego · green ✓: 5 testów · verifier: PASS · użyty skill: source-driven-development, test-driven-development · pełny zestaw po krokach równoległych; prawdziwy kv-store sprawdzi urządzenie.
- Krok 5 (2026-11-02): testy napisane (red ✓: brak modułu; dodatkowo jeden `forEach` zatrzymywał się na pierwszym błędzie, poprawione) · nowy `src/data/clear-user-data.ts` (`clearUserDataOnPhone`, logika poza `app-session-source.ts`, żeby testy nie ciągnęły Supabase; odstępstwo od listy plików), czyści obrazy i `Paths.cache`, potem SQLite · green ✓: 4 testy · verifier: PASS; brak wyścigu z nową sesją, bo przy czyszczeniu stan to `LOADING`; `Directory.delete()` rekurencyjne w kodzie natywnym · znane ograniczenie: plik zapisany między `list()` a kasowaniem zostaje do następnego wylogowania, ryzyko niskie · użyty skill: security-and-hardening, test-driven-development.
- Krok 4 (2026-11-02): testy napisane (red ✓: `repository.updateProfile is not a function` i pozostałe) · `updateProfile`, `changeAvatar`, `removeAvatar`, `deleteAccount` w `supabase-profile-repository.ts`, wersji in-memory i delegującej; `functions.invoke` w `src/test/fake-supabase.ts` · `FunctionsFetchError` → `ServerUnreachableError`; `FunctionsRelayError` i `FunctionsHttpError` → zwykły błąd (serwer odpowiedział, nic nie skasowano) · green ✓: 161 zestawów, 3399 testów, typecheck, lint · verifier: PASS · do kroku 10: `avatar:<id>` z `seedQuietly` nikt nie czyta, bo `ProfilePhoto` nie podaje `cacheKey` · użyty skill: api-and-interface-design, test-driven-development.
- Krok 3 (2026-11-02): testy napisane (red ✓: brak modułów `handler`, `ports`) · `supabase/functions/delete-account/`: `handler.ts`, `ports.ts` (odstępstwo od listy plików: adaptery wydzielone, żeby miały testy, po FAIL verifiera), `index.ts` (same zmienne, klient i `Deno.serve`), `deno.json`; `tsconfig.json`: `exclude` dla `index.ts`, `allowImportingTsExtensions` (Deno wymaga `.ts` w importach) · ustalenia: tylko POST, inna metoda 405 z kodem `invalid_input`; na 401 mapowane tylko 401/403 GoTrue, 429 i 5xx dają 500 `auth_failed`; ścieżka `gone` sprząta cicho tylko `avatars/<sub>` · **A4 sprawdzone na lokalnym GoTrue:** poprawny podpis i brak użytkownika daje `user_not_found`, zły podpis `bad_jwt`, więc podrobiony token nie trafi do `gone` · green ✓: 162 zestawy, 3417 testów, typecheck, lint · **próba lokalna (`supabase functions serve delete-account --no-verify-jwt`, 127.0.0.1, dwa konta testowe z podróżami, zdjęciami i awatarami):** zły nick 403 i pliki zostają; zły token 401; poprawny nick (z cudzym `userId` w treści) 200, konto, podróże i pliki znikają, drugie konto nietknięte; ponowienie tym samym tokenem 200; GET 405; dane testowe usunięte · **R1:** `serve` buduje funkcję z importem `src/schemas/account.ts` i `zod` przez `deno.json`; CLI nie ma bundla bez wdrożenia, więc resztę potwierdza krok 12 · verifier: FAIL (adapter bez testów, test prawdziwy z definicji), po poprawkach PASS · do kroku 12: czy hostowane `verify_jwt` przepuszcza token usuniętego konta · konto bez wiersza `profiles` dostaje 403, ale taki użytkownik nie ma dostępu do ustawień, bo bramka trzyma go na onboardingu; zostawione · skille: supabase, source-driven-development, security-and-hardening, doubt-driven-development, test-driven-development.
- Krok 7 (2026-11-02): testy napisane (red ✓: moduł, odczyt zapisanego języka; testy startu `_layout` i błędu odczytu dopisane po FAIL, zielone od razu, bo zachowanie już było) · `src/i18n/index.ts` (`resolveLanguage`), `src/hooks/usePreferences.ts` (`applyThemePreference`, stan lokalny), wywołanie na poziomie modułu w `_layout.tsx` · web: `Appearance.setColorScheme` tam nie ma, więc motyw na web idzie za przeglądarką (strażnik z komentarzem `shortcut:`), język działa · błąd zapisu jest cichy: wybór działa do końca sesji · green ✓: 166 zestawów, 3441 testów, typecheck, lint · verifier: FAIL (start na web, brak testu startu), po poprawkach PASS · **niestabilny test poza tym zadaniem:** `TripsDrawer ... skeleton pulse` (`TripsDrawer.test.tsx:340`) czasem pada pod obciążeniem pełnego zestawu (0.567 zamiast 0.5), sam przechodzi · M1–M2 przesunięte do kroku 12, bo przełączniki powstają w kroku 8 · użyty skill: source-driven-development, test-driven-development.
- Krok 8 (2026-11-02): testy napisane (red ✓: 0 z 9 przed kodem) · `SettingsScreen.tsx` na motywie Sunline, jedna lista z sekcjami według D7, klucze `settings.*` pl/en · 3 istniejące testy przeniesione z wartości legacy na Sunline (A8; gutter 360 → 390 według §9.0), asercje równie mocne · green ✓: 3450 testów, typecheck, lint; `TripsDrawer ... skeleton pulse` pada przez część przebiegów (znany, poza zadaniem) · verifier: FAIL (literał przezroczystości), po poprawce PASS · `/edit-profile` działa dopiero po kroku 9 · do M3: czy „Systemowy” mieści się w 1/3 kontrolki przy 320 dp i dużej czcionce · użyty skill: frontend-design, frontend-ui-engineering, test-driven-development, ui-taste (przegląd w kodzie, wizualny na urządzeniu w kroku 12).
- Krok 9 (2026-11-02): testy napisane (red ✓: 9 testów, brak `EditProfileScreen`; test normalizacji dopisany po verifierze, zielony od razu) · `EditProfileScreen.tsx`, trasa `/edit-profile`, `useUpdateProfile` w `src/hooks/useProfile.ts` (plik spoza listy planu) · nagłówek bez tytułu, bo tytuł jest w `AuthFormScreen` · green ✓: 3459 testów poza `TripsDrawer ... skeleton pulse`, typecheck, lint · verifier: PASS · użyty skill: frontend-ui-engineering, test-driven-development.
- Krok 10 (2026-11-02): testy napisane (red ✓ dla pierwszej wersji: `usePickAvatar` 5, `AvatarViewer` 13, `ProfileScreenAvatar` 7, brak modułów lub przycisku; **dla poprawek po FAIL zapisu red nie ma**, bo implementator nie przysłał raportu, testy potwierdził verifier w kodzie) · `usePickAvatar`, `AvatarViewer`, `AvatarSheet`, trasa `/avatar` (`fullScreenModal`), `useChangeAvatar` i `useRemoveAvatar` w `useProfile.ts` (plik spoza listy planu), kliknięcie w `ProfilePhoto` · **usunięty test** „is not tappable: the photo is no button” z `src/__tests__/app/profile.test.tsx`: D13 zmienia to zachowanie na odwrotne, zastępują go testy `ProfileScreenAvatar.test.tsx` · ustalenia: sheet zostaje otwarty podczas galerii i wysyłania, spinner tylko podczas wysyłania; fallback z parametru trasy tylko przy tym samym `avatarId`; bez `cacheKey`, bo ten sam adres podpisany i tak trafia w cache expo-image, a `avatar:<id>` z `seedQuietly` zostaje nieużywane · **poza planem:** naprawiony niestabilny `TripsDrawer ... skeleton pulse` (fake timery bez `advanceTimers`, asercje bez zmian), bo blokował zielony zestaw · green ✓: 171 zestawów, 3490 testów, dwa razy z rzędu, typecheck, lint · verifier: FAIL (token przyciemnienia, stare zdjęcie w fallbacku, spinner), po poprawkach bez uwag do kodu · do M5: picker nad otwartym Modalem na iOS · użyty skill: frontend-design, frontend-ui-engineering, test-driven-development, ui-taste (w kodzie).
- Krok 11, pierwsza próba (2026-11-02): **odrzucona.** Implementator napisał kod przed testami; verifier: FAIL (złamane TDD, tekst A5 przy nieaktualnym nicku). Kacper: przerobić od czerwieni (D15), a D16–D18 rozstrzygają pytania z tej próby. Kod usunięty z drzewa, nigdy nie był w gicie.
- Krok 10a (2026-11-02): dodany po decyzji D16 · testy napisane (red ✓: `Expected constructor: UsernameMismatchError / Received constructor: Error`) · `UsernameMismatchError`, `isUsernameMismatch` czyta `error.context`, nieczytelna treść daje zwykły błąd · green ✓: 173 zestawy, 3529 testów, typecheck, lint · verifier: PASS · użyty skill: api-and-interface-design, test-driven-development.
- Poprawka poza planem (2026-11-03): `src/test/fixtures.ts` i testy powtarzające jego daty przeszły z 2026-11 na 2099-11, bo `departureInPast` porównuje z prawdziwym zegarem i dziś padło 205 testów w 5 zestawach; same daty, asercje i schemat bez zmian · verifier: PASS · **zostaje:** `home.test.tsx` i `home-clearance.test.tsx` używają prawdziwego zegara i podróży do 2026-11-15, więc po tej dacie trzeba je sprawdzić.
- Krok 11, od nowa (2026-11-03, D15): testy napisane przed kodem (red ✓: 44 z 57, log `step11-red.log` w scratchpadzie sesji; 13 zielonych to przypadki negatywne; po uwagach verifiera kolejne 4 czerwone) · `DeleteAccountDialog`, `useDeleteAccount`, `ConfirmDialog` (`children`, `confirmDisabled`, `busy`, `KeyboardAvoidingView` tylko z `children`, D18), `Session` (`accountDeleted` tylko w pamięci, `signOutAfterDelete`), komunikat na `WelcomeScreen`, przycisk w `SettingsScreen` · **odstępstwo od listy plików:** `TextButton` dostał prop `loading` ze slotem jak `PrimaryButton`, bo D17 wymaga wskaźnika na przycisku destrukcyjnym, a komponent go nie miał; to najmniejsza zmiana, obecne użycia bez zmian, testy w `TextButton.test.tsx` · `settings-list.test.tsx`: dwa ostatnie przyciski to teraz „Wyloguj się” i „Usuń konto” (D7), zmiana wymagania · green ✓: 179 zestawów, 3583 testy, typecheck, lint · verifier: FAIL (slot w `TextButton`, nick ze spacjami, daty fixture'ów), po poprawkach PASS · użyty skill: frontend-ui-engineering, doubt-driven-development, test-driven-development · do M6: układ dwóch powodów offline, klawiatura.

## Ryzyka i otwarte pytania
### Ryzyka
- **R1 — Import schematu spoza `supabase/functions`.** Nie znalazłem w dokumentacji potwierdzenia, że bundler CLI obejmuje `src/schemas/account.ts`; dlatego ten plik importuje tylko `zod`. Krok 3 sprawdza to `serve` i próbnym bundlem przed zakończeniem. Jeśli nie zadziała: stop i pytanie do Kacpra, bo rozwiązaniem jest przeniesienie źródła schematu, a kopia złamałaby zasadę jednego źródła.
- **R2 — Częściowa awaria kasuje zdjęcia, a konto zostaje.** Nieunikniona, skoro pliki muszą zniknąć pierwsze; A4 i A5 to pokrywają.
- **R3 — Android:** `setDefaultNightMode` może odtworzyć Activity przy zmianie motywu. Sprawdza M1; jeśli gubi stan lub miga, stop i pytanie.
- **R4 — Niezgodność klucza:** projekt może używać nowych kluczy (`SUPABASE_SECRET_KEYS` obok starego `SUPABASE_SERVICE_ROLE_KEY`). Krok 12 potwierdza, który sekret jest dostępny, a `index.ts` czyta właśnie ten.
- **R5 — Sklepy:** Google Play wymaga też adresu WWW do prośby o usunięcie konta, a Sign in with Apple (gdy powstanie) odwołania tokenu. Poza tym planem, do listy przed wydaniem.

- **R6 — Polityka prywatności i regulamin** są potrzebne przed publikacją w sklepach. Kacper poda adresy; linki to wtedy osobna, mała zmiana.
- **R7 — Nick zostaje jako dana osobowa po usunięciu konta** (D11). Trzeba to ująć w przyszłej polityce prywatności.
- **R8 — wynik z kroku 2 Wydatków (2026-11-02): zostaje RESTRICT, usunięcie podróży i konta organizatora przechodzi także z wydatkami członków; krok 2 tego planu powtarza test przez `auth.users`.** Pierwotny opis: **`expenses.member_id` ma RESTRICT.** Usunięcie konta organizatora kasuje kaskadowo `trip_members` i `expenses`, a RESTRICT nie może tego zablokować, bo wtedy usunięcie konta i zwykłe usunięcie podróży kończą się błędem. Wynik zależy od działania kaskad w Postgresie, a migracji `expenses` nie ma jeszcze na zdalnych gałęziach, więc nie mogłem tego sprawdzić. Lead Wydatków testuje to w swoim kroku 2. Ten plan rusza dopiero po tym teście; krok 2 tego planu powtarza go przez usunięcie z `auth.users`. Jeśli test nie przejdzie, poprawka należy do migracji `expenses` i wraca do Kacpra.

### Otwarte pytania
Brak. P1–P7 rozstrzygnął Kacper 2026-11-02 (D5–D12).
