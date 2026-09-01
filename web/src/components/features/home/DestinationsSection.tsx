import { FileText, GitBranch, type LucideIcon, Search, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ROUTES } from '@/i18n/i18n'

import { HomeSection, SectionHeading } from './HomeSection'
import { IndexEntry, IndexList } from './IndexEntry'

/**
 * One place the site opens onto.
 */
type Destination = {
  /** The destination's lead icon. */
  icon: LucideIcon
  /** The destination's heading. */
  title: string
  /** A one-line description of what lives there. */
  description: string
  /** The route the entry links to. */
  href: string
}

/**
 * Every place the site opens onto, in the order the header offers them.
 */
export default function DestinationsSection() {
  // Copy for the destinations
  const t = useTranslations('home.destinations')

  // The destinations in reading order
  const destinations: Destination[] = [
    {
      icon: Search,
      title: t('archive.title'),
      description: t('archive.description'),
      href: ROUTES.PROBLEMS,
    },
    {
      icon: FileText,
      title: t('handouts.title'),
      description: t('handouts.description'),
      href: ROUTES.HANDOUTS,
    },
    {
      icon: Trophy,
      title: t('competitions.title'),
      description: t('competitions.description'),
      href: ROUTES.COMPETITIONS,
    },
    {
      icon: GitBranch,
      title: t('guide.title'),
      description: t('guide.description'),
      href: ROUTES.GUIDE,
    },
  ]

  return (
    <HomeSection>
      {/* Section heading */}
      <SectionHeading className="mb-4">{t('title')}</SectionHeading>

      {/* The destinations */}
      <IndexList as="ul" className="[&>li:last-child>a]:border-b-0">
        {destinations.map((destination) => (
          <li key={destination.href}>
            <IndexEntry {...destination} />
          </li>
        ))}
      </IndexList>
    </HomeSection>
  )
}
