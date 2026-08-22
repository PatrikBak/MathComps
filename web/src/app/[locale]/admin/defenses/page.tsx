import type { Metadata } from 'next'

import { DefenseReviewQueue } from '@/components/features/admin/defense-review/components/DefenseReviewQueue'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { requireAdmin } from '@/lib/auth/admin-auth'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. It is kept out of search entirely: nobody but its one reader has any business
 * finding it, and the guard below would turn anyone else away regardless.
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
    namespace: 'pages.adminDefenses',
    path: ROUTES.ADMIN_DEFENSES,
    noindex: true,
  })
}

/**
 * Reads every student's defense conversations back, for finding what keeps going wrong with the examiner.
 */
export default withLocale(async function AdminDefensesPage() {
  // Anyone who isn't the reviewer goes home. The claim behind this is also what every endpoint the page calls
  // checks for itself, so the guard here is what saves the trip rather than what does the gating.
  await requireAdmin()

  // Render the queue
  return (
    <Layout displayFooter={false}>
      <DefenseReviewQueue />
    </Layout>
  )
})
