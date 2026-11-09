# Discover places

Entries: (1) "Odkryj miejsca" under "Utwórz podróż" in the home screen's empty state (places-legal-navbar D16) → `/discover`; (2) the „Odkryj” side of the „Plan” / „Odkryj” switch in the Plan tab, shown only with a current trip — `DiscoverScreen` renders inside the tab, above the pill (`prompts/plan-discover-switch/plan.md` D1–D7). Needs internet; offline the screen shows a banner and search is disabled.

Plan and decisions: `prompts/places-legal-navbar/plan.md` (stream C, D14–D23).

The app waits up to 45 s for `recommend-places` (D22; every other request 20 s), because the server may take Places 10 s + Gemini 20 s + photos 5 s; an abort after 45 s becomes the `offline` error kind, which the screen shows as the generic error with "Spróbuj ponownie" (the offline banner follows `useIsOffline()`, not the request), and the request still counts toward the daily limit.

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
  6. Photos (places-photo-carousel D1–D2): for the picked places only (also on the fallback), up to 3 photo names each from Nearby Search `places.photos` are resolved in parallel with Place Photos (New) (`/v1/{name}/media?maxWidthPx=1200&skipHttpRedirect=true`, key in `X-Goog-Api-Key`, 5 s) to a Google `photoUri`; a failed photo is dropped (`photo_failed {count}`), never the place.
- **Results:** `PlaceCard`s — with photos, a swipeable 4:3 carousel on top ("n/3" counter, "Fot. <autor>" credit linking to the author, memory-only image cache); then name, type with the Google rating „★ 4,6 (1234)” (hidden without a rating), address and the reason (hidden when null), "Otwórz w Mapach Google" → `Linking.openURL(googleMapsUri)`, "Dane: Google" under the list, the searches left today in the footer.
- **States:** idle, loading (skeletons), empty, error with retry, offline, daily limit (no retry).
