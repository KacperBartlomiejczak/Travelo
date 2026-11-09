import { shouldPolyfill } from '@formatjs/intl-pluralrules/should-polyfill.js';

// Hermes on Android has no Intl.PluralRules, so i18next would always pick `_other`; polyfill only when pl/en are missing.
if (shouldPolyfill('pl') || shouldPolyfill('en')) {
  // Synchronous requires keep the polyfill installed before i18next first resolves a plural rule.
  /* eslint-disable @typescript-eslint/no-require-imports */
  require('@formatjs/intl-pluralrules/polyfill-force.js');
  require('@formatjs/intl-pluralrules/locale-data/pl.js');
  require('@formatjs/intl-pluralrules/locale-data/en.js');
  /* eslint-enable @typescript-eslint/no-require-imports */
}
