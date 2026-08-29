'use client'

import { useTranslations } from 'next-intl'
import type { Ref } from 'react'

import { LoginButton } from '@/components/login/LoginButton'
import { Button } from '@/components/shared/components/Button'
import type {
  RichMathEditorRef,
  ToolbarConfig,
} from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseComposerState } from '../model/defense-composer-state'
import { MathildaConsentGate } from './MathildaConsentGate'

/**
 * How few replies a conversation has to have left before the composer says so.
 */
const REPLIES_LEFT_TO_WARN_AT = 5

/**
 * The composer's toolbar for a defense turn, cut to the tools an argument is written with.
 */
const DEFENSE_TOOLBAR: ToolbarConfig = {
  heading: false,
  link: false,
  spoiler: false,
  attachment: false,
  image: false,
}

/**
 * Props for the {@link DefenseComposer}.
 */
type DefenseComposerProps = {
  /** What the composer area currently is. */
  state: DefenseComposerState
  /** The turn being written. */
  draft: string
  /** Takes what the student types. */
  onDraftChange: (draft: string) => void
  /** Sends the written turn. */
  onSend: () => void
  /** Abandons the reply in flight, handing the turn back. */
  onStop: () => void
  /** Focuses the editor from outside it. */
  editorRef: Ref<RichMathEditorRef>
  /** Whether a reply is in flight. */
  isThinking: boolean
  /** The longest a single turn may be, or undefined while the caps are not known. */
  maxCharacters: number | undefined
  /** Records the reader's acknowledgement. */
  onAcceptConsent: () => void
  /** Whether that acknowledgement is being recorded. */
  isAcceptingConsent: boolean
  /** Reads the acknowledgement again after the read for it failed. */
  onRetryConsent: () => void
  /** Whether that re-read is in flight. */
  isRetryingConsent: boolean
  /** How tall the empty editor stands. */
  editorMinHeightPx: number
}

/**
 * Where the next turn is written, or the reason there is nothing to write it into.
 */
export function DefenseComposer({
  state,
  draft,
  onDraftChange,
  onSend,
  onStop,
  editorRef,
  isThinking,
  maxCharacters,
  onAcceptConsent,
  isAcceptingConsent,
  onRetryConsent,
  isRetryingConsent,
  editorMinHeightPx,
}: DefenseComposerProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // The editor, or the reason there is nothing to write into
  switch (state.kind) {
    // Nothing to write into yet
    case 'loading':
      return <p className="py-3 text-center text-sm text-muted">{t('libraryLoading')}</p>

    // Nobody to write the turn as
    case 'signInRequired':
      return (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          {/* Why there is nothing to write into */}
          <p className="text-sm text-muted">{t('loginPrompt')}</p>

          {/* The way to fix that */}
          <LoginButton />
        </div>
      )

    // Nobody who has said what they are agreeing to
    case 'consentRequired':
      return <MathildaConsentGate onAccept={onAcceptConsent} isAccepting={isAcceptingConsent} />

    // Nobody who could be asked whether they have already agreed
    case 'consentUnknown':
      return (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          {/* What could not be found out */}
          <p className="max-w-[700px] text-pretty text-sm text-muted">{t('consentUnavailable')}</p>

          {/* Asking again */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetryConsent}
            loading={isRetryingConsent}
          >
            {tActions('retry')}
          </Button>
        </div>
      )

    // Every turn spent
    case 'full':
      return <p className="py-3 text-center text-sm text-muted">{t('conversationFull')}</p>

    // Open for the next turn
    case 'open':
      return (
        <>
          {/* How much room is left, once there is little of it */}
          {state.repliesLeft !== null &&
            state.repliesLeft > 0 &&
            state.repliesLeft <= REPLIES_LEFT_TO_WARN_AT && (
              <p className="mb-1.5 text-xs text-muted">
                {t('repliesLeft', { count: state.repliesLeft })}
              </p>
            )}

          {/* Where the next reply is written */}
          <RichMathEditor
            variant="card"
            toolbar={DEFENSE_TOOLBAR}
            maxCharacters={maxCharacters}
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            onStop={onStop}
            autoFocus
            ref={editorRef}
            isLoading={isThinking}
            minHeightPx={editorMinHeightPx}
            placeholder={t('placeholder')}
          />
        </>
      )

    // Every state is handled above
    default:
      return assertNever(state)
  }
}
