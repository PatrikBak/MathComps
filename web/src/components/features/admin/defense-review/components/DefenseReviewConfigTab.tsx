'use client'

import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'

import type {
  ExaminerConfigSnapshot,
  ExaminerNote,
  ExaminerNotesSnapshot,
  ExaminerStep,
  ExaminerStepSnapshot,
} from '../model/defense-review-types'
import { EXAMINER_STEPS } from '../model/defense-review-types'
import { PromptTextModal } from './PromptTextModal'

/**
 * A piece of the examiner's instructions being read: a step's prompt template, or one of the notes its prompt was
 * filled with. The two are named and stored differently, so this carries the resolved title and text.
 */
type OpenPromptText = {
  /** The name of what is being read. */
  title: string
  /** The piece's text, uninterpolated. */
  text: string
}

/**
 * Props for the {@link DefenseReviewConfigTab} component.
 */
type DefenseReviewConfigTabProps = {
  /** The examiner settings the conversation ran on. */
  config: ExaminerConfigSnapshot
}

/**
 * What the examiner was running on: the models and limits per step, the prompt template each ran, and the notes the
 * reply's prompt was filled with.
 *
 * The settings read down the steps rather than across them. Across is the shape that invites comparison, but
 * the panel this sits in is narrower than a row of model names, so that shape could only ever be reached
 * through a sideways scrollbar, and the labels beside it were losing their own column to hyphenation. Each
 * step's label and value columns hold a fixed width so the steps read as one column of values rather than
 * several ragged ones.
 *
 * A template runs to thousands of characters, so it is fetched on asking and read in a dialog rather than
 * filling a panel it would have to be read sideways in. The notes are read in the same dialog.
 */
export function DefenseReviewConfigTab({ config }: DefenseReviewConfigTabProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.config')

  // What is being read at full width; null while nothing is
  const [openPrompt, setOpenPrompt] = useState<OpenPromptText | null>(null)

  // A conversation held before the settings were recorded carries nothing to show
  if (config.generate === undefined) {
    return <div className="px-5 py-6 text-sm text-muted">{t('unknown')}</div>
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
      {/* The one setting that isn't per step */}
      <p className="text-sm text-muted">
        {t('maxRevisions')}: <span className="text-foreground">{config.maxRevisions ?? '—'}</span>
      </p>

      {/* What each step ran on, and the way into what it was told */}
      <div className="mt-5 flex flex-col gap-5">
        {EXAMINER_STEPS.map((step) => (
          <StepSettings
            key={step}
            step={step}
            snapshot={config[step]}
            onOpenPrompt={setOpenPrompt}
          />
        ))}

        {/* What a flagged reply was sent back under, for a conversation that recorded it */}
        {config.notes !== undefined && (
          <NoteSettings notes={config.notes} onOpenPrompt={setOpenPrompt} />
        )}
      </div>

      {/* Whichever piece of the instructions is being read */}
      <PromptTextModal
        title={openPrompt?.title ?? ''}
        text={openPrompt?.text ?? null}
        onClose={() => setOpenPrompt(null)}
      />
    </div>
  )
}

/**
 * Props for the {@link StepSettings} component.
 */
type StepSettingsProps = {
  /** Which step it is. */
  step: ExaminerStep
  /** What was recorded for it; absent for a step the snapshot never held. */
  snapshot: ExaminerStepSnapshot | undefined
  /** Opens a piece of the instructions for reading. */
  onOpenPrompt: (prompt: OpenPromptText) => void
}

/**
 * One step's settings, under its name.
 */
function StepSettings({ step, snapshot, onOpenPrompt }: StepSettingsProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.config')

  // What it was told, absent for a step recorded before the templates were kept
  const promptText = snapshot?.promptText

  return (
    <section>
      {/* The step's name */}
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground">
        {t(`steps.${step}`)}
      </h3>

      {/* What it ran on, label against value */}
      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1 text-sm">
        {/* The model */}
        <SettingEntry label={t('model')} value={snapshot?.model} />

        {/* Where it was routed when the primary failed, where an empty chain means nowhere */}
        <SettingEntry
          label={t('fallbackModels')}
          value={
            snapshot === undefined
              ? undefined
              : snapshot.fallbackModels === undefined || snapshot.fallbackModels.length === 0
                ? t('fallbackModelsNone')
                : snapshot.fallbackModels.join(', ')
          }
        />

        {/* How hard it was told to think, where no effort recorded means it ran at none */}
        <SettingEntry
          label={t('reasoningEffort')}
          value={
            snapshot === undefined
              ? undefined
              : (snapshot.reasoningEffort ?? t('reasoningEffortNone'))
          }
        />

        {/* How much it could say, where no cap recorded means whatever the model gives */}
        <SettingEntry
          label={t('maxOutputTokens')}
          value={
            snapshot === undefined
              ? undefined
              : snapshot.maxOutputTokens === undefined
                ? t('modelDefault')
                : String(snapshot.maxOutputTokens)
          }
        />
      </dl>

      {/* The way into what it was told, for a step that recorded it */}
      {promptText !== undefined && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => onOpenPrompt({ title: t(`steps.${step}`), text: promptText })}
        >
          <FileText size={14} aria-hidden="true" />
          {t('prompt')}
          <span className="text-xs text-muted">
            {t('promptChars', { count: promptText.length })}
          </span>
        </Button>
      )}
    </section>
  )
}

/**
 * Props for the {@link NoteSettings} component.
 */
type NoteSettingsProps = {
  /** The notes the reply step's prompt was filled with. */
  notes: ExaminerNotesSnapshot
  /** Opens a piece of the instructions for reading. */
  onOpenPrompt: (prompt: OpenPromptText) => void
}

/**
 * The notes the reply step's prompt was filled with, each a way into what it said. They carry no settings of their
 * own, so they read as a row of names.
 */
function NoteSettings({ notes, onOpenPrompt }: NoteSettingsProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.config')

  // Which notes were recorded, in the order the snapshot holds them
  const recorded = Object.keys(notes) as ExaminerNote[]

  return (
    <section>
      {/* What the block is */}
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground">
        {t('notes.title')}
      </h3>

      {/* One way in per note the snapshot recorded */}
      <div className="flex flex-wrap gap-2">
        {recorded.map((note) => {
          // What the note said, absent for one the snapshot holds no text for
          const text = notes[note]?.text

          // The note's name
          const title = t(`notes.${note}`)

          // A note whose text went unrecorded has nothing to open
          return text === undefined ? null : (
            <Button
              key={note}
              variant="outline"
              size="sm"
              onClick={() => onOpenPrompt({ title, text })}
            >
              <FileText size={14} aria-hidden="true" />
              {title}
            </Button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Props for the {@link SettingEntry} component.
 */
type SettingEntryProps = {
  /** What the setting is called. */
  label: string
  /** What it was set to; absent for one the snapshot never held. */
  value: string | undefined
}

/**
 * One setting of one step.
 */
function SettingEntry({ label, value }: SettingEntryProps) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words text-muted-foreground">{value ?? '—'}</dd>
    </>
  )
}
