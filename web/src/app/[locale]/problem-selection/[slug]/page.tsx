import type { Metadata } from 'next'
import { Suspense } from 'react'

import { SelectionShell } from '@/components/features/problem-selection/components/SelectionShell'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import type { PageProps } from '@/i18n/with-locale'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. It is kept out of search entirely, since no problem in it has reached a student yet.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  // Resolve the locale and the organization from the path
  const { locale, slug } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'pages.problemSelection',
    path: ROUTES.ORGANIZATION_SELECTION,
    routeParams: { slug },
    noindex: true,
  })
}

/**
 * One organization's pool of proposed problems, with any one of them open in full over it.
 */
export default withLocale(async function OrganizationSelectionPage({
  params,
}: PageProps<{ slug: string }>) {
  // Whose selection this is
  const { slug } = await params

  return (
    <Layout displayFooter={false} wider>
      {/* The selection, which reads its open problem off the address and so renders per request */}
      <Suspense fallback={null}>
        <SelectionShell organization={slug} />
      </Suspense>
    </Layout>
  )
})
