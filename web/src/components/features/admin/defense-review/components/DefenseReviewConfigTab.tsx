'use client'

import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'

import type { ExaminerConfigSnapshot, ExaminerStepSnapshot } from '../model/defense-review-types'
import { PromptTextModal } from './PromptTextModal'

/**
 * The examiner's steps, in the order they run.
 */
const STEPS = ['generate', 'mathCheck', 'leakCheck', 'languageCheck'] as const

/**
 * One of the examiner's steps.
 */
type ExaminerStep = (typeof STEPS)[number]

/**
 * Props for the {@link DefenseReviewConfigTab} component.
 */
type DefenseReviewConfigTabProps = {
  /** The examiner settings the conversation ran on. */
  config: ExaminerConfigSnapshot
}

/**
 * What the examiner was running on: the models and limits per step, and the prompt template each ran.
 *
 * The settings read down the steps rather than across them. Across is the shape that invites comparison, but
 * the panel this sits in is narrower than a row of model names, so that shape could only ever be reached
 * through a sideways scrollbar, and the labels beside it were losing their own column to hyphenation. Each
 * step's label and value columns hold a fixed width so the steps read as one column of values rather than
 * several ragged ones.
 *
 * A template runs to thousands of characters, so it is fetched on asking and read in a dialog rather than
 * filling a panel it would have to be read sideways in.
 */
export function DefenseReviewConfigTab({ config }: DefenseReviewConfigTabProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview.config')

  // Whose prompt template is being read; null while none is
  const [openStep, setOpenStep] = useState<ExaminerStep | null>(null)

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
        {STEPS.map((step) => (
          <StepSettings key={step} step={step} snapshot={config[step]} onOpenPrompt={setOpenStep} />
        ))}
      </div>

      {/* Whichever template is being read */}
      <PromptTextModal
        title={openStep === null ? '' : t(`steps.${openStep}`)}
        text={openStep === null ? null : (config[openStep]?.promptText ?? null)}
        onClose={() => setOpenStep(null)}
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
  /** Opens a step's prompt template for reading. */
  onOpenPrompt: (step: ExaminerStep) => void
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
        <Button variant="outline" size="sm" className="mt-2" onClick={() => onOpenPrompt(step)}>
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
