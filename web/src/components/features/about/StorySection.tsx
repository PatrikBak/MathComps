import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'

import AboutPanelSection from './layout/AboutPanelSection'

export const StorySection = () => {
  // Translations for section
  const t = useTranslations('about.story')

  return (
    <AboutPanelSection
      id="mathcomps-story"
      title={t('title')}
      description={
        <>
          {t('text1')}
          <br />
          <br />
          {t.rich('text2', {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
          <br />
          <br />
          {t.rich('text3', {
            link: (chunks) => (
              <AppLink
                href="https://www.wincent.com/"
                newTab
                className="text-slate-300 hover:text-white hover:underline transition-colors duration-300"
              >
                {chunks}
              </AppLink>
            ),
          })}
          <br />
          <br />
          {t('text4')}
        </>
      }
    ></AboutPanelSection>
  )
}
