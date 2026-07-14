import { FileText, GitBranch, type LucideIcon, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ROUTES } from '@/i18n/i18n'

import { HomeSection, SectionHeading } from './HomeSection'
import { IndexEntry, IndexList } from './IndexEntry'

/**
 * One of the site's three destinations.
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
 * The three places the site opens onto: the problem archive, the handouts, and the guide.
 */
export default function DestinationsSection() {
  // Copy for the destinations
  const t = useTranslations('home.destinations')

  // The three destinations in reading order
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

      {/* The three destinations */}
      <IndexList as="ul" className="[&>li:last-child>a]:border-b-0">
        {destinations.map((destination) => (
          <li key={destination.href}>
            <IndexEntry kind="link" {...destination} />
          </li>
        ))}
      </IndexList>
    </HomeSection>
  )
}
