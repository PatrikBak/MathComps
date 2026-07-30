'use client'

import { Check } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'

/**
 * Props for the {@link DefenseFeedbackPrompt}.
 */
type DefenseFeedbackPromptProps = {
  /** Whether the student has already said how the conversation went. */
  isAnswered: boolean
  /** What the line reads once they have. */
  answeredLabel: string
  /** The question asked of a conversation nobody has summed up yet. */
  questionLabel: string
  /** Opens the question for them to answer. */
  onOpen: () => void
}

/**
 * A quiet line asking how the conversation went, which carries the answer once the student gives one and
 * reopens for them to revise it.
 */
export function DefenseFeedbackPrompt({
  isAnswered,
  answeredLabel,
  questionLabel,
  onOpen,
}: DefenseFeedbackPromptProps) {
  return (
    <div className="flex justify-center pt-2 pb-1">
      <Button
        variant="outline"
        size="sm"
        shape="pill"
        onClick={onOpen}
        className="min-h-0 gap-1.5 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {/* A check once the answer stands */}
        {isAnswered && <Check size={13} className="shrink-0" />}
        {isAnswered ? answeredLabel : questionLabel}
      </Button>
    </div>
  )
}
