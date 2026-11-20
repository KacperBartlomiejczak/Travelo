# Discover places

Entries: (1) "Discover places" under "Create trip" in the home screen's empty state (places-legal-navbar D16) → `/discover`; (2) the "Discover" side of the "Plan" / "Discover" switch in the Plan tab, shown only with a current trip — `DiscoverScreen` renders inside the tab, above the pill (`prompts/plan-discover-switch/plan.md` D1–D7). Needs internet; offline the screen shows a banner and search is disabled.

Plan and decisions: `prompts/places-legal-navbar/plan.md` (stream C, D14–D23).

The app waits up to 45 s for `recommend-places` (D22; every other request 20 s), because the server may take Places 10 s + Gemini 20 s + photos 5 s; an abort after 45 s becomes the `offline` error kind, which the screen shows as the generic error with "Try again" (the offline banner follows `useIsOffline()`, not the request), and the request still counts toward the daily limit.

- **Form** (`DiscoverScreen`):
  1. City: `AirportField` — the airport's `city`, `latitude`, `longitude` (D19). Works offline (bundled airport list). In the Plan tab it starts on the current trip's destination (`overview.trip.destination` → `findAirport`); unknown IATA → empty (`prompts/trip-recommendations/plan.md` D3).
  2. Interests: only from the profile (`useMyProfile`), not editable on the screen (trip-recommendations D4). While the profile loads → skeletons; profile error → a note and search disabled.
  3. The request is parsed with `RecommendPlacesRequestSchema` (`locale` from i18n) before "Find places" is enabled.
- **Auto-load** (Plan tab only, trip-recommendations D1, D5, D6): with the destination airport, no manual pick, the profile loaded and online, the search runs without a button press; offline it waits and runs once when the connection returns. Reopening "Discover" with the same request is a cache hit. A manually picked city searches only on "Find places"; until then (and while typing) the previous city's cards, empty message and error are hidden — the daily-limit message and the searches-left note stay (trip-recommendations D14); a new trip destination drops the manual pick and loads the new one. `/discover` never auto-loads.
- **Fetch** (`usePlaceRecommendations` → `fetchAppPlaceRecommendations` (`src/data/app-places.ts`) → `fetchPlaceRecommendations` (`src/data/places.ts`)):
  1. `supabase.functions.invoke('recommend-places')` with the request.
  2. The response is parsed with `RecommendPlacesResponseSchema`; a bad shape → `PlacesError('failed')`.
  3. Errors map to `PlacesError` kinds: no connection → `offline`; 429 `limit_reached` → `limit_reached`; 401 / `unauthorized` → `unauthorized`; anything else → `failed`.
  - `useQuery` keyed by the request (city lowercased, latitude, longitude, interests sorted, locale), enabled only after a search, `staleTime` / `gcTime` Infinity, no retries or refetches: the same search in one session is a cache hit and costs nothing. Memory only — Google allows storing just `placeId`, and the app persists no query cache.
- **Server** (`recommend-places`, see `backend.md`):
  1. User from the JWT; body parsed with Zod.
  2. One unit of the daily quota (`consume_ai_quota`, 5 per user per UTC day) before any Google call; not refunded on a later failure.
  3. Google Places Nearby Search (New): candidates of the place types mapped from the interests, within 20 km (`SEARCH_RADIUS_METERS`), at most 20 results. A Nearby failure → 502 `upstream_failed`. No candidates → 200 with no places; Gemini is not called, but the quota is still spent.
  4. Gemini picks ≤ 10 candidates by `placeId` and writes a reason in the request's language; ids outside the candidates are dropped (the model never invents places).
  5. If Gemini fails, the candidates come back without reasons (`reason: null`), and the failure is logged (`gemini_fallback`).
  6. Photos (places-photo-carousel D1–D2): for the picked places only (also on the fallback), up to 3 photo names each from Nearby Search `places.photos` are resolved in parallel with Place Photos (New) (`/v1/{name}/media?maxWidthPx=1200&skipHttpRedirect=true`, key in `X-Goog-Api-Key`, 5 s) to a Google `photoUri`; a failed photo is dropped (`photo_failed {count}`), never the place.
- **Results:** `PlaceCard`s — with photos, a swipeable 4:3 carousel on top ("{{index}}/{{count}}" counter, a "Photo: {{names}}" credit linking to the author, memory-only image cache); then name, type with the Google rating (a star and the number formatted for the app language, labelled "Rated {{rating}} out of 5"; hidden without a rating), address and the reason (hidden when null), "Open in Google Maps" → `Linking.openURL(googleMapsUri)`, "Data: Google" under the list, "Searches left today: {{count}}" in the footer.
- **States:** idle, loading (skeletons), profile error ("We couldn't load your interests."), empty ("We found no places in this city. Try another city."), error with retry, offline (a banner, "You're offline. Finding places needs internet.", and search disabled; not a result state), daily limit ("You've used today's searches. Come back tomorrow.", no retry).
