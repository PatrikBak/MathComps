'use client'

import { MessageSquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'

import { DisclosureNote } from './DisclosureNote'

/**
 * The rules themselves, and where to take anything they do not answer.
 */
export function RulesList() {
  // The rules' own copy, read from its own namespace so the lines come back as the array they are
  const tRules = useTranslations('competitions.rules')

  // The lines themselves
  const lines = tRules.raw('lines') as string[]

  return (
    <>
      <ul className="list-outside list-disc space-y-2 pl-5 text-sm text-muted marker:text-muted/60">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>

      {/* Where to take anything the rules do not answer */}
      <DisclosureNote icon={MessageSquarePlus}>
        {tRules.rich('contact', {
          link: (chunks) => <ProseContactLink reason="other">{chunks}</ProseContactLink>,
        })}
      </DisclosureNote>
    </>
  )
}
