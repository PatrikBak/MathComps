'use client'

import { useTranslations } from 'next-intl'

import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/i18n'

/**
 * Props for the {@link LanguageSwitch} component.
 */
type LanguageSwitchProps = {
  /** The language being read. */
  language: Locale
  /** Switches the language. */
  onChange: (language: Locale) => void
  /** Languages with nothing written in them. */
  unwritten: readonly Locale[]
}

/**
 * A switch between the languages problems are read in, offering every language the site has. A language with
 * nothing written in it is dimmed and out of reach.
 */
export function LanguageSwitch({ language, onChange, unwritten }: LanguageSwitchProps) {
  // Language-switch copy
  const t = useTranslations('problemSelection.language')

  return (
    <SegmentedSwitch
      value={language}
      onChange={onChange}
      ariaLabel={t('label')}
      options={SUPPORTED_LOCALES.map((candidate) => ({
        value: candidate,
        label: <span className="uppercase">{candidate}</span>,
        // Out of reach where nothing is written in the language
        unavailableReason: unwritten.includes(candidate) ? t('unwritten') : undefined,
      }))}
    />
  )
}
