import { notFound } from 'next/navigation'

/**
 * Catch-all route for handling 404s within the [locale] segment.
 * This ensures that localized not-found pages are rendered with the correct
 * layout and locale context.
 */
export default function CatchAllPage() {
  notFound()
}
