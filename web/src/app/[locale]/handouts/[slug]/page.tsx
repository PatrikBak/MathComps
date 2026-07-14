import { MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { HandoutData } from '@/components/features/handouts/handout-content-types'
import type { HandoutIndex } from '@/components/features/handouts/handout-metadata-types'
import {
  getContentFileBasename,
  supportsLocale,
} from '@/components/features/handouts/handout-metadata-types'
import { computeSectionMetadata } from '@/components/features/handouts/handout-utils'
import HandoutDetail from '@/components/features/handouts/HandoutDetail'
import Layout from '@/components/layout/Layout'
import { JsonLd } from '@/components/shared/components/JsonLd'
import { getCanonicalUrl } from '@/components/shared/utils/url-utils'
import handoutIndex from '@/content/handouts.json'
import { LocalizedRouteProvider } from '@/hooks/useLocalizedRoute'
import { ANCHORS, getLocalizedAnchor, type Locale, ROUTES, SUPPORTED_LOCALES } from '@/i18n/i18n'
import { resolveLocalizedPath } from '@/i18n/localized-paths'
import { type PageProps, withLocale } from '@/i18n/with-locale'
import { generatePageMetadata } from '@/lib/metadata'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'

/** Typed access to the handout index */
const index = handoutIndex as unknown as HandoutIndex

/**
 * Provides static params for pre-rendering available handouts.
 *
 * @returns Array of param objects containing locale and slug combinations
 */
export async function generateStaticParams() {
  // Collect every handout across every section
  const handouts = index.sections.flatMap((section) => section.handouts)

  // Emit one param object per valid locale + slug combination
  return SUPPORTED_LOCALES.flatMap((locale) =>
    handouts
      .filter((handout) => supportsLocale(handout, locale))
      .map((handout) => ({ locale, slug: handout.slug[locale]! }))
  )
}

/**
 * Generates comprehensive metadata based on the current slug's handout data.
 *
 * @param params - Next.js dynamic route parameters containing the slug
 *
 * @returns Metadata object with comprehensive handout metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>
}): Promise<Metadata> {
  // Extract the slug and locale from URL parameters
  const { slug, locale } = await params

  // Search each section for the requested handout
  for (const section of index.sections) {
    for (const handout of section.handouts) {
      // Check for a handout with a matching slug in the current locale
      if (supportsLocale(handout, locale) && handout.slug[locale] === slug) {
        // Load translations for the section label
        const tHandouts = await getTranslations({ locale, namespace: 'handouts.labels' })

        // Return locale-specific metadata for the handout
        return generatePageMetadata({
          title: handout.title[locale],
          description: handout.description[locale],
          path: ROUTES.HANDOUT_DETAIL,
          type: 'article',
          section: `${tHandouts('sectionLabel')} • ${section.category[locale]}`,
          locale,
          slugTranslations: handout.slug,
        })
      }
    }
  }

  // No matching handout found for this slug + locale
  notFound()
}

/**
 * Page component, taking the slug as a parameter.
 */
export default withLocale(async function RenderPage({
  params,
  locale,
}: PageProps<{ slug: string }>) {
  // Extract the slug from the async params object
  const { slug } = await params

  // Find the handout metadata by matching slug and locale
  const handoutMeta = index.sections
    .flatMap((section) => section.handouts)
    .find((handout) => supportsLocale(handout, locale) && handout.slug[locale] === slug)
  if (!handoutMeta) notFound()

  // Load the handout content file for this locale
  const fileBasename = getContentFileBasename(handoutMeta)
  const handoutModule = await import(`@/content/handouts/${fileBasename}.${locale}.json`)
  const handoutData = handoutModule.default as HandoutData

  // Compute section metadata once for both the TOC and the renderer
  const sectionMetadata = computeSectionMetadata(handoutData.document)

  // Load translations for TOC labels
  const tHandouts = await getTranslations({ locale, namespace: 'handouts.labels' })

  // Build TOC items from document sections, then append the comments anchor
  const tableOfContentsItems = [
    ...sectionMetadata.map(({ id, label, title, level }) => ({
      id,
      label,
      title,
      level,
    })),
    {
      id: getLocalizedAnchor(ANCHORS.COMMENTS, locale),
      label: '',
      title: tHandouts('comments'),
      level: 1,
      icon: <MessageSquare size={12} />,
    },
  ]

  // Nav labels for the breadcrumb trail
  const tNav = await getTranslations({ locale, namespace: 'navigation' })

  // Resolve the localized handouts-list path (/materialy, /handouts)
  const handoutsPath = resolveLocalizedPath(ROUTES.HANDOUTS, locale)

  // resolveLocalizedPath widens to undefined for an unresolved slug; a static route can't hit that
  if (handoutsPath === undefined) {
    throw new Error(`[Breadcrumb] Missing handouts path for locale '${locale}'.`)
  }

  // Breadcrumb trail Home > Handouts > this handout
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: getCanonicalUrl(`/${locale}`) },
    { name: tNav('handouts'), url: getCanonicalUrl(`/${locale}${handoutsPath}`) },
    { name: handoutMeta.title[locale] },
  ])

  return (
    <>
      {/* Breadcrumb structured data */}
      <JsonLd data={breadcrumbJsonLd} />
      {/* The provider exposes slug translations for the language switcher */}
      <LocalizedRouteProvider slugTranslations={handoutMeta.slug}>
        <Layout tocItems={tableOfContentsItems}>
          <HandoutDetail
            handout={handoutData}
            authors={handoutMeta.authors}
            sectionMetadata={sectionMetadata}
            slug={slug}
            contentId={handoutMeta.id}
            pdfFilenameStem={`${fileBasename}.${locale}`}
            locale={locale}
          />
        </Layout>
      </LocalizedRouteProvider>
    </>
  )
})
