import type messages from '../../messages/sk.json'
import type { routing } from './i18n'

/**
 * This is needed to provide type-safe translations.
 *
 * @see https://next-intl.dev/docs/workflows/typescript
 */
declare module 'next-intl' {
  interface AppConfig {
    // TypeScript now knows that valid Locales are ONLY ours
    Locale: (typeof routing.locales)[number]
    // TypeScript now knows the exact structure of the translation JSON file
    Messages: typeof messages
  }
}
