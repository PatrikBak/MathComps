'use client'

import { useTranslations } from 'next-intl'

import { ProseLink } from '@/components/shared/components/ProseLink'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'

import type { EntryBlocker } from '../model/entry-reader'

/**
 * Props for the {@link EntryGate} component.
 */
type EntryGateProps = {
  /** What stands between the reader and any entry. */
  blocker: EntryBlocker
}

/**
 * What the reader still owes before any clock can start, said in the header as well as at the press.
 *
 * One step at a time, the one they are actually at, and nothing at all once nothing is owed. The way to
 * take that step is a link on the word for it, inside the sentence.
 */
export function EntryGate({ blocker }: EntryGateProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The way to an account, which comes back to this page
  const { getLoginUrl } = useLoginRedirect()

  // Whichever step they are at, and where its own word leads
  const messageKey = blocker === 'signIn' ? 'readiness.signedOut' : 'readiness.profileNeeded'
  const href = blocker === 'signIn' ? getLoginUrl() : ROUTES.PROFILE

  return (
    // Hugging its own text
    <p className="w-fit rounded-lg bg-brand/10 px-3 py-2 text-sm text-foreground">
      {t.rich(messageKey, {
        link: (chunks) => <ProseLink href={href}>{chunks}</ProseLink>,
      })}
    </p>
  )
}
