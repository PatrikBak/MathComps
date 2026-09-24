import { MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { HandoutData } from '@/components/features/handouts/handout-content-types'
import type {
  HandoutIndex,
  HandoutMetadata,
  HandoutSection,
} from '@/components/features/handouts/handout-metadata-types'
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
import { permanentRedirect } from '@/i18n/navigation'
import { type PageProps, withLocale } from '@/i18n/with-locale'
import { generatePageMetadata } from '@/lib/metadata'
import { buildBreadcrumbJsonLd, buildHandoutJsonLd } from '@/lib/structured-data'

/** Typed access to the handout index */
const index = handoutIndex as unknown as HandoutIndex

/** A handout together with the section listing it. */
type HandoutEntry = {
  /** The handout. */
  handout: HandoutMetadata
  /** The section listing the handout. */
  section: HandoutSection
}

/**
 * The handout a detail URL names. A slug worded for another locale, as an old unprefixed Slovak link
 * arrives, redirects to this locale's own wording; a slug no handout in this locale goes by is not found.
 *
 * @param slug - The slug in the URL.
 * @param locale - The locale of the URL.
 *
 * @returns The handout whose slug in this locale is the one asked for, with its section.
 */
function resolveHandout(slug: string, locale: Locale): HandoutEntry {
  // Every handout this locale has, with its section
  const entries = index.sections.flatMap((section) =>
    section.handouts
      .filter((handout) => supportsLocale(handout, locale))
      .map((handout) => ({ handout, section }))
  )

  // The handout going by this slug in this locale
  const ownMatch = entries.find(({ handout }) => handout.slug[locale] === slug)

  // The handout, when the slug is this locale's own
  if (ownMatch) return ownMatch

  // The handout going by this slug in some other locale
  const otherMatch = entries.find(({ handout }) => Object.values(handout.slug).includes(slug))

  // No handout in this locale goes by the slug
  if (!otherMatch) notFound()

  // The handout's path in this locale, under its own slug
  const localizedPath = resolveLocalizedPath(ROUTES.HANDOUT_DETAIL, locale, otherMatch.handout.slug)

  // resolveLocalizedPath widens to undefined for an unresolved slug; this handout supports the locale
  if (localizedPath === undefined) {
    throw new Error(`[Redirect] Missing handout detail path for locale '${locale}'.`)
  }

  // Sent to the handout under this locale's own slug
  return permanentRedirect({ href: localizedPath, locale })
}

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

  // The handout the URL names, with its section
  const { handout, section } = resolveHandout(slug, locale)

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

/**
 * Page component, taking the slug as a parameter.
 */
export default withLocale(async function RenderPage({
  params,
  locale,
}: PageProps<{ slug: string }>) {
  // Extract the slug from the async params object
  const { slug } = await params

  // The handout the URL names
  const { handout: handoutMeta } = resolveHandout(slug, locale)

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

  // The localized detail path for this handout (slug substituted per locale)
  const detailPath = resolveLocalizedPath(ROUTES.HANDOUT_DETAIL, locale, handoutMeta.slug)

  // resolveLocalizedPath widens to undefined for an unresolved slug; this handout supports the locale
  if (detailPath === undefined) {
    throw new Error(`[JSON-LD] Missing handout detail path for locale '${locale}'.`)
  }

  // LearningResource structured data carrying authorship and published/updated dates
  const handoutJsonLd = buildHandoutJsonLd({
    locale,
    url: getCanonicalUrl(`/${locale}${detailPath}`),
    title: handoutMeta.title[locale],
    description: handoutMeta.description[locale],
    authors: handoutMeta.authors,
    datePublished: handoutMeta.publishedAt,
    dateModified: handoutMeta.updatedAt,
  })

  return (
    <>
      {/* Breadcrumb structured data */}
      <JsonLd data={breadcrumbJsonLd} />
      {/* Handout learning-resource structured data */}
      <JsonLd data={handoutJsonLd} />
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
            hideSolutionsAndProofs={handoutMeta.hideSolutionsAndProofs ?? false}
            locale={locale}
          />
        </Layout>
      </LocalizedRouteProvider>
    </>
  )
})
