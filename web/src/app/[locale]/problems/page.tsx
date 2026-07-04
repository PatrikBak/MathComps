import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ProblemsIntroSection } from '@/components/features/problems/components/ProblemsIntroSection'
import ProblemsLibrary from '@/components/features/problems/components/ProblemsLibrary'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { type PageProps, withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Resolve the locale from the path
  const { locale } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.problems',
    path: ROUTES.PROBLEMS,
    useSection: true,
  })
}

/**
 * Page component, no footer for it takes too much precious space.
 */
export default withLocale(async function ProblemsPage({ locale }: PageProps) {
  return (
    <Layout displayFooter={false}>
      <ProblemsIntroSection locale={locale} />
      <Suspense fallback={null}>
        <ProblemsLibrary />
      </Suspense>
    </Layout>
  )
})
