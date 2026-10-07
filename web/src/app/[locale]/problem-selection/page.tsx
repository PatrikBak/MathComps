import type { Metadata } from 'next'
import { Suspense } from 'react'

import { SelectionShell } from '@/components/features/problem-selection/components/SelectionShell'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. It is kept out of search entirely, since no problem in it has reached a student yet.
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
    namespace: 'pages.problemSelection',
    path: ROUTES.PROBLEM_SELECTION,
    noindex: true,
  })
}

/**
 * The pool of proposed problems, with any one of them open in full over it.
 */
export default withLocale(function ProblemSelectionPage() {
  return (
    <Layout displayFooter={false} wider>
      {/* The selection, which reads its open problem off the address and so renders per request */}
      <Suspense fallback={null}>
        <SelectionShell />
      </Suspense>
    </Layout>
  )
})
