import { Link2, List, type LucideIcon, Mail, MedalIcon, Target, Trophy } from 'lucide-react'

import type { GuidePage } from './guide-content-types'

/** The icon for each deck page. */
export const PAGE_ICONS: Record<GuidePage, LucideIcon> = {
  why: Trophy,
  olympiad: MedalIcon,
  other: List,
  seminars: Mail,
  resources: Link2,
  getStarted: Target,
}
