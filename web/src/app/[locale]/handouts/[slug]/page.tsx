import fs from 'node:fs'
import path from 'node:path'

import { MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { HandoutData } from '@/components/features/handouts/handout-content-types'
import type {
  HandoutSection,
  ReadyHandoutMetadata,
} from '@/components/features/handouts/handout-metadata-types'
import { isReadyHandout } from '@/components/features/handouts/handout-metadata-types'
import { computeSectionMetadata } from '@/components/features/handouts/handout-utils'
import HandoutDetail from '@/components/features/handouts/HandoutDetail'
import Layout from '@/components/layout/Layout'
import handoutIndex from '@/content/handouts.json'
import { LocalizedRouteProvider } from '@/hooks/useLocalizedRoute'
import { ANCHORS, getLocalizedAnchor, type Locale, ROUTES, SUPPORTED_LOCALES } from '@/i18n/i18n'
import { type PageProps, withLocale } from '@/i18n/with-locale'
import { generatePageMetadata } from '@/lib/metadata'

/**
 * Finds a ready handout by its localized slug.
 *
 * @param slug - The localized slug to search for
 * @param locale - The locale to match the slug against
 *
 * @returns The matching ready handout entry, or undefined if not found
 */
function findHandoutBySlug(slug: string, locale: Locale): ReadyHandoutMetadata | undefined {
  // Parse the handout index
  return (
    (handoutIndex as unknown as HandoutSection[])
      // Get all handouts
      .flatMap((section) => section.handouts)
      // That are ready
      .filter(isReadyHandout)
      // And find the one with the matching slug in the current locale
      .find((handout) => handout.slug[locale] === slug)
  )
}

/**
 * Loads the requested handout document by its localized slug.
 *
 * @param slug - The URL-friendly identifier for the handout (locale-specific)
 * @param locale - The current locale
 *
 * @returns An object containing the loaded document and its metadata entry
 */
async function loadDocumentBySlug(
  slug: string,
  locale: Locale
): Promise<{ data: HandoutData; metadata: ReadyHandoutMetadata } | undefined> {
  // Find the handout entry
  const handoutData = findHandoutBySlug(slug, locale)

  // Return undefined if the handout doesn't exist
  if (!handoutData) return undefined

  try {
    // Dynamically import the handout's JSON file for the current locale
    // Content files use the English slug as the base filename (e.g., "factorization.sk.json")
    const handoutModule = await import(`@/content/handouts/${handoutData.slug.en}.${locale}.json`)

    // Return the handout and its metadata entry
    return { data: handoutModule.default as HandoutData, metadata: handoutData }
  } catch {
    // Content file does not exist for this locale yet — treat as not found
    return undefined
  }
}

/**
 * Provides static params for pre-rendering available handouts.
 *
 * @returns Array of param objects containing locale and slug combinations
 */
export async function generateStaticParams(): Promise<Array<{ locale: Locale; slug: string }>> {
  // Parse the handout index
  const sections = handoutIndex as unknown as HandoutSection[]

  // Get all ready handouts
  const readyHandouts = sections.flatMap((section) => section.handouts).filter(isReadyHandout)

  // Resolve the content directory for checking file existence
  const contentDir = path.join(process.cwd(), 'src', 'content', 'handouts')

  // Generate params only for locale + slug combinations that have a content file
  return SUPPORTED_LOCALES.flatMap((locale) =>
    readyHandouts
      .filter((handout) => fs.existsSync(path.join(contentDir, `${handout.slug.en}.${locale}.json`)))
      .map((handout) => ({ locale, slug: handout.slug[locale] }))
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

  // Find the handout and its category
  const sections = handoutIndex as unknown as HandoutSection[]

  // Search each section for the requested handout
  for (const section of sections) {
    // Search each handout in the section
    for (const handout of section.handouts) {
      // Look for ready handouts with the matching slug in the current locale
      if (isReadyHandout(handout) && handout.slug[locale] === slug) {
        // Get translations for handouts
        const tHandouts = await getTranslations({ locale, namespace: 'handouts.labels' })

        // Return locale-specific metadata for the handout
        return generatePageMetadata({
          title: handout.title[locale],
          description: handout.description[locale],
          path: `${ROUTES.HANDOUTS}/${slug}`,
          type: 'article',
          section: `${tHandouts('sectionLabel')} • ${section.category[locale]}`,
          locale,
          slugTranslations: handout.slug,
        })
      }
    }
  }

  // If we got here, the handout doesn't exist
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

  // Attempt to load the handout document and its metadata
  const handoutData = await loadDocumentBySlug(slug, locale)

  // If the handout doesn't exist, show Next.js's 404 page
  if (!handoutData) notFound()

  // Compute section metadata once for both TOC and rendering
  const sectionMetadata = computeSectionMetadata(handoutData.data.document)

  // Get translations for TOC
  const tHandouts = await getTranslations({ locale, namespace: 'handouts.labels' })

  // Extract TOC items (subset of metadata) and add comments link
  const tableOfContentsItems = [
    ...sectionMetadata.map(({ id, label, title, level }) => ({
      id,
      label,
      title,
      level,
    })),
    // Add comments section link at the bottom
    {
      id: getLocalizedAnchor(ANCHORS.COMMENTS, locale),
      label: '',
      title: tHandouts('comments'),
      level: 1,
      icon: <MessageSquare size={12} />,
    },
  ]

  // Render the handout detail component
  return (
    // The provider ensures we have access to the slug in all languages
    // (which is useful for language switching)
    <LocalizedRouteProvider slugTranslations={handoutData.metadata.slug}>
      <Layout tocItems={tableOfContentsItems}>
        <HandoutDetail
          handout={handoutData.data}
          authors={handoutData.metadata.authors}
          sectionMetadata={sectionMetadata}
          slug={slug}
          contentId={handoutData.metadata.id}
          pdfFilenameStem={`${handoutData.metadata.slug.en}.${locale}`}
          locale={locale}
        />
      </Layout>
    </LocalizedRouteProvider>
  )
})
