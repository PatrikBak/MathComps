'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { Modal } from '@/components/shared/components/Modal'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'

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
        {/* Each draft in turn, with what was said about it */}
        <div className="flex flex-col gap-6">
          {(attempts ?? []).map((attempt, index) => (
            <Attempt
              key={attempt.attemptIndex}
              attempt={attempt}
              isShipped={index === (attempts?.length ?? 0) - 1}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

/**
 * Props for the {@link Attempt} component.
 */
type AttemptProps = {
  /** The draft and every verdict on it. */
  attempt: DefenseTurnAttempt
  /** Whether this is the draft the student read. */
  isShipped: boolean
}

/**
 * One draft: what sent it back, what it said, what the guards made of it, and what it cost.
 */
function Attempt({ attempt, isShipped }: AttemptProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.attempts')

  return (
    <section>
      {/* Which draft this is, and how it ended */}
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-foreground">
          {t('attempt', { index: attempt.attemptIndex + 1 })}
        </h3>
        <span
          className={cn(
            'text-xs',
            attempt.isSafeFallback ? 'text-amber-600 dark:text-amber-400' : 'text-muted'
          )}
        >
          {attempt.isSafeFallback ? t('fallback') : isShipped ? t('shipped') : t('rejected')}
        </span>
      </div>

      {/* What it was told to fix, on every draft after the first. It quotes a guard back at the generator,
          so it carries whatever math that guard wrote */}
      {attempt.revisionNote !== '' && (
        <div className="mb-2 border-l-2 border-border pl-3 text-sm italic text-muted">
          <RichMathEditorRenderer content={attempt.revisionNote} lightImageBackground={false} />
        </div>
      )}

      {/* The draft itself, read as the student would have */}
      <RichMathEditorRenderer content={attempt.reply} lightImageBackground={false} />

      {/* What each guard made of it */}
      <ul className="mt-2 flex flex-col gap-1 text-sm">
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
 * What one draft's steps cost, which the turn's single figure can't break down.
 */
function Calls({ calls }: CallsProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.attempts')

  // The step names, which the settings panel already owns
  const tConfig = useTranslations('admin.defenseReview.config')

  // Locale-aware number rendering, for the costs and the token counts
  const format = useFormatter()

  // The calls in the order their steps run, which is the settings panel's order and not the wire's: nothing
  // orders them on the way here, so left alone a draft's breakdown reads differently each time it is opened
  const ordered = [...calls].sort(
    (first, second) => EXAMINER_STEPS.indexOf(first.step) - EXAMINER_STEPS.indexOf(second.step)
  )

  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
      {ordered.map((call) => (
        <li key={call.step} className="flex gap-2">
          {/* Which step made the call */}
          <span className="w-24 shrink-0">{tConfig(`steps.${call.step}`)}</span>

          {/* How it was routed and what it billed */}
          <span>
            {t('call', {
              model: call.model,
              effort: call.reasoningEffort ?? t('effortDefault'),
              cost: format.number(call.cost, { maximumFractionDigits: 5 }),
              promptTokens: format.number(call.promptTokens),
              completionTokens: format.number(call.completionTokens),
              reasoningTokens: format.number(call.reasoningTokens),
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}
