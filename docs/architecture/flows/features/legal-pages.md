# Legal pages (privacy policy and terms of use)

Entry: the "Terms of Use" and "Privacy Policy" links on the sign-in sheet, and the "Privacy policy" and "Terms of use" rows in Settings. Works offline: the text is bundled in the app, nothing is fetched.

- **Route and screen:** `/legal/[doc]` (`src/app/legal/[doc].tsx`) renders `LegalScreen` (`src/features/legal/LegalScreen.tsx`). The route sits outside every `Stack.Protected` guard in `src/app/_layout.tsx`, so it opens both signed out and signed in. The header back button calls `router.back()` when possible, otherwise `router.replace('/')`.
- **Schema** (`src/schemas/legal.ts`): `LegalDocSchema` is `'privacy' | 'terms'`. `LegalDocumentSchema` requires `title`, `updated` and at least one section (`heading`, `paragraphs[]`); an empty heading is an intro without a title.
- **Text:** read from i18n (`t('legal.<doc>', { returnObjects: true })`) and validated with `LegalDocumentSchema.safeParse`. There is no per-document language switch: the text follows the app language (see `resolveLanguage` in `src/i18n/index.ts`), falling back to English.
- **Entry points:** `SignInSheet` closes the sheet and pushes `/legal/<doc>` (testID `sign-in-legal-links`); `SettingsScreen` pushes `/legal/privacy` and `/legal/terms` and these rows are not offline-gated. The paywall has no legal link.
- **States:** no loading state. An unknown `doc`, or text that fails validation, shows `FullScreenError` (testID `legal-error`, "Couldn't load this document." with "Back"). Content (testID `legal-screen`): the title, the version line (for example "Version of 6 November 2026") and the sections.
- **Published copies** (not used by the app): `docs/legal/privacy-policy.{pl,en}.md` and `docs/legal/terms.{pl,en}.md`, built into GitHub Pages by `.github/workflows/legal-pages.yml` on pushes to `main` that touch `docs/legal/**`. When a document changes, the Markdown files and the i18n keys must be changed by hand (`docs/legal/README.md`); no test checks that they match.
- **Tests:** `src/__tests__/app/legal.test.tsx` (pl/en, privacy/terms, unknown doc, signed-out access, back button, Settings links) and `src/schemas/__tests__/legal.test.ts`.
