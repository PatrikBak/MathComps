import { useTranslations } from 'next-intl'

/**
 * The top section of the handouts list page.
 */
export function HandoutsHero() {
  // Translations for the handouts hero section
  const t = useTranslations('handouts.hero')

  return (
    <section className="rounded-xl border border-foreground/10 bg-foreground/5 p-5 sm:p-8 md:p-10 mb-8 sm:mb-12 md:mb-16">
      <h1 className="text-2xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-foreground">
        {t('title')}
      </h1>
      <p className="mt-2.5 sm:mt-4 text-sm sm:text-lg text-foreground/70 leading-relaxed">
        {t('description')}
      </p>
    </section>
  )
}
