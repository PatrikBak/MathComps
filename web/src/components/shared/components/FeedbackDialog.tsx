'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { assertNever } from '@/components/shared/utils/assert-never'
import { namesTheSameItems } from '@/components/shared/utils/collection-utils'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * One answer a {@link FeedbackDialog} offers.
 *
 * @template TValue - The set of answers the dialog reports.
 */
export type FeedbackOption<TValue extends string> = {
  /** The value reported when this answer is chosen. */
  value: TValue
  /** The answer as the reader sees it. */
  label: string
}

/**
 * The answers a question offers, in the order the record lists them.
 *
 * @param labelKeys - The message key naming each answer, keyed by the answer itself.
 * @param translate - Resolves one of those keys to the answer as the reader sees it.
 *
 * @returns The answers under their labels.
 *
 * @template TValue - The set of answers the question reports.
 * @template TKey - The message keys naming them.
 */
export function toFeedbackOptions<TValue extends string, TKey extends string>(
  labelKeys: Record<TValue, TKey>,
  translate: (key: TKey) => string
): FeedbackOption<TValue>[] {
  // Pair each answer with its label; the entries are the record's own keys
  return (Object.entries(labelKeys) as [TValue, TKey][]).map(([value, labelKey]) => ({
    value,
    label: translate(labelKey),
  }))
}

/**
 * A question whose answers are exclusive: picking one drops the last.
 *
 * @template TValue - The set of answers the question reports.
 */
type SingleChoice<TValue extends string> = {
  /** The discriminator. */
  selection: 'single'
  /** The answer to open on, or null to open on none. */
  initialValue: TValue | null
  /** Called with the picked answer and the reader's own words, empty when they wrote none. */
  onSubmit: (value: TValue, comment: string) => void
}

/**
 * A question that takes every answer that applies.
 *
 * @template TValue - The set of answers the question reports.
 */
type MultipleChoice<TValue extends string> = {
  /** The discriminator. */
  selection: 'multiple'
  /** The answers to open on, empty to open on none. */
  initialValues: readonly TValue[]
  /** Called with every picked answer and the reader's own words, empty when they wrote none. */
  onSubmit: (values: readonly TValue[], comment: string) => void
}

/**
 * How many of a question's answers apply at once, and what is done with the ones picked.
 *
 * @template TValue - The set of answers the question reports.
 */
type FeedbackChoice<TValue extends string> = SingleChoice<TValue> | MultipleChoice<TValue>

/**
 * How one selection mode renders its answers.
 */
type SelectionStyle = {
  /** The input each answer renders. */
  inputType: 'radio' | 'checkbox'
  /** The accessible role of the list of answers. */
  listRole: 'radiogroup' | 'group'
  /** The class styling the input. */
  inputClass: string
}

/**
 * How much of the free-text field's room must be gone before the characters left are worth showing. Below
 * it the cap is far enough away that a running count says nothing.
 */
const COMMENT_COUNTER_THRESHOLD = 0.9

/** The look of each selection mode's answers. */
const SELECTION_STYLES: Record<FeedbackChoice<string>['selection'], SelectionStyle> = {
  single: { inputType: 'radio', listRole: 'radiogroup', inputClass: 'form-radio' },
  multiple: { inputType: 'checkbox', listRole: 'group', inputClass: 'form-checkbox' },
}

/**
 * What one asking of a {@link FeedbackDialog} needs, which is everything but whether it is open.
 *
 * @template TValue - The set of answers the dialog reports.
 */
type FeedbackQuestionProps<TValue extends string> = {
  /** How many answers apply, and what is done with the ones picked. */
  choice: FeedbackChoice<TValue>
  /**
   * The answer that says nothing on its own, so picking it holds the question open until words follow, or null
   * when every answer speaks for itself.
   */
  requiresComment: TValue | null
  /** The aside marking that answer as one to write behind. */
  requiresCommentHint: string
  /** Dismisses the question unanswered. */
  onClose: () => void
  /** Takes back the answer already standing, or null when none does. */
  onRemove: (() => void) | null
  /** The question being asked. */
  title: string
  /** The answers to choose between. */
  options: readonly FeedbackOption<TValue>[]
  /** The words to open the free-text field on, empty to open it blank. */
  initialComment: string
  /** The prompt above the free-text field. */
  commentLabel: string
  /** The most characters the free-text field accepts. */
  commentMaxLength: number
  /** Whether the answer is being sent. */
  isPending: boolean
}

/**
 * Props for the {@link FeedbackDialog} component.
 *
 * @template TValue - The set of answers the dialog reports.
 */
