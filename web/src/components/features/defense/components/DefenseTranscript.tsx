'use client'

import { useIsomorphicEffect, usePrevious } from '@mantine/hooks'
import { ArrowDown } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'
import { useFollowTail } from '@/hooks/use-follow-tail'

import type { DefenseTurnReport, Turn, TurnRole } from '../model/defense-types'
import { DefenseTurn, type TurnActionsAffordance } from './DefenseTurn'
import { ThinkingIndicator } from './ThinkingIndicator'

/** Which authors' messages can be reported. */
const IS_REPORTABLE_ROLE: Record<TurnRole, boolean> = {
  examiner: true,
  candidate: false,
}

/**
 * Props for the {@link DefenseTranscript}.
 */
type DefenseTranscriptProps = TurnActionsAffordance & {
  /** The conversation so far, oldest first. */
  turns: readonly Turn[]
  /** An id for the current conversation, distinct across conversations. */
  conversationKey: number
  /** The localized label for each role. */
  roleLabels: Record<TurnRole, string>
  /** The accessible name for the conversation log region. */
  regionLabel: string
  /** The label on the jump-to-latest affordance. */
  jumpLabel: string
  /** Whether the examiner is currently producing a reply. */
  isThinking: boolean
  /** The examiner-voiced line shown while thinking. */
  thinkingLabel: string
  /** What the student holds against the conversation's replies, by reply. */
  reports: ReadonlyMap<string, DefenseTurnReport>
  /** Rewinds the conversation to the turn at the given index. */
  onRewindTurn: (index: number) => void
  /** Says what went wrong with the named reply, or revises what was already said. */
  onReportTurn: (turnId: string) => void
  /** Rendered under the last turn, where the conversation ends. */
  footer: React.ReactNode
}

/**
 * The scrolling conversation: every turn in order, the thinking indicator while the examiner replies, and the
 * caller's footer under the whole exchange. Keeps the newest content in view while the reader is at the bottom,
 * but yields control (and offers a jump-back affordance) once they scroll up to re-read.
 */
export function DefenseTranscript({
  turns,
  conversationKey,
  roleLabels,
  regionLabel,
  jumpLabel,
  isThinking,
  thinkingLabel,
  reports,
  canAct,
  rewindLabel,
  reportLabel,
  reportedLabel,
  onRewindTurn,
  onReportTurn,
  footer,
}: DefenseTranscriptProps) {
  // The scroll region, kept pinned to the newest turn while the reader sits at the bottom
  const { scrollRef, contentRef, isScrolledUp, scrollToBottom } = useFollowTail()

  // The transcript length on the previous render
  const previousLength = usePrevious(turns.length)

  // The conversation shown on the previous render
  const previousConversationKey = usePrevious(conversationKey)

  // Whether this render swapped in another conversation wholesale
  const isConversationSwitch =
    previousConversationKey !== undefined && previousConversationKey !== conversationKey

  // The newest turn's index
  const lastIndex = turns.length - 1

  // The index of a lone examiner turn that just landed, or -1 when nothing did; a swapped-in
  // conversation is old content, so it never animates
  const justArrivedIndex =
    !isConversationSwitch &&
    turns.length === (previousLength ?? turns.length) + 1 &&
    turns[lastIndex]?.role === 'examiner'
      ? lastIndex
      : -1

  // Follow a just-arrived turn synchronously, after layout so it's measured before the scroll: the
  // reader's own turn always pulls the view down, and the examiner's reply follows only while the
  // reader sits at the bottom, so re-reading up the transcript is never yanked. Belt-and-suspenders
  // with the region's own growth-follow, which can miss when a reply's math renders late
  useIsomorphicEffect(() => {
    // Whether a turn just arrived on the conversation already on screen
    const grew =
      !isConversationSwitch && previousLength !== undefined && turns.length > previousLength

    // Nothing landed, so there's nothing to follow
    if (!grew) {
      return
    }

    // The reader's own turn always jumps; the examiner's reply only when the reader is still pinned
    if (turns[lastIndex]?.role === 'candidate' || !isScrolledUp) {
      scrollToBottom()
    }
  }, [turns, isConversationSwitch, previousLength, lastIndex, isScrolledUp, scrollToBottom])

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* The scrolling conversation, remounted per conversation so a session switch resets the scroll
          without re-announcing the whole swapped-in transcript */}
      <div
        key={conversationKey}
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)]"
      >
        {/* The growing content the region follows */}
        <div ref={contentRef} className="flex flex-col gap-5 px-5 py-5">
          {/* What was said, announced to assistive tech as it grows. The footer sits outside it: it is the
              surface asking a question, not the conversation saying something */}
          <div
            role="log"
            aria-live="polite"
            aria-label={regionLabel}
            className="flex flex-col gap-5"
          >
            {/* Every turn in order */}
            {turns.map((turn, index) => {
              // The reply this turn can be reported as, null when it is the student's own, the canned
              // opener, or a draft the backend hasn't taken yet
              const reportableId = IS_REPORTABLE_ROLE[turn.role] && index > 0 ? turn.id : null

              return (
                <DefenseTurn
                  key={index}
                  turn={turn}
                  label={roleLabels[turn.role]}
                  animate={index === justArrivedIndex}
                  isReported={reportableId !== null && reports.has(reportableId)}
                  canAct={canAct}
                  rewindLabel={rewindLabel}
                  reportLabel={reportLabel}
                  reportedLabel={reportedLabel}
                  onRewind={() => onRewindTurn(index)}
                  onReport={reportableId === null ? null : () => onReportTurn(reportableId)}
                />
              )
            })}

            {/* The examiner working on its next reply */}
            {isThinking && <ThinkingIndicator label={thinkingLabel} />}
          </div>

          {/* Where the conversation ends */}
          {footer}
        </div>
      </div>

      {/* Back to the newest turn once the reader has scrolled up */}
      {isScrolledUp && (
        <Button
          variant="secondary"
          size="sm"
          shape="pill"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 bg-surface/95 text-xs font-semibold text-muted-foreground shadow-lg backdrop-blur-sm hover:text-foreground"
        >
          <ArrowDown size={14} />
          {jumpLabel}
        </Button>
      )}
    </div>
  )
}
