import { useTranslations } from 'next-intl'

import AnimatedSection from '@/components/shared/components/AnimatedSection'

import { AboutProse } from './layout/AboutProse'
import BeatLabel from './layout/BeatLabel'

/**
 * The "why" beat: the origin story and what the project is.
 */
export const StorySection = () => {
  // Translations for section
  const t = useTranslations('about.story')

  return (
    <AnimatedSection id="mathcomps-story" eager>
      <BeatLabel>{t('title')}</BeatLabel>
      <AboutProse className="mt-5 space-y-5">
        <p>{t('text1')}</p>
        <p>{t('text2')}</p>
        <p>{t('text3')}</p>
        <p>{t('text4')}</p>
      </AboutProse>
    </AnimatedSection>
  )
}
