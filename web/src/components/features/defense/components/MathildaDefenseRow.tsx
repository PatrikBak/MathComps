'use client'

import { ArrowUpRight, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { ComponentProps, MouseEvent, ReactNode, RefObject } from 'react'

import { HandoutProblemRefLabel } from '@/components/features/handouts/HandoutProblemRefLabel'
import { useHandoutProblemLabel } from '@/components/features/handouts/use-handout-problem-label'
import { useIsCurrentHandout } from '@/components/features/handouts/use-is-current-handout'
import { competitionAreaHref } from '@/components/features/hosted-competitions/services/hosted-competition-routes'
import { AppLink } from '@/components/shared/components/AppLink'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { toPlainTextPreview } from '@/components/shared/utils/string-utils'

import type {
  DefenseSessionListItem,
  NamedHandoutTarget,
  NamedProblemTarget,
} from '../model/defense-types'
import { DefenseTargetLabel } from './DefenseTargetLabel'

/**
 * What every row of the list is handed about the defense it stands for and the way into its conversation.
 * Each kind of row builds its own props on top of it.
 */
type DefenseRowProps = {
  /** The defense this row stands for. */
  defense: DefenseSessionListItem
  /** Holds this row's control when it is the one to return focus to, else null. */
  openRef: RefObject<HTMLButtonElement | null> | null
  /** Opens this defense's conversation. */
  onOpen: (defense: DefenseSessionListItem) => void
}

/**
 * Props for the {@link MathildaDefenseRow} component, which every kind of row is handed in full.
 */
type MathildaDefenseRowProps = DefenseRowProps & {
  /** Arms the delete confirmation for this defense. */
  onDelete: (defense: DefenseSessionListItem) => void
  /** Closes the list. */
  onClose: () => void
  /** Closes the list and takes the reader to an anchor on the page they are already on. */
  onJumpInPage: (anchorId: string) => void
}

/**
 * Props for the {@link HandoutDefenseRow} component.
 */
type HandoutDefenseRowProps = MathildaDefenseRowProps & {
  /** The handout problem the defense was about. */
  target: NamedHandoutTarget
}

/**
 * Props for the {@link CompetitionDefenseRow} component.
 */
type CompetitionDefenseRowProps = MathildaDefenseRowProps & {
  /** The competition problem the defense was about. */
  target: NamedProblemTarget
}

/**
 * Props for the {@link DefenseRowShell} component.
 */
type DefenseRowShellProps = DefenseRowProps & {
  /** Arms the delete confirmation, or null for a defense that cannot be dropped. */
  onDelete: ((defense: DefenseSessionListItem) => void) | null
  /** Which problem the defense was about, as it reads on the row. */
  label: ReactNode
  /** The way out to where that problem is read, or null where the site carries it nowhere. */
  jump: ReactNode
}

/**
 * Props for the {@link RowJump} component.
 */
type RowJumpProps = {
  /** Where it leads. */
  href: ComponentProps<typeof AppLink>['href']
  /** What it is called for somebody who cannot see it. */
  label: string
  /** What the press does on top of following the link. */
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * The way out of a row to where its problem is read.
 */
function RowJump({ href, label, onClick }: RowJumpProps) {
  return (
    <AppLink
      href={href}
      plain
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex size-11 items-center justify-center rounded-md transition-colors hover:bg-foreground/10 hover:text-foreground',
        FOCUS_RING_CLASS
      )}
    >
      <ArrowUpRight size={16} />
    </AppLink>
  )
}

/**
 * A row of the list, everything but which problem it was about and where that problem is read. Clicking the
 * row opens the conversation; the trailing controls jump to the problem and drop the defense.
 */
