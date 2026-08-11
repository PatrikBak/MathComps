'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'

import { NoteChoiceChip } from './NoteChoiceChip'
import { NoteChoiceRow } from './NoteChoiceRow'
import { type NoteTargetChoiceProps, NoteTargetScrubber } from './NoteTargetScrubber'

/** How many reply chips still fit beside the conversation's own on one line. */
const CHIP_ROW_LIMIT = 5

/**
 * The replies a note can stand against, a chip each.
 *
 * The chips past the first are bare numbers on screen, since a row of them spelled out in full repeats the
 * same phrase for every reply; each still announces itself in full to assistive tech.
 */
function NoteTargetChips({ targets, turnId, onTurnIdChange }: NoteTargetChoiceProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // The name tying these chips into one radio group, kept off any other group on screen
  const groupName = useId()

  return (
    <>
      {/* The conversation as a whole, and then every reply in it */}
      {[null, ...targets].map((target) => (
        <NoteChoiceChip
          key={target?.id ?? 'conversation'}
          groupName={groupName}
          label={target === null ? t('wholeConversation') : String(target.sequence)}
          accessibleLabel={
            target === null ? t('onConversation') : t('onTurn', { sequence: target.sequence })
          }
          isSelected={turnId === (target?.id ?? null)}
          onSelect={() => onTurnIdChange(target?.id ?? null)}
        />
      ))}
    </>
  )
}

/**
 * Which reply a new note stands against, offered whichever way the conversation's length calls for.
 *
 * Chips are the plainer control and what a short conversation gets: every reply on screen at once, one click
 * each. Past a line of them the row wraps into a keypad standing over the composer, so a longer conversation
 * is run through with a thumb instead.
 */
export function NoteTargetRow({ targets, turnId, onTurnIdChange }: NoteTargetChoiceProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.notes')

  // A conversation nobody has replied in yet leaves a note nothing to stand against but the conversation,
  // and a choice of one is no choice
  if (targets.length === 0) return null

  return (
    <NoteChoiceRow label={t('target')}>
      {targets.length <= CHIP_ROW_LIMIT ? (
        <NoteTargetChips targets={targets} turnId={turnId} onTurnIdChange={onTurnIdChange} />
      ) : (
        <NoteTargetScrubber targets={targets} turnId={turnId} onTurnIdChange={onTurnIdChange} />
      )}
    </NoteChoiceRow>
  )
}
