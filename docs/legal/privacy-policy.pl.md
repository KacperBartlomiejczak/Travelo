# Polityka prywatności aplikacji Travelo

Wersja z 6 listopada 2026 r.

Ta polityka wyjaśnia, jakie dane osobowe przetwarza aplikacja mobilna Travelo („Aplikacja”), po co, jak długo i jakie masz prawa.

## 1. Administrator danych

Administratorem Twoich danych osobowych jest **Kacper Bartłomiejczak**, osoba fizyczna, Polska („my”, „Administrator”).

We wszystkich sprawach dotyczących danych osobowych napisz na: **kacperbartlomiejczak@proton.me**.

Nie wyznaczyliśmy inspektora ochrony danych — nie mamy takiego obowiązku.

## 2. Jakie dane przetwarzamy

### 2.1 Konto i logowanie
- Logowanie przez **Google**: adres e-mail i identyfikator konta Google, które Google przekazuje nam po Twojej zgodzie na ekranie logowania.
- Logowanie przez **Discord**: adres e-mail i identyfikator konta Discord.
- Logowanie **e-mailem**: adres e-mail, na który wysyłamy 6-cyfrowy kod.
- Dane techniczne logowania: data i godzina logowania, adres IP i informacje o urządzeniu zapisywane w logach serwera.

Nie znamy i nie przechowujemy Twojego hasła do Google ani Discorda.

### 2.2 Profil
- Nick (unikalny), wybrane zainteresowania, opcjonalne zdjęcie profilowe.
- Kod znajomego (6 znaków), nadawany automatycznie. Osoba, która zna Twój kod, może zobaczyć Twój nick i zainteresowania i dodać Cię do swojej podróży jako znajomego z kontem.

### 2.3 Podróże
- Nazwa podróży, zdjęcie okładki, loty (lotniska, daty i godziny, opcjonalnie numer lotu), dzienny budżet i waluta.
- **Znajomi bez konta:** imię (lub inne oznaczenie) i zainteresowania osób, które dodajesz do podróży. Te osoby nie mają konta w Aplikacji. Dodawaj je tylko wtedy, gdy wiedzą, że korzystasz z ich danych do zaplanowania wspólnej podróży.
- **Znajomi z kontem:** jeśli dodasz osobę po jej kodzie znajomego, widzi ona podróż (bez możliwości jej zmiany) i może dodawać własne wydatki. Ty widzisz jej nick i zainteresowania.

### 2.4 Zdjęcia
- Zdjęcia, które dodajesz do podróży, oraz zdjęcie profilowe.
- Przed wysłaniem Aplikacja zmniejsza zdjęcie i zapisuje je ponownie **bez metadanych EXIF**, więc **bez lokalizacji GPS**, modelu aparatu itp. Zachowujemy tylko datę wykonania zdjęcia (do ułożenia zdjęć w kolejności).
- Zdjęcia są w prywatnym magazynie plików; widzą je tylko osoby z dostępem do danej podróży (zdjęcie profilowe — tylko Ty).

### 2.5 Wydatki
- Nazwa, kwota, waluta, kategoria i dzień wydatku oraz osoba, która go poniosła (Ty albo znajomy z podróży).

### 2.6 Odkrywanie miejsc (AI)
- Gdy korzystasz z „Odkryj miejsca”, wysyłamy do Google **tylko nazwę miasta i listę zainteresowań**. Nie wysyłamy Twojego nicku, e-maila, zdjęć, imion znajomych ani lokalizacji urządzenia.
- Zapisujemy licznik zapytań w danym dniu (limit 5 dziennie na konto), żeby chronić usługę przed nadużyciem.

### 2.7 Dane tylko na telefonie
Aplikacja trzyma na telefonie kopię Twoich podróży, profilu i wydatków, żeby działała bez internetu, a także wybór motywu i języka. Przy wylogowaniu i usunięciu konta kopia danych jest kasowana z telefonu (motyw i język zostają).

Aplikacja **nie używa** narzędzi reklamowych ani analitycznych i **nie śledzi** Twojej lokalizacji.

## 3. Cele i podstawy prawne

| Cel | Podstawa prawna (RODO) |
|---|---|
| Założenie i prowadzenie konta, logowanie, profil | art. 6 ust. 1 lit. b — wykonanie umowy (regulaminu) |
| Planowanie podróży, zdjęcia, wydatki, synchronizacja między telefonem a serwerem | art. 6 ust. 1 lit. b — wykonanie umowy |
| Przetwarzanie danych znajomych bez konta, które wpisujesz | art. 6 ust. 1 lit. f — prawnie uzasadniony interes: umożliwienie Ci zaplanowania wspólnej podróży |
| Odkrywanie miejsc (miasto + zainteresowania) | art. 6 ust. 1 lit. b — wykonanie umowy |
| Bezpieczeństwo, logi, limit zapytań AI, zapobieganie nadużyciom | art. 6 ust. 1 lit. f — prawnie uzasadniony interes: bezpieczeństwo usługi |
| Odpowiedzi na wiadomości, reklamacje, obrona przed roszczeniami | art. 6 ust. 1 lit. f oraz art. 6 ust. 1 lit. c (obowiązki z prawa konsumenckiego) |

