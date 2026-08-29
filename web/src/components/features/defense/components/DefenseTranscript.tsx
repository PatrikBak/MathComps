'use client'

import { useIsomorphicEffect, useMergedRef, usePrevious } from '@mantine/hooks'
import { ArrowDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useRef } from 'react'

import { Button } from '@/components/shared/components/Button'
import { useFollowTail } from '@/hooks/use-follow-tail'

import { useRevealPointedTurn } from '../hooks/use-reveal-pointed-turn'
import type { DefenseTurnReport, Turn, TurnRole } from '../model/defense-types'
import { DefenseTurn, type TurnDraftsMark, type TurnUnreadMark } from './DefenseTurn'
import { ThinkingIndicator } from './ThinkingIndicator'

/** Which authors' messages can be reported. */
const IS_REPORTABLE_ROLE: Record<TurnRole, boolean> = {
  examiner: true,
  candidate: false,
}

/**
 * Props for the {@link TranscriptDivider}.
 */
type TranscriptDividerProps = {
  /** What the line says. */
  label: string
}

/**
 * A labelled line drawn across the transcript before one turn. What it means is the caller's word.
 */
function TranscriptDivider({ label }: TranscriptDividerProps) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-foreground/20" aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="h-px flex-1 bg-foreground/20" aria-hidden="true" />
    </div>
  )
}

/**
 * A line drawn before one turn, setting what follows it apart from what came before.
 *
 * The transcript draws it and the caller says what it means: a reader's last pass stopped here, or an entry's
 * clock did.
 */
type TranscriptDivider = {
  /** The turn the line sits above. */
  turnId: string
  /** What the line says. */
  label: string
}

/**
 * Props for the {@link DefenseTranscript}.
 */
type DefenseTranscriptProps = {
  /** Whether to offer each turn's report control, which leaves the conversation as it stands. */
  canGiveFeedback: boolean
  /** Whether to offer each turn's rewind control, which drops everything after it. */
  canRewind: boolean
  /** The conversation so far, oldest first. */
  turns: readonly Turn[]
  /** An id for the current conversation, distinct across conversations. */
  conversationKey: string | number
  /** The localized label for each role. */
  roleLabels: Record<TurnRole, string>
  /** Whether the examiner is currently producing a reply. */
  isThinking: boolean
  /** What the student holds against the conversation's replies, by reply. */
  reports: ReadonlyMap<string, DefenseTurnReport>
  /** Rewinds the conversation to the turn at the given index. */
  onRewindTurn: (index: number) => void
  /** Says what went wrong with the named reply, or revises what was already said. */
  onReportTurn: (turnId: string) => void
  /** Where the line goes and what it says; null when nothing divides the conversation. */
  dividerBeforeTurn: TranscriptDivider | null
  /** Moving where the reader picks the conversation up; null where nobody keeps a place in it. */
  unreadMark: TurnUnreadMark | null
  /** Reading the drafts behind a reply; null where the reader isn't allowed to see them. */
  draftsMark: TurnDraftsMark | null
  /** How long each reply took the examiner, by reply; null where the reader isn't shown timings. */
  turnDurationsMs: ReadonlyMap<string, number> | null
  /** Whether to number the turns, so something outside the conversation can refer to one by its place. */
  showPositions?: boolean
  /** The turn something outside the conversation currently points at; null when nothing does. */
  pointedAtTurnId?: string | null
  /** Rendered at the foot of the pane, where the conversation ends; null when there is nothing to say. */
  footer: React.ReactNode
}

/**
 * The scrolling conversation: every turn in order, the mark where a reader's last pass stopped, the thinking
 * indicator while the examiner replies, and the caller's footer at the foot of the pane. Keeps the newest
 * content in view while the reader is at the bottom, but yields control (and offers a jump-back affordance)
 * once they scroll up to re-read.
 */
export function DefenseTranscript({
  turns,
  conversationKey,
  roleLabels,
  isThinking,
  reports,
  canGiveFeedback,
  canRewind,
  onRewindTurn,
  onReportTurn,
  dividerBeforeTurn,
  unreadMark,
  draftsMark,
  turnDurationsMs,
  showPositions = false,
  pointedAtTurnId = null,
  footer,
}: DefenseTranscriptProps) {
  // Defense copy
  const t = useTranslations('defense')

  // The scroll region, kept pinned to the newest turn while the reader sits at the bottom
  const { scrollRef, contentRef, isScrolledUp, scrollToBottom } = useFollowTail()

  // A handle on that same region
  const paneRef = useRef<HTMLDivElement>(null)

  // The one ref the region can take, standing for both of them
  const setPane = useMergedRef(scrollRef, paneRef)

  // Move to whichever turn is being pointed at
  useRevealPointedTurn(paneRef, pointedAtTurnId)

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
        ref={setPane}
        className="flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_1rem,#000_calc(100%-1rem),transparent)]"
      >
        {/* The growing content the region follows */}
        <div ref={contentRef} className="flex min-h-full flex-col gap-3.5 px-5 py-5">
          {/* What was said, announced to assistive tech as it grows. The footer sits outside it: it is the
              surface asking a question, not the conversation saying something */}
          <div
            role="log"
            aria-live="polite"
            aria-label={t('transcriptLabel')}
            className="flex flex-col gap-3.5"
          >
            {/* Every turn in order */}
            {turns.map((turn, index) => {
              // The reply this turn can be reported as, null when it is the student's own, the canned
              // opener, or a draft the backend hasn't taken yet
              const reportableId = IS_REPORTABLE_ROLE[turn.role] && index > 0 ? turn.id : null

              // Whether the line, if there is one, sits above this turn
              const startsWhatIsDivided =
                dividerBeforeTurn !== null && turn.id === dividerBeforeTurn.turnId

              // Whether whatever points into the conversation points at this turn. A draft the backend
              // hasn't taken yet is no turn in particular, so nothing can be pointing at it
              const isPointedAt = turn.id !== null && turn.id === pointedAtTurnId

              return (
                <Fragment key={index}>
                  {startsWhatIsDivided && <TranscriptDivider label={dividerBeforeTurn.label} />}

                  <DefenseTurn
                    turn={turn}
                    position={showPositions ? index + 1 : null}
                    isPointedAt={isPointedAt}
                    label={roleLabels[turn.role]}
                    animate={index === justArrivedIndex}
                    isReported={reportableId !== null && reports.has(reportableId)}
                    canGiveFeedback={canGiveFeedback}
                    canRewind={canRewind}
                    onRewind={() => onRewindTurn(index)}
                    onReport={reportableId === null ? null : () => onReportTurn(reportableId)}
                    unreadMark={unreadMark}
                    draftsMark={draftsMark}
                    durationMs={turn.id === null ? null : (turnDurationsMs?.get(turn.id) ?? null)}
                  />
                </Fragment>
              )
            })}

            {/* The examiner working on her next reply */}
            {isThinking && <ThinkingIndicator />}
          </div>

          {/* Where the conversation ends, held at the foot of the pane: a short conversation would
              otherwise strand it mid-panel with the empty rest of the transcript under it */}
          {footer !== null && <div className="-mb-1 mt-auto pt-1">{footer}</div>}
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
          {t('jumpToLatest')}
        </Button>
      )}
    </div>
  )
}
