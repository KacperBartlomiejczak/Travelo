# Zadanie: Przełącznik „Plan” / „Odkryj” w zakładce Plan
Status: szkic — czeka na odpowiedzi na pytania i akceptację Kacpra (2026-11-07)

## Zrozumienie i założenia
Kacper chce w zakładce „Plan” przełącznik o dwóch stanach (w stylu włącznika, nie listy ani paska zakładek), który przełącza widok między „Plan” a „Odkryj” i z powrotem.

Stan dziś (sprawdzony w kodzie):
- `/plan` (`src/app/(drawer)/(tabs)/plan.tsx`) to **placeholder**: `EmptyScreen` z tytułem „Plan” i „Ten ekran pojawi się wkrótce.” (pill-nav-and-dialog D3). Plany dnia AI jeszcze nie istnieją.
- „Odkryj miejsca” (`/discover`, `DiscoverScreen`) to osobny ekran w root stacku, nad szufladą, bez pigułki, z przyciskiem wstecz. **Jedyne wejście** to przycisk w pustym stanie ekranu „Podróż” (places-legal-navbar **D16**) — nie z zakładki Plan, jak zakładał brief.
- Jest gotowy `SegmentedControl` (design-context §8.15: tor 44 dp, `background.sunken`, wybrany segment `surface.elevated` + cień / ramka w dark, `radiogroup` / `radio` dla czytników). Używają go kreator (lot tam / powrót, budżet) i Ustawienia. Komponentu „switch” w projekcie nie ma.

Co znaczy „gotowe”: na ekranie Plan widać przełącznik; „Plan” pokazuje dzisiejszy placeholder, „Odkryj” pokazuje Discover (formularz, wyniki, wszystkie jego stany) bez wychodzenia z zakładki; powrót przełącznikiem; pigułka nie zasłania treści; testy, `pnpm typecheck`, `pnpm lint` zielone; verifier PASS; docs zaktualizowane.

Założenia (do potwierdzenia przy akceptacji):
- **Z1** — to zmienia D16: Discover dostaje drugie wejście (zakładka Plan). Przycisk w pustym stanie „Podróż” i trasa `/discover` zostają bez zmian.
- **Z2** — przełącznik zawsze startuje na „Plan”; wybór nie jest zapamiętywany między uruchomieniami (bez AsyncStorage). Przełączenie innej zakładki pigułki i powrót zachowuje wybór (ekrany zakładek zostają zamontowane).
- **Z3** — nie dotykam karty miejsca, `src/schemas/place.ts` ani `recommend-places` (inna sesja przerabia kartę na karuzelę zdjęć). Cel: `DiscoverScreen.tsx` bez zmian albo z jedną minimalną zmianą (patrz R1).
- **Z4** — bez nowych zależności, bez zmian w Zod, Supabase i danych.

### Pytania do Kacpra (jedno po drugim; rekomendacja pierwsza)
- **P1 — Gdzie stoi przełącznik?**
  (a) **na górze treści ekranu, zamiast tytułu „Plan”** — zakładki nie mają nagłówka (`headerShown: false`), więc to najprostsze i spójne z resztą (rekomendacja);
  (b) w nowym nagłówku ekranu (jak `/discover` czy Ustawienia) — dodaje pasek, którego inne zakładki nie mają;
  (c) przypięty nad pigułką na dole — bliżej kciuka, ale konkuruje z pigułką.
- **P2 — Discover w zakładce czy dalej osobny ekran?**
  (a) **renderowany w zakładce Plan pod przełącznikiem** — przełącznik zmienia treść w miejscu, pigułka zostaje (rekomendacja; tak działa „light switch”);
  (b) przełącznik na „Odkryj” otwiera `/discover` jak dziś (nowy ekran z „wstecz”) — wtedy przełącznik „z powrotem” musiałby być też na `/discover`, czyli dwa przełączniki i dziwna nawigacja.
