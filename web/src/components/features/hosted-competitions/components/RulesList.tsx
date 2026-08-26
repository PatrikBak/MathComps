'use client'

import { useTranslations } from 'next-intl'

/**
 * The terms an entry runs on.
 */
export function RulesList() {
  // The rules' own copy, read from its own namespace so the lines come back as the array they are
  const tRules = useTranslations('competitions.rules')

  // The lines themselves
  const lines = tRules.raw('lines') as string[]

  return (
    <ul className="list-outside list-disc space-y-2 pl-5 text-sm text-muted marker:text-muted/60">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  )
}
