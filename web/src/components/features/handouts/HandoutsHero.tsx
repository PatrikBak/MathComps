import { useTranslations } from 'next-intl'

/**
 * The top section of the handouts list page.
 */
export function HandoutsHero() {
  // Translations for the handouts hero section
  const t = useTranslations('handouts.hero')

  return (
    <section className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-5 sm:p-8 md:p-10 mb-8 sm:mb-12 md:mb-16">
      <h1 className="text-2xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-white">
        {t('title')}
      </h1>
      <p className="mt-2.5 sm:mt-4 text-sm sm:text-lg text-gray-300/90 leading-relaxed">
        {t('description')}
      </p>
    </section>
  )
}
