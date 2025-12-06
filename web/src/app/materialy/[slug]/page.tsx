import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import HandoutDetail from '@/components/features/handouts/HandoutDetail'
import type {
  HandoutData,
  HandoutEntry,
  HandoutSection,
} from '@/components/features/handouts/types/handout-types'
import { computeSectionMetadata } from '@/components/features/handouts/utils/handout-utils'
import Layout from '@/components/layout/Layout'
import { ROUTES } from '@/constants/routes'
import handoutIndex from '@/content/handouts/handouts.json'
import { generatePageMetadata } from '@/lib/metadata'

/**
 * Loads the requested handout document by its slug.
 *
 * This function searches through all handout sections to find the entry matching
 * the provided slug, then dynamically imports its JSON content from the content directory.
 *
 * @param slug - The URL-friendly identifier for the handout
 * @returns An object containing the loaded document, images, and its metadata entry
 */
async function loadDocumentBySlug(
  slug: string
): Promise<{ handout: HandoutData; entry: HandoutEntry }> {
  // Load the handout index and flatten all sections into a single array of entries
  const sections = handoutIndex as unknown as HandoutSection[]
  const flatEntries = sections.flatMap((section) => section.handouts)

  // Find the entry that matches both the slug and has a content file associated
  const entry = flatEntries.find((handout) => handout.slug === slug && handout.data?.filename)

  // Throw early if the handout doesn't exist or has no data
  if (!entry || !entry.data) throw new Error('Requested handout not found')

  // Dynamically import the handout's JSON file from the content directory.
  // This enables Next.js to code-split and only load the specific handout being viewed,
  // rather than bundling all handout content into the initial page load.
  const handoutModule = await import(`@/content/handouts/${entry.data.filename}`)
  const handoutData = handoutModule.default as HandoutData

  // Return the parsed handout data and its metadata entry
  return { handout: handoutData, entry }
}

/**
 * Provides static params for pre-rendering available handouts.
 *
 * Next.js uses this function at build time to determine which dynamic routes should
 * be statically generated. We return a list of all valid handout slugs that have
 * associated content files.
 *
 * @returns Array of param objects containing slugs for all available handouts
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Load the handout index
  return (
    (handoutIndex as unknown as HandoutSection[])
      // Flatten all sections into a single array of entries
      .flatMap((section) => section.handouts)
      // Only include handouts that have an associated content file (not just placeholders)
      .filter((handout) => handout.data?.filename)
      // Transform each handout into the param shape that Next.js expects
      .map((handout) => ({ slug: handout.slug }))
  )
}

/**
 * Generates comprehensive metadata based on the current slug's handout data.
 *
 * This function extracts the handout information from the index to populate rich
 * HTML metadata, including OG tags for proper social media previews.
 *
 * @param params - Next.js dynamic route parameters containing the slug
 * @returns Metadata object with comprehensive handout metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  // Find the handout data in the index
  const handoutData = (handoutIndex as unknown as HandoutSection[])
    // Flatten all sections into a single array of entries
    .flatMap((section) =>
      // Map each handout to include its category for metadata generation
      section.handouts.map((handout) => ({ handout, category: section.category }))
    )
    // Find the entry that matches the slug and has a content file associated
    .find((data) => data.handout.slug === slug && data.handout.data?.filename)

  // Throw if no matching entry exists
  if (!handoutData || !handoutData.handout.data) {
    throw new Error(`No handout found with slug: ${slug}`)
  }

  return generatePageMetadata({
    title: handoutData.handout.title,
    description: handoutData.handout.data.description,
    path: `${ROUTES.HANDOUTS}/${slug}`,
    type: 'article',
    section: `Materiály • ${handoutData.category}`,
  })
}

/**
 * Renders a handout page resolved by the dynamic route slug.
 *
 * This is the main page component for individual handout routes. It loads the requested
 * handout document and passes it to the HandoutDetail component for rendering, or triggers
 * a 404 if the handout doesn't exist.
 *
 * @param params - Next.js dynamic route parameters containing the slug
 * @returns The rendered handout detail page
 */
export default async function RenderPage({ params }: { params: Promise<{ slug: string }> }) {
  // Extract the slug from the async params object that Next.js provides
  const { slug } = await params

  try {
    // Attempt to load the handout document, images, and its metadata
    const { handout, entry } = await loadDocumentBySlug(slug)

    // Ensure data exists (should always be true after loadDocumentBySlug)
    if (!entry.data) throw new Error('Invalid handout data')

    // Compute section metadata once for both TOC and rendering
    const sectionMetadata = computeSectionMetadata(handout.document)

    // Extract TOC items (subset of metadata)
    const tableOfContentsItems = sectionMetadata.map(({ id, label, title, level }) => ({
      id,
      label,
      title,
      level,
    }))

    // Render the handout detail component with already loaded document, images, and computed metadata
    return (
      <Layout tocItems={tableOfContentsItems}>
        <HandoutDetail
          handout={handout}
          authors={entry.data.authors}
          sectionMetadata={sectionMetadata}
        />
      </Layout>
    )
  } catch {
    // If the handout doesn't exist or fails to load, show Next.js's 404 page
    notFound()
  }
}
