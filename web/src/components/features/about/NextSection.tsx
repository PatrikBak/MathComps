import { useTranslations } from 'next-intl'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { ProseLink } from '@/components/shared/components/ProseLink'
import { GLOBAL_TALENT_FUND_URL, MATIKA_CESKU_URL, WINCENT_URL } from '@/constants/links'

import { AboutProse } from './layout/AboutProse'
import BeatLabel from './layout/BeatLabel'

/**
 * The "what next" beat: the vision, what funds the work, the ask, and the nonprofit's registration
 * facts.
 */
export const NextSection = () => {
  // Translations for section
  const t = useTranslations('about.next')

  return (
    <AnimatedSection id="mathcomps-next" eager>
      <BeatLabel>{t('title')}</BeatLabel>
      <AboutProse className="mt-5 space-y-5">
        <p>{t('text1')}</p>
        {/* Funders, each linked by name */}
        <p>
          {t.rich('text2', {
            wincent: (chunks) => (
              <ProseLink href={WINCENT_URL} newTab>
                {chunks}
              </ProseLink>
            ),
            matika: (chunks) => (
              <ProseLink href={MATIKA_CESKU_URL} newTab>
                {chunks}
              </ProseLink>
            ),
            gtf: (chunks) => (
              <ProseLink href={GLOBAL_TALENT_FUND_URL} newTab>
                {chunks}
              </ProseLink>
            ),
          })}
        </p>
        {/* Link opens the contact modal */}
        <p className="text-foreground">
          {t.rich('text3', {
            link: (chunks) => <ProseContactLink reason="other">{chunks}</ProseContactLink>,
          })}
        </p>
      </AboutProse>
      <p className="mt-8 border-t border-foreground/10 pt-5 text-sm leading-relaxed text-muted hyphens-none">
        {t('registration')}
      </p>
    </AnimatedSection>
  )
}
