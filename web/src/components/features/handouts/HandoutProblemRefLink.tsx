'use client'

import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

import type { HandoutProblemLabel } from './handout-problem-label'
import { type HandoutProblemRefEmphasis, HandoutProblemRefLabel } from './HandoutProblemRefLabel'

/**
 * Props for the {@link HandoutProblemRefLink} component.
 */
type HandoutProblemRefLinkProps = {
  /** The problem being named. */
  label: HandoutProblemLabel
  /** How much weight the handout's title is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Which problem of which handout something was about, as the way to go and read it.
 *
 * A problem outlives the page that held it, and a handout is not published in every language, so the same line
 * has to read with nowhere to go: both shapes keep the one layout, so nothing moves between them.
 *
 * It opens a tab of its own, since whatever the line is written beside is what the reader is in the middle of.
 *
 * The ring is drawn within the link's own box, since the line it sits on gives way when it runs out of room and
 * clips anything drawn outside that box.
 */
export function HandoutProblemRefLink({ label, emphasis }: HandoutProblemRefLinkProps) {
  // Handout-surface copy
  const t = useTranslations('handouts')

  // The line itself, which reads the same either way
  const line = <HandoutProblemRefLabel label={label} emphasis={emphasis} />

  // The row the line sits on, held back out of the padding so the text starts where it would without it
  const rowClass = '-mx-1 flex min-w-0 items-baseline gap-2 px-1'

  // Nowhere to send the reader
  if (label.link === null) {
    return <span className={rowClass}>{line}</span>
  }

  // The problem in its handout, a tab away
  return (
    <AppLink
      href={label.link.href}
      plain
      newTab
      title={t('labels.goToHandout')}
      className={cn(
        rowClass,
        'rounded-sm underline-offset-2 hover:underline',
        FOCUS_RING_INSET_CLASS
      )}
    >
      {line}
      <ArrowUpRight size={12} className="shrink-0 self-center" aria-hidden="true" />
    </AppLink>
  )
}
