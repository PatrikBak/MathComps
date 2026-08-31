import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from './i18n'

/**
 * The clock every date on the site is read in.
 *
 * Next-intl always resolves a zone, and with none configured it takes the one the machine rendering the
 * page happens to be on, which is the deployment's and nobody's choice: the same instant then reads as
 * one day locally and the day before in production. Pinned to the calendar the site is written for, so
 * a date means the same day wherever it is drawn.
 */
const SITE_TIME_ZONE = 'Europe/Bratislava'

/**
 * Next-intl request configuration.
 * Validates the locale from the URL, loads the appropriate messages, and pins the time zone.
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
    timeZone: SITE_TIME_ZONE,
  }
})
