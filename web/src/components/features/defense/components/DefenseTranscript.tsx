'use client'

import { useIsomorphicEffect, usePrevious } from '@mantine/hooks'
import { ArrowDown } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'
import { useFollowTail } from '@/hooks/use-follow-tail'

import type { Turn, TurnRole } from '../model/defense-types'
import { DefenseTurn } from './DefenseTurn'
import { ThinkingIndicator } from './ThinkingIndicator'

/**
 * Props for the {@link DefenseTranscript}.
 */
type DefenseTranscriptProps = {
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
  /** The line explaining a long wait while thinking. */
  thinkingLongLabel: string
}

/**
 * The scrolling conversation: every turn in order, followed by the thinking indicator while the
 * examiner replies. Keeps the newest content in view while the reader is at the bottom, but yields
 * control (and offers a jump-back affordance) once they scroll up to re-read.
 */
export function DefenseTranscript({
  turns,
  conversationKey,
  roleLabels,
  regionLabel,
  jumpLabel,
  isThinking,
  thinkingLabel,
  thinkingLongLabel,
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

  // Jump to the newest content when the reader sends their own turn, even from a scrolled-up
  // position; growth while pinned and the initial landing are followed by the region itself. Runs
  // after layout so the just-added turn is measured before the scroll
  useIsomorphicEffect(() => {
    // Whether a turn just arrived on the conversation already on screen
    const grew =
      !isConversationSwitch && previousLength !== undefined && turns.length > previousLength

    // Whether the reader is the one who sent it
    const sentByReader = grew && turns[lastIndex]?.role === 'student'

    // Force the jump only for the reader's own turn
    if (sentByReader) {
      scrollToBottom()
    }
  }, [turns, isConversationSwitch, previousLength, lastIndex, scrollToBottom])

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* The conversation, announced to assistive tech as it grows; remounted per conversation so a
          session switch resets the scroll without re-announcing the whole swapped-in transcript */}
      <div
        key={conversationKey}
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={regionLabel}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {/* The growing content the region follows */}
        <div ref={contentRef} className="flex flex-col gap-5 px-5 py-5">
          {/* Every turn in order */}
          {turns.map((turn, index) => (
            <DefenseTurn
              key={index}
              turn={turn}
              label={roleLabels[turn.role]}
              animate={index === justArrivedIndex}
            />
          ))}

          {/* The examiner working on its next reply */}
          {isThinking && <ThinkingIndicator label={thinkingLabel} longLabel={thinkingLongLabel} />}
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