- **P3 — Czy przełącznik widać, gdy plan jest pusty?** Dziś Plan jest zawsze „pusty” (placeholder), więc:
  (a) **zawsze widoczny** (rekomendacja — inaczej nie byłoby go wcale);
  (b) widoczny tylko gdy podróż ma plan — sensowne dopiero po AI day plans.
- **P4 — Wygląd przełącznika:**
  (a) **istniejący `SegmentedControl` z dwiema opcjami, bez zmian** — wygląda jak pigułkowy przełącznik z „kciukiem” na wybranej stronie, zero nowego komponentu (rekomendacja);
  (b) `SegmentedControl` z przesuwającym się kciukiem (animacja) — zmiana obejmie też kreator i Ustawienia;
  (c) nowy komponent `ModeSwitch` tylko dla tego ekranu (np. węższy, wyśrodkowany, inny kolor kciuka — `brand.primary`?) — więcej kodu i decyzji wizualnych; potrzebny opis/zrzut, jak ma wyglądać.
- **P5 — Etykiety:** (a) **„Plan” / „Odkryj”** (en „Plan” / „Discover”); „Plan” z istniejącego `nav.plan`, nowy klucz na „Odkryj” (rekomendacja); (b) „Plan” / „Odkryj miejsca” (dłuższe, może się zmniejszać czcionka w 50 % szerokości).
- **P6 — Animacja przy przełączeniu:**
  (a) **brak** — treść podmienia się od razu, kciuk przeskakuje (rekomendacja przy P4a; nic do wyłączania przy „ogranicz ruch”);
  (b) kciuk przesuwa się w `motion.duration.standard`, a przy „ogranicz ruch” (`useReduceMotion`) przeskakuje od razu / crossfade ≤ 80 ms (§13.10) — tylko przy P4b lub P4c.

### Decyzje (Kacper)
- (brak — czeka na odpowiedzi P1–P6)

## Podejście
Przy rekomendacjach (P1a, P2a, P3a, P4a, P5a, P6a):
- `PlanScreen` trzyma `useState<'plan' | 'discover'>('plan')` i renderuje `SegmentedControl` na górze, pod nim `'plan'` → treść dzisiejszego placeholdera („Ten ekran pojawi się wkrótce.”), `'discover'` → `<DiscoverScreen />`.
- `EmptyScreen` dostaje (jeśli potrzeba) miejsce na przełącznik zamiast tytułu, albo `PlanScreen` składa ten sam układ sam (safe area, marginesy 20/16 dp, `maxContentWidth`, odstęp od pigułki `usePillClearance`). Wybór dokładnej formy zostawiam frontendowi w granicach: bez zmiany wyglądu innych użyć `EmptyScreen`.
- Discover w zakładce musi kończyć się nad pigułką (R1).

*Odrzucone:* nowa trasa / zagnieżdżony stack w zakładce Plan (`/plan/discover`) — nawigacja zamiast przełącznika, więcej plików, a „wstecz” nie pasuje do włącznika.

## Struktury danych (Zod)
Brak. Wybór trybu to lokalny stan UI (`'plan' | 'discover'`), nie przekracza żadnej granicy — nie ma czego walidować.

## Testy
**Krok 1 — `src/app/(drawer)/(tabs)/__tests__/plan.test.tsx`** (lub obok istniejących testów ekranów zakładek; napisane najpierw i widziane na czerwono):
1. Ekran pokazuje przełącznik (`radiogroup` z etykietą) z opcjami „Plan” i „Odkryj”; „Plan” wybrany (`aria-checked`), widać „Ten ekran pojawi się wkrótce.”, nie widać formularza Discover.
2. Tap „Odkryj” → wybrany „Odkryj”, widać formularz Discover (pole miasta, „Znajdź miejsca”), placeholder znika.
3. Tap „Plan” → powrót do placeholdera.
4. Tap w już wybraną opcję nic nie zmienia.
5. Discover w zakładce zachowuje swoje stany — jeden test dymny: offline → baner i wyłączone „Znajdź miejsca” (reszta stanów jest już pokryta w `src/features/discover/__tests__`).
6. Treść ma dolny odstęp od pigułki (`usePillClearance`) w obu trybach.
7. i18n: obie etykiety istnieją w `pl.json` i `en.json` (wzorzec istniejących testów kluczy, jeśli jest).
- Istniejące testy `EmptyScreen`, `DiscoverScreen`, ekranu „Podróż” (wejście D16) zostają bez zmian i zielone.

