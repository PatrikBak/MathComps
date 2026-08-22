'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'

import { useCategoryName } from '../hooks/use-category-name'
import { isPracticeGroup } from '../model/hosted-competition-state'
import type { HostedCompetition, HostedCompetitionGroup } from '../model/hosted-competition-types'

/**
 * A native control's focus mark, drawn as an outline.
 *
 * WebKit paints no box-shadow on a form control, so the shared ring would leave the controls this dialog
 * has to be driven through with no visible focus at all.
 */
const NATIVE_FOCUS_CLASS =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * Props for the {@link HostedCompetitionEntryDialog} component.
 */
type HostedCompetitionEntryDialogProps = {
  /** The group the competition runs in. */
  group: HostedCompetitionGroup
  /** The competition being entered. */
  competition: HostedCompetition
  /** Whether the student has yet to accept the rules, which is true of a first entry ever and no other. */
  needsRulesAccept: boolean
  /** Drops the question without entering. */
  onClose: () => void
  /** Answers it, which takes the entry and starts the clock. */
  onConfirm: () => void
  /** Answers it the other way, spending the entry on the problems and starting no clock. */
  onForfeit: () => void
  /** Whether an entry or a forfeit is in flight. */
  isEntering: boolean
}

/**
 * The last thing between a student and a running clock, the press behind it being one that cannot be taken
 * back or repeated.
 *
 * It says what the press does, and on a first entry ever holds the rules and the box that accepts them.
 *
 * The other thing an entry can be spent on lives here too: reading the problems and not competing, asked
 * as its own question in the same shell.
 *
 * Rendered only while a competition is being asked about, so the acceptance never arrives already ticked
 * from the last time it was open.
 */
export function HostedCompetitionEntryDialog({
  group,
  competition,
  needsRulesAccept,
  onClose,
  onConfirm,
  onForfeit,
  isEntering,
}: HostedCompetitionEntryDialogProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The rules' own copy, read from its own namespace so the lines come back as the array they are
  const tRules = useTranslations('competitions.rules')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // The language the group is named in
  const locale = useLocale() as Locale

  // What its level is called
  const categoryName = useCategoryName()

  // Whether the student has accepted the rules on this dialog
  const [hasAccepted, setHasAccepted] = useState(false)

  // Whether the dialog is on the forfeit's own question rather than on the entry's
  const [isForfeitAsked, setIsForfeitAsked] = useState(false)

  // Whether giving up is on the table at all: the practice one can be taken again whenever they like, so
  // there is nothing to spend
  const canForfeit = !isPracticeGroup(group)

  // The lines the student is shown before every entry, not just their first
  const reminders = tRules.raw('lines') as string[]

  // Nothing to press until, on a first entry ever, the rules are accepted
  const isBlocked = needsRulesAccept && !hasAccepted

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        competition.category === null
          ? group.name[locale]
          : t('dialog.title', {
              group: group.name[locale],
              category: categoryName(competition.category),
            })
      }
      showCloseButton={false}
      className="max-w-lg hyphens-none"
      // Nothing is focused ahead of the reader on a dialog whose primary button cannot be undone
      focusPanelOnOpen
    >
      {isForfeitAsked ? (
        <>
          {/* What giving up costs, which is the entry itself and every chance at a result from it */}
          <p className="text-sm leading-relaxed text-foreground/80">
            {t('dialog.forfeitConsequence')}
          </p>

          {/* Back out of it, or go through with it */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsForfeitAsked(false)}>
              {t('dialog.back')}
            </Button>
            <Button variant="subtle" loading={isEntering} onClick={onForfeit}>
              {t('dialog.forfeitConfirm')}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* What pressing the button does */}
          <p className="text-sm leading-relaxed text-foreground/80">
            {isPracticeGroup(group) ? t('dialog.consequencePractice') : t('dialog.consequence')}
          </p>

          {/* The rules, in plain sight on the one entry that accepts them. Every later entry reaches them
          from the page header instead */}
          {needsRulesAccept && (
            <section className="mt-4 rounded-lg bg-foreground/5 p-4">
              <h3 className="text-sm font-semibold text-foreground">{tRules('title')}</h3>
              <ul className="mt-2 list-outside list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-muted/60">
                {reminders.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Accepting them, which is asked once ever */}
          {needsRulesAccept && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(event) => setHasAccepted(event.target.checked)}
                className={cn('mt-0.5 size-4 shrink-0 accent-brand', NATIVE_FOCUS_CLASS)}
              />
              {tRules('accept')}
            </label>
          )}

          {/* Backing out, going ahead, and the third way through: reading the problems and not competing,
              set apart from the pair and worded as what it costs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canForfeit && (
              <Button variant="link" size="sm" onClick={() => setIsForfeitAsked(true)}>
                {t('dialog.forfeit')}
              </Button>
            )}

            <div className="ml-auto flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                {tActions('cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={isBlocked}
                loading={isEntering}
                onClick={onConfirm}
              >
                {t('dialog.confirm')}
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
