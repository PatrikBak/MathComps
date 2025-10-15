import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import HandoutDetail from '@/components/features/handouts/HandoutDetail'
import type {
  Document,
  HandoutEntry,
  HandoutSection,
} from '@/components/features/handouts/types/handout-types'
import handoutIndex from '@/content/handouts/handouts.json'

/**
 * Loads the requested handout document by its slug.
 *
 * This function searches through all handout sections to find the entry matching
 * the provided slug, then dynamically imports its JSON content from the content directory.
 *
 * @param slug - The URL-friendly identifier for the handout
 * @returns An object containing the loaded document and its metadata entry
 */
async function loadDocumentBySlug(
  slug: string
): Promise<{ document: Document; entry: HandoutEntry }> {
  // Load the handout index and flatten all sections into a single array of entries
  const sections = handoutIndex as unknown as HandoutSection[]
  const flatEntries = sections.flatMap((section) => section.handouts)

  // Find the entry that matches both the slug and has a content file associated
  const entry = flatEntries.find((handout) => handout.slug === slug && handout.filename)

  // Throw early if the handout doesn't exist - this will be caught by the page component
  // and converted into a proper 404 response
  if (!entry) throw new Error('Requested handout not found')

  // Dynamically import the handout's JSON file from the content directory.
  // This enables Next.js to code-split and only load the specific handout being viewed,
  // rather than bundling all handout content into the initial page load.
  const documentModule = await import(`@/content/handouts/${entry.filename}`)

  // Return the parsed document and its metadata
  return { document: documentModule.default as Document, entry }
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
      .filter((handout) => handout.filename)
      // Transform each handout into the param shape that Next.js expects
      .map((handout) => ({ slug: handout.slug }))
  )
}

/**
 * Generates metadata based on the current slug's document title.
 *
 * This function extracts the handout title from the index to populate the page's
 * HTML metadata, enabling proper browser tab titles and social media previews.
 *
 * @param params - Next.js dynamic route parameters containing the slug
 * @returns Metadata object with the handout title
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  // Extract the slug from the async params object that Next.js provides
  const { slug } = await params

  // Load the handout index
  const entry = (handoutIndex as unknown as HandoutSection[])
    // flatten all sections into a single array of entries
    .flatMap((section) => section.handouts)
    // Find the right handout that has a real file (i.e. filename not null)
    .find((handout) => handout.slug === slug && handout.filename)

  // Throw if no matching entry exists
  if (!entry) throw new Error(`No handout found with slug: ${slug}`)

  // Return the title if the handout exists
  return { title: entry.title }
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
    // Attempt to load the handout document and its metadata
    const { document, entry } = await loadDocumentBySlug(slug)

    // Render the handout detail component with the loaded document and author information
    return <HandoutDetail document={document} authors={entry.authors} />
  } catch {
    // If the handout doesn't exist or fails to load, show Next.js's 404 page
    notFound()
  }
}