## Pliki
- Zmienione: `src/app/(drawer)/(tabs)/plan.tsx`; ewentualnie `src/features/nav/EmptyScreen.tsx` (slot na przełącznik) lub nowy `src/features/plan/PlanScreen.tsx`, jeśli logika nie zmieści się czytelnie w pliku trasy; `src/i18n/locales/pl.json`, `en.json` (klucz „Odkryj” + etykieta przełącznika dla czytnika, np. „Widok ekranu Plan”).
- Możliwe (R1): `src/features/discover/DiscoverScreen.tsx` — tylko przekazanie dolnego odstępu, bez dotykania `PlaceCard`.
- Nowe: test z kroku 1.
- Docs (krok 2): `docs/architecture/frontend.md` (wiersz `/plan`, wiersz `/discover` — drugie wejście), `docs/architecture/flows/features/discover-places.md` (wejścia), `context/app-context.md` (§3.1, roadmapa), `docs/architecture/decisions.md` (zmiana D16), ten plan.

## Skille
- `test-driven-development` — krok 1 (red → green).
- `frontend-ui-engineering` — krok 1 (dostępność przełącznika, stany).
- Inne: brak.

## Kroki
- [ ] **1. [frontend]** Przełącznik „Plan” / „Odkryj” w `PlanScreen` + Discover w zakładce (testy najpierw) → verifier.
- [ ] **2. [orchestrator]** Docs (lista w „Pliki”) + ten plan → verifier.
- [ ] **3. [tester]** Na telefonie/emulatorze: przełączanie w obie strony; Discover w zakładce — wyszukanie miasta, wyniki, przewinięcie do końca nad pigułką, offline; zmiana zakładki pigułki i powrót zachowuje tryb; jasny i ciemny motyw; duża czcionka (etykiety w jednej linii); TalkBack czyta „Plan, wybrane / Odkryj”.
- [ ] **4.** Verifier całej gałęzi (CodeRabbit), commit, PR do `feature/discover-places`.

## Weryfikacja
Każdy krok: `pnpm test`, `pnpm typecheck`, `pnpm lint` zielone, verifier PASS przed `[x]`. Krok 3: tester wg scenariuszy wyżej.

## Dziennik postępu
- 2026-11-07 — szkic planu, pytania P1–P6.

## Ryzyka i otwarte pytania
- **R1 — Discover pod pigułką.** `DiscoverScreen` stoi na `AuthFormScreen` i był projektowany jako ekran bez pigułki; w zakładce dół listy wyników i stopka („Dane: Google”, limit dzienny) mogą schować się pod pigułką. Może wymagać jednej zmiany w `DiscoverScreen.tsx` (dolny odstęp) — ten sam plik, w którym inna sesja przerabia `PlaceCard`, więc grozi konflikt przy merge'u. Ograniczam zmianę do propsa/odstępu poza `PlaceCard`; przy konflikcie scalam ręcznie.
- **R2 — Podwójny nagłówek / „wstecz”.** `/discover` ma nagłówek z „wstecz” z root stacku; w zakładce go nie będzie (i nie powinno być). Do sprawdzenia, czy `DiscoverScreen` sam w sobie nie zakłada nagłówka (np. odstęp od góry / safe area).
- **R3 — Zmiana D16** (Z1) — wymaga Twojego potwierdzenia.
- Pytania P1–P6 wyżej.
