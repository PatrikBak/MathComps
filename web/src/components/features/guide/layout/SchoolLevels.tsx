import { GraduationCap } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SchoolLevel } from '../content/guide-content-types'

/**
 * Props for the {@link SchoolLevels} component.
 */
type SchoolLevelsProps = {
  /** The school levels this entity targets, in display order. */
  levels: SchoolLevel[]
}

/**
 * The school-level facet of a card's meta line: a graduation glyph that marks the facet, then the
 * level name(s). Shared by competition and seminar cards.
 */
export function SchoolLevels({ levels }: SchoolLevelsProps) {
  // Localized level names
  const t = useTranslations('guide.schoolLevels')

  // The facet glyph, then the comma-joined level names — kept as one inline unit so they wrap together
  return (
    <span className="inline-flex items-center gap-1">
      {/* The facet marker */}
      <GraduationCap size={14} className="shrink-0" aria-hidden />
      {/* The level name(s) */}
      <span>{levels.map((level) => t(level)).join(', ')}</span>
    </span>
  )
}
