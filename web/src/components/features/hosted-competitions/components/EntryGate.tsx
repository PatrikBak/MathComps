'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProseLink } from '@/components/shared/components/ProseLink'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'

import type { EntryBlocker } from '../model/entry-reader'

/**
 * The sentence each step is said in.
 */
const BLOCKER_MESSAGE_KEY = {
  signIn: 'readiness.signedOut',
  profile: 'readiness.profileNeeded',
} as const satisfies Record<EntryBlocker, string>

/**
 * Props for the {@link EntryGate} component.
 */
type EntryGateProps = {
  /** What stands between the reader and any entry. */
  blocker: EntryBlocker
  /**
   * Hides the sentence for good, or undefined for a step nobody can be rid of.
   *
   * Hiding it is an answer kept against an account, so only a reader who has one is offered it.
   */
  onDismiss?: () => void
}

/**
 * What the reader still owes before any clock can start, said in the header as well as at the press.
 *
 * One step at a time, the one they are actually at, and nothing at all once nothing is owed. The way to
 * take that step is a link on the word for it, inside the sentence.
 */
export function EntryGate({ blocker, onDismiss }: EntryGateProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The way to an account, which comes back to this page
  const { getLoginUrl } = useLoginRedirect()

  // Where each step's own word leads
  const stepHrefs: Record<EntryBlocker, string> = {
    signIn: getLoginUrl(),
    profile: ROUTES.PROFILE,
  }

  return (
    // Hugging its own text, with room on the right for the way to be rid of it
    <div className="flex w-fit items-center gap-2 rounded-lg bg-brand/10 py-2 pl-3 pr-2 text-sm text-foreground">
      {/* The step they are at */}
      <p>
        {t.rich(BLOCKER_MESSAGE_KEY[blocker], {
          link: (chunks) => <ProseLink href={stepHrefs[blocker]}>{chunks}</ProseLink>,
        })}
      </p>

      {/* The way to stop being told */}
      {onDismiss !== undefined && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={t('readiness.dismiss')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
