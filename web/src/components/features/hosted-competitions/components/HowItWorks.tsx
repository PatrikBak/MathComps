'use client'

import { useTranslations } from 'next-intl'

import { HeaderDisclosure } from './HeaderDisclosure'

/**
 * What happens between pressing the button and reading a result, which is the shape of the thing rather
 * than the rules a student agrees to.
 */
export function HowItWorks() {
  // The steps' own copy, read from its own namespace so they come back as the array they are
  const t = useTranslations('competitions.howItWorks')

  // The steps themselves
  const steps = t.raw('steps') as string[]

  return (
    <HeaderDisclosure label={t('title')}>
      <ol className="list-outside list-decimal space-y-2 pl-5 text-sm text-muted marker:text-muted/60">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </HeaderDisclosure>
  )
}
