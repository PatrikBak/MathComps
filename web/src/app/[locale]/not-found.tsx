import { FileQuestion, Home } from 'lucide-react'
import { useTranslations } from 'next-intl'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'
import Layout from '@/components/layout/Layout'
import { AppLink } from '@/components/shared/components/AppLink'
import GradientText from '@/components/shared/components/GradientText'
import { ROUTES } from '@/i18n/i18n'

/**
 * Localized 404 page rendered when notFound() is called within a [locale] route.
 */
export default function NotFound() {
  // Get the page translations
  const t = useTranslations('notFound')

  return (
    <Layout centerMidscreen>
      <ParticleSystem />
      <FloatingMath />
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="mb-4 sm:mb-6 [&>svg]:w-16 [&>svg]:h-16 [&>svg]:sm:w-20 [&>svg]:sm:h-20">
          <FileQuestion className="mx-auto" size={64} />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black leading-tight sm:leading-none tracking-tight mb-4 sm:mb-6">
          <GradientText>{t('title')}</GradientText>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground mb-6">{t('description')}</p>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center">
          <AppLink
            href={ROUTES.HOME}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg px-6 py-3 text-lg font-semibold bg-brand text-brand-foreground hover:bg-brand-hover transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Home size={20} />
            {t('homeButton')}
          </AppLink>
        </div>
      </div>
    </Layout>
  )
}
