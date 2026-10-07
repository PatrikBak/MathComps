import type { Metadata } from 'next'

import { GradingBoard } from '@/components/features/admin/grading-board/components/GradingBoard'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import type { PageProps } from '@/i18n/with-locale'
import { withLocale } from '@/i18n/with-locale'
import { requireAdmin } from '@/lib/auth/admin-auth'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. It is kept out of search entirely, since only graders have any business finding it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  // Resolve the locale and which group this is from the path
  const { locale, slug } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'pages.adminGrading',
    path: ROUTES.ADMIN_GRADING,
    routeParams: { slug },
    noindex: true,
  })
}

/**
 * Grading one group: every student on every problem of each of its competitions.
 */
export default withLocale(async function AdminGradingPage({ params }: PageProps<{ slug: string }>) {
  // Only admins get in. Every grading endpoint checks the same claim for itself, so the guard
  // here saves the trip rather than doing the gating.
  await requireAdmin()

  // Which group is being graded
  const { slug } = await params

  // Render the board
  return (
    <Layout displayFooter={false}>
      <GradingBoard groupSlug={slug} />
    </Layout>
  )
})