Podanie danych jest dobrowolne, ale bez adresu e-mail (lub konta Google/Discord) i nicku nie da się założyć konta.

Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywołują skutki prawne lub podobnie istotnie na Ciebie wpływają. Rekomendacje miejsc od AI to tylko propozycje.

## 4. Komu przekazujemy dane

- **Supabase Inc.** — hosting bazy danych, logowania, plików i funkcji serwerowych (podmiot przetwarzający na podstawie umowy powierzenia). Dane są przechowywane w regionie **[DO UZUPEŁNIENIA: region projektu Supabase]**.
- **Google** — (a) jeśli logujesz się przez Google: Google jako osobny administrator uwierzytelnia Cię i przekazuje nam e-mail; (b) Google Places API i Gemini API dostają **tylko miasto i zainteresowania** z zapytania „Odkryj miejsca”. Zapytanie wysyła nasz serwer, nie Twój telefon. Używamy płatnej wersji Gemini API, w której Google nie wykorzystuje zapytań do trenowania modeli.
- **Discord Inc.** — jeśli logujesz się przez Discord, jako osobny administrator.
- **Znajomi z kontem**, których dodasz do podróży lub którzy dodali Ciebie — widzą dane tej podróży (patrz 2.3).
- Organy publiczne — tylko gdy wymaga tego prawo.

Nie sprzedajemy danych i nie udostępniamy ich do celów marketingowych.

## 5. Przekazywanie poza Europejski Obszar Gospodarczy

Supabase, Google i Discord to firmy z USA. Jeśli dane trafiają poza EOG, odbywa się to na podstawie decyzji Komisji Europejskiej o odpowiednim stopniu ochrony (EU-US Data Privacy Framework) albo standardowych klauzul umownych (art. 46 RODO). Kopię zabezpieczeń możesz otrzymać, pisząc na adres z punktu 1.

## 6. Jak długo przechowujemy dane

- Dane konta, profilu, podróży, zdjęć i wydatków — **do usunięcia konta** (albo wcześniejszego usunięcia przez Ciebie danej podróży, zdjęcia czy wydatku).
- Po usunięciu konta dane są kasowane od razu z bazy i magazynu plików. Kopie zapasowe dostawcy mogą je zawierać jeszcze przez ograniczony czas wynikający z cyklu kopii, po czym są nadpisywane.
- Wyjątek: w **cudzych podróżach**, do których należysz, Twój nick i Twoje wydatki zostają jako „znajomy bez konta”, bo są częścią podróży innej osoby.
- Licznik zapytań AI — przez dobę, której dotyczy, i krótko potem.
- Logi techniczne — przez okres ustawiony przez dostawcę hostingu, zwykle kilka dni.
- Korespondencja z nami — do czasu załatwienia sprawy, a jeśli dotyczy reklamacji lub roszczeń — do upływu terminu przedawnienia.

## 7. Twoje prawa

Masz prawo do:
- dostępu do swoich danych i otrzymania ich kopii,
- sprostowania danych (nick i zainteresowania zmienisz sam w „Edytuj profil”),
- usunięcia danych,
- ograniczenia przetwarzania,
- przenoszenia danych,
- sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,
- wniesienia skargi do **Prezesa Urzędu Ochrony Danych Osobowych** (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).

Aby skorzystać z praw, napisz na adres z punktu 1. Odpowiemy w ciągu miesiąca.

Jeśli jesteś osobą dodaną do czyjejś podróży bez konta i chcesz usunięcia swoich danych, napisz do nas albo poproś organizatora, żeby Cię usunął.

## 8. Usunięcie konta

Konto usuniesz sam w Aplikacji: **Profil → Ustawienia → Usuń konto** (wymaga internetu). Usunięcie kasuje konto, profil, zdjęcie profilowe i wszystkie podróże, których jesteś organizatorem, razem z ich wydatkami i zdjęciami — także dla dodanych znajomych. Możesz też poprosić o usunięcie konta e-mailem.

## 9. Bezpieczeństwo

Połączenia są szyfrowane (HTTPS). Dostęp do danych w bazie ograniczają reguły bezpieczeństwa na poziomie wierszy — każdy widzi tylko swoje dane i podróże, do których należy. Zdjęcia są w prywatnym magazynie i pokazywane przez linki ważne godzinę. Klucze do usług zewnętrznych są tylko na serwerze.

## 10. Wiek

Aplikacja jest przeznaczona dla osób, które ukończyły 16 lat.

## 11. Zmiany polityki

O istotnych zmianach poinformujemy w Aplikacji przed ich wejściem w życie. Aktualna wersja jest zawsze dostępna w Aplikacji i pod adresem publicznym tej polityki.
