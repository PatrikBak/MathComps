'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'

/**
 * Props for the {@link DefenseFeedbackPrompt}.
 */
type DefenseFeedbackPromptProps = {
  /** Whether the student has already said how the conversation went. */
  isAnswered: boolean
  /** Opens the question for them to answer. */
  onOpen: () => void
}

/**
 * A quiet line asking how the conversation went, which carries the answer once the student gives one and
 * reopens for them to revise it. Carries no spacing of its own, since where it sits is the transcript's
 * business.
 */
export function DefenseFeedbackPrompt({ isAnswered, onOpen }: DefenseFeedbackPromptProps) {
  // Defense copy
  const t = useTranslations('defense')

  return (
    <div className="flex justify-center">
      <Button
        variant="outline"
        size="sm"
        shape="pill"
        onClick={onOpen}
        className="min-h-0 gap-1.5 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {/* A check once the answer stands */}
        {isAnswered && <Check size={13} className="shrink-0" />}
        {isAnswered ? t('feedbackGiven') : t('feedbackTitle')}
      </Button>
    </div>
  )
}
