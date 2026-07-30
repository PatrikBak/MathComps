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
  /** Opens the answer dialog. */
  onOpen: () => void
}

/**
 * Where the conversation ends: a quiet line asking how it went, which stands as the record of having answered
 * once the student does, and reopens for them to revise. Sits in the transcript's scroll flow, so it is
 * reachable exactly when the student has read to the end and is deciding whether they are done, and steps aside
 * while the examiner is working, returning under whichever turn is last by then.
 *
 * The answer itself stays in the dialog rather than being echoed here: it is a first-person line, and a
 * transcript that ends on one reads as something the student said to the examiner.
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
        {/* The answer stands, so mark it as given rather than asking again */}
        {isAnswered && <Check size={13} className="shrink-0" />}
        {isAnswered ? answeredLabel : questionLabel}
      </Button>
    </div>
  )
}