type FeedbackDialogProps<TValue extends string> = FeedbackQuestionProps<TValue> & {
  /** Whether the dialog is open. */
  isOpen: boolean
}

/**
 * The answers a question opens on.
 *
 * @param choice - How many answers apply, carrying whichever were picked before.
 *
 * @returns Those answers, empty when none were picked.
 */
function initialPicksOf<TValue extends string>(choice: FeedbackChoice<TValue>): readonly TValue[] {
  // Read them out per how many of them the question takes
  switch (choice.selection) {
    // A lone answer, or nothing at all
    case 'single':
      return choice.initialValue === null ? [] : [choice.initialValue]
    // However many applied
    case 'multiple':
      return choice.initialValues
    default:
      return assertNever(choice)
  }
}

/**
 * Whether a question has been answered well enough to send.
 *
 * @param picked - The answers standing so far.
 * @param requiresComment - The answer that can't stand without words behind it, or null when none is like that.
 * @param written - The reader's own words, already reduced to the text they carry.
 *
 * @returns True when there is an answer worth sending.
 */
function isAnswered<TValue extends string>(
  picked: readonly TValue[],
  requiresComment: TValue | null,
  written: string
): boolean {
  // Something must be picked, and the answer that says nothing on its own must be spoken for
  return (
    picked.length > 0 &&
    (requiresComment === null || !picked.includes(requiresComment) || written !== '')
  )
}

/**
 * Whether a question stands anywhere other than where it opened, which is what says there is something to send.
 *
 * @param openedPicks - The answers the question opened on.
 * @param picked - The answers standing now.
 * @param openedComment - The words it opened on, as they were handed over.
 * @param written - The reader's words now, already reduced to the text they carry.
 *
 * @returns True when the two differ.
 */
function hasChanged<TValue extends string>(
  openedPicks: readonly TValue[],
  picked: readonly TValue[],
  openedComment: string,
  written: string
): boolean {
  // Different words make it a different answer
  if (written !== openedComment.trim()) {
    return true
  }

  // So does a different set of answers
  return !namesTheSameItems(openedPicks, picked)
}

/**
 * One asking of the question: the answers, the free-text line, and the buttons. Lives below the modal, which
 * mounts it on open and drops it on close, so each asking starts from the answers it was handed and there is
 * no state to reset by hand.
 *
 * @template TValue - The set of answers the question reports.
 */
