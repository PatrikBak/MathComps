import { useTranslations } from 'next-intl'

import ContactButton from '@/components/features/contact/ContactButton'
import { AppLink } from '@/components/shared/components/AppLink'
import { ANCHORS, getLocalizedAnchor, type Locale, ROUTES } from '@/i18n/i18n'

import { HandoutStyleBadge } from './HandoutStyleBadge'

/** The url for the courses website */
const KROUZKY_URL = 'https://www.matikacesku.cz/matematicke-krouzky-prihlaseni'

/**
 * The top section of the handouts list page — title, intro paragraph,
 * the two-bullet explanation of the source types (with inline badges and
 * external link to the math circles), and a closing feedback paragraph.
 */
export function HandoutsHero({ locale }: { locale: Locale }) {
  // Translations for the handouts hero section and source badge labels
  const t = useTranslations('handouts.hero')
  const tStyles = useTranslations('handouts.styles')

  return (
    <section className="rounded-xl border border-foreground/10 bg-foreground/5 p-5 sm:p-8 md:p-10 mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-foreground">
        {t('title')}
      </h1>

      <p className="mt-2.5 sm:mt-4 text-sm sm:text-base text-foreground/70 leading-relaxed">
        {t.rich('intro', {
          author: (chunks) => (
            <AppLink
              href={`${ROUTES.ABOUT}#${getLocalizedAnchor(ANCHORS.ABOUT_AUTHOR, locale)}`}
              className="text-link hover:text-link-hover"
            >
              {chunks}
            </AppLink>
          ),
        })}
      </p>

      <ul className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 text-sm sm:text-base text-foreground/70 leading-relaxed list-disc pl-5 marker:text-foreground/40">
        <li>
          {t.rich('matikaCeskuItem', {
            matikaCesku: () => (
              <HandoutStyleBadge source="matikaCesku" label={tStyles('matikaCesku')} />
            ),
            link: (chunks) => (
              <AppLink
                href={KROUZKY_URL}
                external
                newTab
                className="text-link hover:text-link-hover"
              >
                {chunks}
              </AppLink>
            ),
          })}
        </li>
        <li>
          {t.rich('eventsItem', {
            events: () => <HandoutStyleBadge source="events" label={tStyles('events')} />,
          })}
        </li>
      </ul>

      <p className="mt-3 sm:mt-4 text-sm sm:text-base text-foreground/70 leading-relaxed">
        {t.rich('outro', {
          feedback: (chunks) => (
            <ContactButton reason="feedback" className="text-link hover:text-link-hover">
              {chunks}
            </ContactButton>
          ),
        })}
      </p>
    </section>
  )
}
