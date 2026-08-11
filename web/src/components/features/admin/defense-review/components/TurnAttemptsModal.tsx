'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { Modal } from '@/components/shared/components/Modal'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'
import { formatDurationMs } from '@/components/shared/utils/duration-utils'

import type { DefenseAttemptCall, DefenseTurnAttempt } from '../model/defense-review-types'
import { EXAMINER_STEPS } from '../model/defense-review-types'

/**
 * Props for the {@link TurnAttemptsModal} component.
 */
type TurnAttemptsModalProps = {
  /** The drafts behind one reply, in the order they were made; null while none is being read. */
  attempts: DefenseTurnAttempt[] | null
  /** Closes it. */
  onClose: () => void
}

/**
 * How one reply was arrived at: every draft the examiner wrote for it, what each guard said, and what the
 * whole thing cost.
 *
 * This is the part of a turn the student never sees. A rejected draft is a leak or a wrong claim a guard
 * caught, so it reads here and nowhere the student can reach, and it renders the way the conversation does
 * rather than as source, because judging whether something gives too much away means reading it as they
 * would have.
 *
 * It opens as a dialog rather than a third panel: a run can be four drafts long, each the size of a reply,
 * and the review panel is already carrying the conversation beside the reference solution.
 */
export function TurnAttemptsModal({ attempts, onClose }: TurnAttemptsModalProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.attempts')

  // Locale-aware number rendering, for the run's spend
  const format = useFormatter()

  // The run, or nothing while none is being read
  const drafts = attempts ?? []

  return (
    <Modal
      isOpen={attempts !== null}
      onClose={onClose}
      title={t('title')}
      showCloseButton
      align="top"
      className="flex max-w-4xl flex-col sm:max-h-[85vh]"
    >
      <div className="scrollbar-visible min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* What the reply took and cost altogether, on a run that had to be redrafted. A lone draft is the
            whole run, so its own line already says this */}
        {drafts.length > 1 && (
          <p className="mb-8 flex items-baseline gap-3 text-xs text-muted">
            <span>{t('total')}</span>

            <span>{formatDurationMs(totalDurationMs(drafts))}</span>

            <span>{formatCost(format, totalCost(drafts))}</span>
          </p>
        )}

        {/* Each draft in turn, with what was said about it. A run is several drafts of the same three parts, so
            the gap between two of them has to beat every gap inside one for the boundary to read at all */}
        <div className="flex flex-col gap-12">
          {drafts.map((attempt, index) => (
            <Attempt
              key={attempt.attemptIndex}
              attempt={attempt}
              status={statusOf(attempt, index, drafts.length)}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

/**
 * How long a run took: its drafts added up, since they're written one after another.
 *
 * @param drafts - The run's drafts.
 *
 * @returns The run's duration, in milliseconds.
 */
function totalDurationMs(drafts: DefenseTurnAttempt[]): number {
  return drafts.reduce((total, draft) => total + draft.durationMs, 0)
}

/**
 * What one draft billed: the call that wrote it and every call that judged it.
 *
 * @param draft - The draft in question.
 *
 * @returns The draft's spend in credits.
 */
function draftCost(draft: DefenseTurnAttempt): number {
  return draft.calls.reduce((spent, call) => spent + call.cost, 0)
}

/**
 * What a run billed: every draft, the ones a guard sent back included, since a rejected draft was paid for all
 * the same.
 *
 * @param drafts - The run's drafts.
 *
 * @returns The run's spend in credits.
 */
function totalCost(drafts: DefenseTurnAttempt[]): number {
  return drafts.reduce((total, draft) => total + draftCost(draft), 0)
}

/**
 * Writes a spend in credits.
 *
 * @param format - The locale's formatters.
 * @param cost - The spend in credits, one credit being one US dollar.
 *
 * @returns The spend, as a label.
 */
function formatCost(format: ReturnType<typeof useFormatter>, cost: number): string {
  return `$${format.number(cost, { maximumFractionDigits: 5 })}`
}

/**
 * How a draft ended, named by the copy key that says it: the draft the student read, one a guard sent back, or
 * the constrained fallback the revision cap retreated to.
 */
type AttemptStatus = 'fallback' | 'rejected' | 'shipped'

/**
 * How a draft ended, or null where saying so would tell the reader nothing.
 *
 * @param attempt - The draft in question.
 * @param index - Its place in the run.
 * @param draftCount - How many drafts the run holds.
 *
 * @returns The status, or null.
 */
function statusOf(
  attempt: DefenseTurnAttempt,
  index: number,
  draftCount: number
): AttemptStatus | null {
  // The fallback is worth naming however short the run: it says no draft ever came back clean
  if (attempt.isSafeFallback) {
    return 'fallback'
  }

  // A lone draft has nothing to be contrasted against, and calling it sent only repeats that it is the reply
  if (draftCount === 1) {
    return null
  }

  // Otherwise which of the run's drafts this was
  return index === draftCount - 1 ? 'shipped' : 'rejected'
}

/**
 * Props for the {@link Attempt} component.
 */
type AttemptProps = {
  /** The draft and every verdict on it. */
  attempt: DefenseTurnAttempt
  /** How it ended; null where saying so would tell the reader nothing. */
  status: AttemptStatus | null
}

/**
 * One draft: what sent it back, what it said, what the guards made of it, and what it took.
 */
function Attempt({ attempt, status }: AttemptProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.attempts')

  // Locale-aware number rendering, for the draft's spend
  const format = useFormatter()

  return (
    <section>
      {/* Which draft this is, how it ended, and what it took: on a revised turn the last two say what each
          correction added to the wait and to the bill */}
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-foreground">
          {t('attempt', { index: attempt.attemptIndex + 1 })}
        </h3>

        {status !== null && (
          <span
            className={cn(
              'text-xs',
              status === 'fallback' ? 'text-amber-600 dark:text-amber-400' : 'text-muted'
            )}
          >
            {t(status)}
          </span>
        )}

        <span className="text-xs text-muted">{formatDurationMs(attempt.durationMs)}</span>

        <span className="text-xs text-muted">{formatCost(format, draftCost(attempt))}</span>
      </div>

      {/* What it was told to fix, on every draft after the first. It quotes a guard back at the generator,
          so it carries whatever math that guard wrote */}
      {attempt.revisionNote !== '' && (
        <div className="mb-3 border-l-2 border-border pl-3 text-sm italic text-muted">
          <RichMathEditorRenderer content={attempt.revisionNote} lightImageBackground={false} />
        </div>
      )}

      {/* The draft itself, read as the student would have */}
      <RichMathEditorRenderer content={attempt.reply} lightImageBackground={false} />

      {/* What each guard made of it */}
      <ul className="mt-6 flex flex-col gap-1.5 text-sm">
        <Verdict
          label={t('verdicts.math')}
          isFlagged={!attempt.mathHolds}
          flagged={t('verdicts.mathFails', { correction: attempt.mathCorrection })}
          clean={t('verdicts.mathHolds')}
        />
        <Verdict
          label={t('verdicts.leak')}
          isFlagged={attempt.leaks}
          flagged={t('verdicts.leaks', { whatLeaked: attempt.whatLeaked })}
          clean={t('verdicts.leakClean')}
        />
        <Verdict
          label={t('verdicts.close')}
          isFlagged={attempt.withholdsClose}
          flagged={t('verdicts.withholdsClose', { established: attempt.established })}
          clean={t('verdicts.closeClean')}
        />
        <Verdict
          label={t('verdicts.language')}
          isFlagged={attempt.switchesLanguage}
          flagged={t('verdicts.switchesLanguage', { language: attempt.candidateLanguage })}
          clean={attempt.candidateLanguage || t('verdicts.languageUnknown')}
        />
      </ul>

      {/* What writing and judging it cost, per step */}
      {attempt.calls.length > 0 && <Calls calls={attempt.calls} />}
    </section>
  )
}

/**
 * Props for the {@link Verdict} component.
 */
type VerdictProps = {
  /** Which guard passed it. */
  label: string
  /** Whether the guard flagged the draft. */
  isFlagged: boolean
  /** What it says when flagged. */
  flagged: string
  /** What it says when clean. */
  clean: string
}

/**
 * One guard's verdict, with what it caught when it caught something.
 *
 * A guard writes the correction, the leak and the established argument itself, so a verdict carries whatever
 * math it wrote them in and reads through the same renderer the draft above it does.
 */
function Verdict({ label, isFlagged, flagged, clean }: VerdictProps) {
  return (
    <li className="flex gap-2">
      <span className="w-24 shrink-0 text-muted">{label}</span>

      <div className={isFlagged ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
        <RichMathEditorRenderer
          content={isFlagged ? flagged : clean}
          lightImageBackground={false}
        />
      </div>
    </li>
  )
}

/**
 * Props for the {@link Calls} component.
 */
type CallsProps = {
  /** The calls one draft made. */
  calls: DefenseAttemptCall[]
}

/**
 * What one draft's steps ran on, what each cost, and how long each kept the draft waiting, which the turn's
 * single figures can't break down.
 *
 * Reads as one block per step, the shape the settings panel already reads in. Each step routes independently,
 * so its model and effort sit beside its own figures.
 */
function Calls({ calls }: CallsProps) {
  // The calls in the order their steps run, which is the settings panel's order and not the wire's: nothing
  // orders them on the way here, so left alone a draft's breakdown reads differently each time it is opened
  const ordered = [...calls].sort(
    (first, second) => EXAMINER_STEPS.indexOf(first.step) - EXAMINER_STEPS.indexOf(second.step)
  )

  return (
    <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {ordered.map((call) => (
        <Call key={call.step} call={call} />
      ))}
    </div>
  )
}

/**
 * Props for the {@link Call} component.
 */
type CallProps = {
  /** The call one step made. */
  call: DefenseAttemptCall
}

/**
 * One step's call, under its name.
 */
function Call({ call }: CallProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.attempts')

  // The step names and the routing terms, which the settings panel already owns
  const tConfig = useTranslations('admin.defenseReview.config')

  // Locale-aware number rendering, for the cost and the token counts
  const format = useFormatter()

  return (
    <section>
      {/* Which step made the call */}
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tConfig(`steps.${call.step}`)}
      </h4>

      {/* What it ran on and what it took, label against value */}
      <dl className="grid grid-cols-[minmax(0,5rem)_1fr] gap-x-3 gap-y-1 text-xs">
        {/* Where it routed */}
        <CallEntry label={tConfig('model')} value={call.model} />

        {/* How hard it was told to think, where no effort sent means it ran at none */}
        <CallEntry
          label={tConfig('reasoningEffort')}
          value={call.reasoningEffort ?? tConfig('reasoningEffortNone')}
        />

        {/* What it kept the draft waiting */}
        <CallEntry label={t('time')} value={formatDurationMs(call.durationMs)} />

        {/* What it billed */}
        <CallEntry label={t('cost')} value={formatCost(format, call.cost)} />

        {/* And what it read and wrote, the reasoning counted within the output */}
        <CallEntry
          label={t('tokens')}
          value={t('tokenCounts', {
            promptTokens: format.number(call.promptTokens),
            completionTokens: format.number(call.completionTokens),
            reasoningTokens: format.number(call.reasoningTokens),
          })}
        />
      </dl>
    </section>
  )
}

/**
 * Props for the {@link CallEntry} component.
 */
type CallEntryProps = {
  /** What the figure is called. */
  label: string
  /** The figure itself. */
  value: string
}

/**
 * One figure of one call.
 */
function CallEntry({ label, value }: CallEntryProps) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words tabular-nums text-muted-foreground">{value}</dd>
    </>
  )
}
