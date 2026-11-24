# Zadanie: PRO — animacja po subskrypcji i okno „Kup PRO” po limicie
Status: szkic (czeka na odpowiedzi P1–P4, potem pełny plan do akceptacji)

## Zrozumienie i założenia
Prośba Kacpra (2026-11-24):
- gdy ktoś zasubskrybuje PRO, pokazuje się animacja „ktoś zasubskrybował”;
- po zużyciu limitu (dziś: 5 wyszukiwań „Odkryj” / dzień — `PLACE_REQUESTS_PER_DAY`, 3 plany AI / dzień — `PLANS_PER_DAY`) pojawia się okno „Kup PRO” z listą, co daje PRO (np. częstsza zmiana planu, wyższe limity).

Stan dziś (`prompts/revenuecat/`): PRO kupuje się z banera w Ustawieniach przez paywall RevenueCat; PRO nic jeszcze nie odblokowuje. Serwer nie wie, kto ma PRO (R3), więc wyższe limity dla PRO wymagają najpierw webhooka RevenueCat → Supabase (tabela z uprawnieniem + RLS) i odczytu tego w `generate-trip-plan` i `recommend-places`.

## Otwarte pytania (do Kacpra)
- **P1.** Animacja „ktoś zasubskrybował” — dla kogo?
  (a) dla osoby, która właśnie kupiła PRO (podziękowanie / konfetti w aplikacji) — rekomendacja;
  (b) dla nas (powiadomienie dla Ciebie jako twórcy o nowym subskrybencie);
  (c) oba.
- **P2.** Limity PRO: ile planów AI i wyszukiwań „Odkryj” dziennie dla PRO (np. 10 planów, 20 wyszukiwań)? Czy coś jeszcze odblokowuje PRO?
- **P3.** Okno „Kup PRO”: (a) własny arkusz w stylu Sunline z listą korzyści i przyciskiem, który otwiera paywall RevenueCat — rekomendacja; (b) od razu paywall RevenueCat (jego wygląd, nie Sunline).
- **P4.** Animacja: Lottie (jak splash) czy prosta animacja Reanimated; z wyłączeniem przy „ogranicz ruch”.

## Kroki
(po odpowiedziach: szkic planner → podział na fale przez task-planner → akceptacja)
