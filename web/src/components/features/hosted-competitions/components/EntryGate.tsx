'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { ProseLink } from '@/components/shared/components/ProseLink'
import { cn } from '@/components/shared/utils/css-utils'
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
 * Props for the {@link ReaderPrompt} component.
 */
type ReaderPromptProps = {
  /** The sentence, with the way to take the step as a link on the word for it. */
  children: ReactNode
  /** Hides the sentence, or undefined where it cannot be hidden. */
  onDismiss?: () => void
  /** Extra classes for where the sentence sits. */
  className?: string
}

/**
 * A step the reader can take, said to them in one sentence.
 */
export function ReaderPrompt({ children, onDismiss, className }: ReaderPromptProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  return (
    // Hugging its own text, with room on the right for the way to be rid of it
    <div
      className={cn(
        'flex w-fit items-center gap-2 rounded-lg bg-brand/10 py-2 pl-3 pr-2 text-sm text-foreground',
        className
      )}
    >
      {/* The sentence */}
      <p>{children}</p>

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
    // The step they are at
    <ReaderPrompt onDismiss={onDismiss}>
      {t.rich(BLOCKER_MESSAGE_KEY[blocker], {
        link: (chunks) => <ProseLink href={stepHrefs[blocker]}>{chunks}</ProseLink>,
      })}
    </ReaderPrompt>
  )
}
