'use client'

import { Radio, RadioGroup } from '@headlessui/react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
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
 * A switch between the languages problems are read in, offering every language the site has, as one small
 * segmented control: a single stop for Tab, with the arrow keys moving between the languages. A language with
 * nothing written in it is dimmed and out of reach.
 */
export function LanguageSwitch({ language, onChange, unwritten }: LanguageSwitchProps) {
  // Language-switch copy
  const t = useTranslations('problemSelection.language')

  return (
    <RadioGroup
      value={language}
      onChange={onChange}
      aria-label={t('label')}
      className="inline-flex shrink-0 rounded-lg border border-foreground/10 p-0.5"
    >
      {SUPPORTED_LOCALES.map((candidate) => {
        // Whether nothing is written in this language
        const isUnwritten = unwritten.includes(candidate)

        return (
          <Radio
            key={candidate}
            value={candidate}
            disabled={isUnwritten}
            title={isUnwritten ? t('unwritten') : undefined}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center rounded-md px-2.5 text-xs font-semibold uppercase',
              'text-muted transition-colors hover:text-foreground',
              'focus:outline-none data-focus:ring-2 data-focus:ring-focus',
              'data-checked:bg-foreground/10 data-checked:text-foreground',
              'data-disabled:cursor-not-allowed data-disabled:opacity-35 data-disabled:hover:text-muted'
            )}
          >
            {candidate}
          </Radio>
        )
      })}
    </RadioGroup>
  )
}
