import { MessagesSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { HomeSection, SectionHeading } from './HomeSection'
import { IndexEntry, IndexList } from './IndexEntry'

/**
 * The roadmap section: what's planned but not shipped yet.
 */
export default function UpcomingSection() {
  // Copy for the section
  const t = useTranslations('home.upcoming')

  return (
    <HomeSection>
      {/* Section heading */}
      <SectionHeading>{t('title')}</SectionHeading>

      {/* The upcoming feature */}
      <IndexList className="mt-4 px-4 pt-5">
        <IndexEntry
          kind="static"
          icon={MessagesSquare}
          title={t('feature.title')}
          description={t('feature.description')}
          meta={t('comingSoon')}
        />
      </IndexList>
    </HomeSection>
  )
}
