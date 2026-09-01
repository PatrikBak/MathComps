import { useTranslations } from 'next-intl'

import { MathildaWordmark } from '@/components/features/defense/components/MathildaWordmark'
import { ProseLink } from '@/components/shared/components/ProseLink'
import { ROUTES } from '@/i18n/i18n'

import { HomeSection, SectionHeading } from './HomeSection'
import { MathildaExcerpt } from './MathildaExcerpt'

/**
 * The introduction to Mathilda, the AI tutor: what she does beside a short defense showing it, and the
 * way through to the problems she works on.
 */
export default function MathildaSection() {
  // Copy for the section
  const t = useTranslations('home.mathilda')

  return (
    <HomeSection className="py-10 sm:py-14">
      <div className="grid items-start gap-8 md:grid-cols-2 md:gap-12">
        {/* Who she is */}
        <div>
          {/* Her name */}
          <SectionHeading className="text-3xl hyphens-none sm:text-4xl">
            <MathildaWordmark />
          </SectionHeading>

          {/* What she does */}
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            {t.rich('body', {
              link: (chunks) => <ProseLink href={ROUTES.HANDOUTS}>{chunks}</ProseLink>,
            })}
          </p>
        </div>

        {/* A sample defense */}
        <MathildaExcerpt />
      </div>
    </HomeSection>
  )
}
