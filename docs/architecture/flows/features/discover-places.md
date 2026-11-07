# Discover places

Entries: (1) "Odkryj miejsca" under "Utwórz podróż" in the home screen's empty state (places-legal-navbar D16) → `/discover`; (2) the „Odkryj” side of the „Plan” / „Odkryj” switch in the Plan tab, shown only with a current trip — `DiscoverScreen` renders inside the tab, above the pill (`prompts/plan-discover-switch/plan.md` D1–D7). Needs internet; offline the screen shows a banner and search is disabled.

Plan and decisions: `prompts/places-legal-navbar/plan.md` (stream C, D14–D21).

- **Form** (`DiscoverScreen`):
  1. City: `AirportField` — the airport's `city`, `latitude`, `longitude` (D19). Works offline (bundled airport list).
  2. Interests: prefilled from the profile, editable with `InterestChips`, at least one.
  3. The request is parsed with `RecommendPlacesRequestSchema` (`locale` from i18n) before "Znajdź miejsca" is enabled.
- **Fetch** (`usePlaceRecommendations` → `fetchAppPlaceRecommendations` → `fetchPlaceRecommendations`, `src/data/places.ts`):
  1. `supabase.functions.invoke('recommend-places')` with the request.
  2. The response is parsed with `RecommendPlacesResponseSchema`; a bad shape → `PlacesError('failed')`.
  3. Errors map to `PlacesError` kinds: no connection → `offline`; 429 `limit_reached` → `limit_reached`; 401 / `unauthorized` → `unauthorized`; anything else → `failed`.
  - `useQuery` keyed by the request (city lowercased, interests sorted, locale), enabled only after a search, `staleTime` / `gcTime` Infinity, no retries or refetches: the same search in one session is a cache hit and costs nothing. Memory only — Google allows storing just `placeId`, and the app persists no query cache.
- **Server** (`recommend-places`, see `backend.md`):
  1. User from the JWT; body parsed with Zod.
  2. One unit of the daily quota (`consume_ai_quota`, 5 per user per UTC day) before any Google call; not refunded on a later failure.
  3. Google Places Nearby Search (New): candidates of the place types mapped from the interests.
  4. Gemini picks ≤ 10 candidates by `placeId` and writes a reason in the request's language; ids outside the candidates are dropped (the model never invents places).
  5. If Gemini fails, the candidates come back without reasons (`reason: null`), and the failure is logged (`gemini_fallback`).
- **Results:** cards with name, type, address and the reason (hidden when null), "Otwórz w Mapach Google" → `Linking.openURL(googleMapsUri)`, "Dane: Google" under the list, the searches left today in the footer.
- **States:** idle, loading (skeletons), empty, error with retry, offline, daily limit (no retry).