function FeedbackQuestion<TValue extends string>({
  choice,
  requiresComment,
  requiresCommentHint,
  onClose,
  onRemove,
  title,
  options,
  initialComment,
  commentLabel,
  commentMaxLength,
  isPending,
}: FeedbackQuestionProps<TValue>) {
  // Shared action copy
  const tActions = useTranslations('ui.actions')

  // A unique stem for this question's ids, so two of them can't share a group
  const groupId = useId()

  // The look this question's answers take
  const style = SELECTION_STYLES[choice.selection]

  // The answers the question opened on, held apart from the ones standing now so the two can be told apart
  const [openedPicks] = useState<readonly TValue[]>(() => initialPicksOf(choice))

  // The answers picked so far, empty until one is
  const [picked, setPicked] = useState<readonly TValue[]>(openedPicks)

  // The words it opened on, held under the same rule
  const [openedComment] = useState(initialComment)

  // The reader's own words
  const [comment, setComment] = useState(openedComment)

  // The answer the cursor lands on, which is the first one standing so arrowing off it can't quietly
  // replace a standing answer with its neighbour
  const [focusedValue] = picked.length > 0 ? picked : options.map((option) => option.value)

  // Takes an answer, exclusively or cumulatively as the question allows
  const handlePick = (value: TValue) => {
    // Fold it in per how many answers the question takes
    switch (choice.selection) {
      // The pick stands alone, replacing whatever stood before
      case 'single':
        setPicked([value])
        break
      // The pick joins the others, or leaves them when it was already among them
      case 'multiple':
        setPicked((current) =>
          current.includes(value) ? current.filter((other) => other !== value) : [...current, value]
        )
        break
      default:
        assertNever(choice)
    }
  }

  // The reader's words with nothing but whitespace counting as none
  const written = comment.trim()

  // Whether the field is close enough to its cap that how much is left of it means something
  const isNearCap = comment.length >= commentMaxLength * COMMENT_COUNTER_THRESHOLD

  // The answer standing first, which is every answer there is in an exclusive question
  const [firstPick] = picked

  // Hands the picked answers and the reader's words to whoever asked
  const handleSubmit = () => {
    // The send button is held back until something is picked, so there is nothing to hand over
    if (firstPick === undefined) {
      return
    }

    // Hand them over in the shape the question reports
    switch (choice.selection) {
      // The one answer standing
      case 'single':
        choice.onSubmit(firstPick, written)
        break
      // Every answer that applies goes together
      case 'multiple':
        choice.onSubmit(picked, written)
        break
      default:
        assertNever(choice)
    }
  }

  return (
    <>
      {/* The question */}
      <h3 id={`${groupId}-title`} className="mb-4 text-lg font-semibold text-foreground">
        {title}
      </h3>

      {/* The answers to pick between */}
      <div role={style.listRole} aria-labelledby={`${groupId}-title`} className="flex flex-col">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
              picked.includes(option.value)
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:bg-foreground/5'
            )}
          >
            <input
              type={style.inputType}
              name={groupId}
              value={option.value}
              checked={picked.includes(option.value)}
              onChange={() => handlePick(option.value)}
              data-autofocus={option.value === focusedValue ? '' : undefined}
              className={cn(style.inputClass, 'shrink-0')}
            />
            <span>
              {option.label}
              {option.value === requiresComment && (
                <span className="text-muted"> ({requiresCommentHint})</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Whatever the list of answers can't say */}
      <label htmlFor={`${groupId}-comment`} className="mt-5 mb-1.5 block text-sm text-muted">
        {commentLabel}
      </label>
      <div className="relative">
        <textarea
          id={`${groupId}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={commentMaxLength}
          aria-describedby={isNearCap ? `${groupId}-comment-count` : undefined}
          rows={3}
          className="form-input resize-none"
        />

        {/* How much room is left, once there is little enough of it to matter. It hangs under the field
            rather than sitting below it, so the first character past the threshold moves nothing */}
        {isNearCap && (
          <p
            id={`${groupId}-comment-count`}
            className="absolute top-full right-0 mt-0.5 text-xs text-muted"
          >
            {comment.length}/{commentMaxLength}
          </p>
        )}
      </div>

      {/* Send it, take back the one already standing, or leave without answering. All three are held back
          while an answer is on its way, so the dialog can't be dismissed out from under the one it is about
          to land */}
      <div className="mt-5 flex items-center justify-end gap-2">
        {/* Offered only where there is something to take back */}
        {onRemove !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isPending}
            className="mr-auto hover:bg-error/10 hover:text-error"
          >
            {tActions('remove')}
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
          {tActions('cancel')}
        </Button>

        {/* An answer already on record is saved rather than sent. It is held back until the question
            stands somewhere other than where it opened:
            sending what already stands would restamp it as freshly said, and nothing on screen would move to
            show for it */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={
            !isAnswered(picked, requiresComment, written) ||
            !hasChanged(openedPicks, picked, openedComment, written)
          }
          loading={isPending}
        >
          {onRemove === null ? tActions('submit') : tActions('save')}
        </Button>
      </div>
    </>
  )
}

/**
 * A dialog asking one question: a short list of answers to pick from, and a free-text line under it for whatever
 * the list can't say. Both what the answers are and what is done with them belong to the caller, so one dialog
 * serves any question with a short, fixed set of answers.
 *
 * Taking an answer back off the record belongs to the caller too: it hands the dialog a way out only when there
 * is something standing to take back, and owns whatever confirming it involves.
 *
 * @template TValue - The set of answers the dialog reports.
 */
export function FeedbackDialog<TValue extends string>({
  isOpen,
  onClose,
  isPending,
  ...question
}: FeedbackDialogProps<TValue>) {
  // Whether the question still counts as being sent. An answer that lands clears the caller's pending flag and
  // closes the dialog in the same breath, and the two need not land together; going by the flag alone would
  // drop the send button out of its spinner while the question is still up, so it stands until the dialog
  // is gone.
  const [isSending, setIsSending] = useState(false)

  // An answer that has just gone out stands as being sent
  if (isPending && !isSending) {
    setIsSending(true)
  }

  // It came back with the dialog still up, so it was refused and there is something to answer again
  if (isSending && !isPending && isOpen) {
    setIsSending(false)
  }

  // An answer on its way owns the dialog until it lands, so escape and the backdrop leave it standing the
  // same way the buttons do; whoever asked closes it themselves once they have the answer
  const handleClose = () => {
    // Only a question with nothing in flight can be dismissed
    if (!isSending) {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-sm"
      showCloseButton={false}
      ariaLabel={question.title}
    >
      <FeedbackQuestion onClose={handleClose} isPending={isSending} {...question} />
    </Modal>
  )
}
