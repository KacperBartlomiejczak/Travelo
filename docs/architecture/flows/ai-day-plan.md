# AI day plan flow

## Rules
- **Provider: Google Gemini** through the Gemini API, with the key from Google AI Studio. The key lives only in Edge Function secrets.
- **Model ID comes from config** (Edge Function env), never hardcoded. Use a fast, low-cost model for day plans unless Kacper decides otherwise.
- **Structured output:** use Gemini's JSON-schema structured output with the schema **generated from Zod**, then still parse the response with Zod. Check the current `@google/genai` docs for the exact parameter names before writing the call.
- **Free vs paid tier:** the AI Studio free tier has different data-use terms and rate limits than the paid tier. Do not ship to real users on the free tier without Kacper's explicit decision.
- The model **never invents places**. Flow: fetch real candidates from Google Places → model selects and orders them by `placeId` → output validated with Zod → reject any `placeId` not in the candidate set.
- Prices are **estimates shown as ranges**, never exact amounts.
- API keys never ship in the app. All LLM and Google calls go through Edge Functions.
- Rate-limit AI calls per user and cache results.

## What is implemented
- AI trip plan (whole trip, plain list; `prompts/ai-trip-plan/plan.md`): see [features/ai-trip-plan.md](features/ai-trip-plan.md). Cost ranges, locked activities and group splits are not implemented.
