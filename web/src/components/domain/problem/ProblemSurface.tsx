'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { PROBLEM_ROW_CLASS, ProblemRowLabel } from '@/components/domain/problem/ProblemRow'
import {
  ProblemSurfaceModal,
  type ProblemSurfaceModalProps,
} from '@/components/domain/problem/ProblemSurfaceModal'

/**
 * Props for the {@link ProblemSurface} component.
 */
type ProblemSurfaceProps = Omit<ProblemSurfaceModalProps, 'heading'> & {
  /** The mark on the row, which is what tells one surface from another at a glance. */
  icon: LucideIcon
  /** The number the problem goes by. */
  position: number
  /** Whether this problem is the one whose surface is being read. */
  isOpen: boolean
  /** Opens the surface. */
  onOpen: () => void
  /** How many things are on the surface, said on the row; null where the row counts nothing. */
  count: number | null
}

/**
 * A row under one problem of a set that opens a {@link ProblemSurfaceModal} about it. The row carries the modal's
 * name, and the modal is headed by the problem's number.
 */
export function ProblemSurface({
  icon,
  position,
  isOpen,
  onOpen,
  count,
  ...surface
}: ProblemSurfaceProps) {
  // Shared content copy
  const tContent = useTranslations('ui.content')

  // What the row counts, if it counts anything
  const rowCount = count === null ? null : { value: count }

  return (
    <>
      {/* The row */}
      <button type="button" onClick={onOpen} className={PROBLEM_ROW_CLASS}>
        <ProblemRowLabel label={surface.label} icon={icon} count={rowCount} />
      </button>

      {/* The surface */}
      {isOpen && (
        <ProblemSurfaceModal {...surface} heading={tContent('problemHeading', { position })} />
      )}
    </>
  )
}
