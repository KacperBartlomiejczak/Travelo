# Legal documents

Privacy policy and terms of use, Polish and English:

- `privacy-policy.pl.md`, `privacy-policy.en.md`
- `terms.pl.md`, `terms.en.md`

The in-app screen `/legal/[doc]` shows the same text from i18n keys (`legal.*` in `src/i18n/locales/{pl,en}.json`). When a document changes, change both the file here and the i18n keys, and bump the version date.

## Public URLs (GitHub Pages, D13)

`.github/workflows/legal-pages.yml` builds this folder with Jekyll (`_config.yml`, `README.md` excluded) and deploys it on every push to `main` that touches `docs/legal/`, or by hand (Actions → Legal pages → Run workflow).

- https://kacperbartlomiejczak.github.io/Travelo/privacy-policy.pl.html
- https://kacperbartlomiejczak.github.io/Travelo/privacy-policy.en.html
- https://kacperbartlomiejczak.github.io/Travelo/terms.pl.html
- https://kacperbartlomiejczak.github.io/Travelo/terms.en.html

One-time setup (repo owner): GitHub → repo `Travelo` → Settings → Pages → Build and deployment → Source: **GitHub Actions**. The pages go live after the workflow first runs on `main`.

## Note for Kacper (not for users)

These texts were drafted by an AI assistant from what the app does (plan `prompts/places-legal-navbar/plan.md`, D12, D13, D17). They are not legal advice. **Have a lawyer review them before publishing**, in particular:

- **Address (art. 5 of the Polish e-services act, ustawa o świadczeniu usług drogą elektroniczną):** the provider must give an address (for a natural person: place of residence or a correspondence address). The documents give only the e-mail.
- **Supabase region:** the placeholder in section 4 of the privacy policy must be filled in (Supabase dashboard → Project Settings → General).
- **Gemini paid tier:** the policy says the paid tier is used (D17: paid before release). Do not publish while the app runs on the free tier.
- **Age 16+**, the 14-day complaint deadline, the 14-day notice for changes and the 30-day notice for withdrawing features are drafting choices to confirm.
- Friends without an account: the policy relies on legitimate interest and on the organizer telling friends; a lawyer should confirm the art. 14 GDPR information duty is covered.
- Data processing agreement (DPA) with Supabase, and the transfer mechanism (DPF / SCC) for Supabase, Google and Discord.
