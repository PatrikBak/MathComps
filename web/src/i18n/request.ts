import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from './i18n'

/**
 * Next-intl request configuration.
 * Validates the locale from the URL and loads the appropriate messages.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Figure out the locale based on the
  let locale = await requestLocale

  // Fallback to default if locale is invalid
  if (!locale || !SUPPORTED_LOCALES.includes(locale as Locale)) {
    locale = DEFAULT_LOCALE
  }

  // Get the translation messages
  const messages = await import(`../../messages/${locale}.json`)

  // Return the messages + the resolved locale
  return {
    locale: locale as Locale,
    messages: messages.default,
  }
})