function DefenseRowShell({
  defense,
  openRef,
  onOpen,
  onDelete,
  label,
  jump,
}: DefenseRowShellProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Locale-aware value formatter
  const format = useFormatter()

  // A glimpse of the conversation: the student's most recent message, stripped to plain text. Null
  // while nothing has been said in it yet
  const preview =
    defense.lastStudentMessage === null ? null : toPlainTextPreview(defense.lastStudentMessage)

  // When the conversation last moved, to the minute so same-day defenses stay apart
  const lastActivityAt = format.dateTime(new Date(defense.lastActivityAt), {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <div className="group flex flex-col gap-2 rounded-lg bg-foreground/5 px-3.5 py-2.5 transition-colors hover:bg-foreground/10 min-[400px]:flex-row min-[400px]:items-stretch min-[400px]:gap-3 min-[400px]:pl-4 min-[400px]:pr-3">
      {/* Open the conversation */}
      <button
        ref={openRef}
        type="button"
        onClick={() => onOpen(defense)}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md text-left',
          FOCUS_RING_CLASS
        )}
      >
        {/* Which problem it was about, on as many lines as a panel this narrow needs */}
        <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">{label}</span>

        {/* A glimpse of the conversation, or that nothing has been said in it yet */}
        <span className={cn('w-full truncate text-sm text-muted', preview === null && 'italic')}>
          {preview ?? t('noReplyYet')}
        </span>
      </button>

      {/* The stamp and its controls: a footer under the text until the row is wide enough to hold them beside it */}
      <div className="flex shrink-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:items-end min-[400px]:gap-1">
        <time dateTime={defense.lastActivityAt} className="text-[11px] leading-none text-muted">
          {lastActivityAt}
        </time>

        {/* Delete and jump, in that order so the jump ends every row and the arrows line up down the
            list whether or not the defense beside them can be dropped */}
        <div className="-my-1 flex items-center text-muted">
          {/* Delete the defense, on the rows that offer it */}
          {onDelete !== null && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('deleteSession')}
              onClick={() => onDelete(defense)}
              className="size-11 hover:bg-error/10 hover:text-error"
            >
              <Trash2 size={16} />
            </Button>
          )}

          {/* The way out to where the problem is read */}
          {jump}
        </div>
      </div>
    </div>
  )
}

/**
 * A row for a defense about a handout problem: named from handout content the reader's own side holds, and
 * jumping to the problem inside its handout, which is a scroll rather than a navigation when the reader is
 * already on it.
 */
function HandoutDefenseRow({
  defense,
  target,
  openRef,
  onOpen,
  onDelete,
  onClose,
  onJumpInPage,
}: HandoutDefenseRowProps) {
  // Handout-surface copy
  const tHandouts = useTranslations('handouts')

  // Defense-surface copy
  const tDefense = useTranslations('defense')

  // Which problem of which handout this defense was about, or the words for one that is gone
  const problemLabel = useHandoutProblemLabel(target, tDefense('deletedHandout'))

  // Whether the reader is already reading the handout this defense was about
  const isOnThisHandout = useIsCurrentHandout(problemLabel.link?.handoutSlug ?? null)

  // Sends a jump that stays on this page to the scroll, and lets every other one navigate
  const handleJumpClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Another handout, so the link is the one to carry the reader there
    if (!isOnThisHandout || problemLabel.link === null) {
      onClose()
      return
    }

    // There is nowhere to navigate to, so keep the page as it is
    event.preventDefault()

    // Hand the jump over to be made once the list has left
    onJumpInPage(problemLabel.link.anchorId)
  }

  return (
    <DefenseRowShell
      defense={defense}
      openRef={openRef}
      onOpen={onOpen}
      onDelete={onDelete}
      label={<HandoutProblemRefLabel label={problemLabel} emphasis="strong" />}
      jump={
        problemLabel.link === null ? null : (
          <RowJump
            href={problemLabel.link.href}
            label={tHandouts('labels.goToHandout')}
            onClick={handleJumpClick}
          />
        )
      }
    />
  )
}

/**
 * A row for a defense about a competition problem: named on the way in, since the reader's own side cannot
 * name a competition still under embargo, and jumping to the competition's own area, which is where the
 * problem is read and where the entry it was argued under lives.
 *
 * The drop is offered only where the student is not graded on the run, per {@link DefenseCompetitionRun}.
 */
function CompetitionDefenseRow({
  defense,
  target,
  openRef,
  onOpen,
  onDelete,
  onClose,
}: CompetitionDefenseRowProps) {
  // Competitions copy
  const tCompetitions = useTranslations('competitions')

  return (
    <DefenseRowShell
      defense={defense}
      openRef={openRef}
      onOpen={onOpen}
      onDelete={defense.isGraded ? null : onDelete}
      label={<DefenseTargetLabel target={target} emphasis="strong" />}
      jump={
        <RowJump
          href={competitionAreaHref(target.competitionSlug)}
          label={tCompetitions('goToArea')}
          onClick={onClose}
        />
      }
    />
  )
}

/**
 * One row in the list of a user's defenses. The two kinds of problem are named from different places and
 * read in different places, so each wears its own row over the shared one.
 */
export function MathildaDefenseRow(props: MathildaDefenseRowProps) {
  // The target the defense was held against, which decides which row this is
  const target = props.defense.target

  // Wear the row its kind of problem reads on
  switch (target.kind) {
    // A handout problem
    case 'handout':
      return <HandoutDefenseRow {...props} target={target} />

    // A competition problem
    case 'problem':
      return <CompetitionDefenseRow {...props} target={target} />

    // Every target is handled above
    default:
      return assertNever(target)
  }
}
