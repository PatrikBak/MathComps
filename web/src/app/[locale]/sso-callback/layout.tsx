import type { Metadata } from 'next'

/**
 * Metadata for the SSO callback page.
 * Prevents search engines from indexing this technical route.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

/**
 * Server layout wrapper solely for providing non-indexed metadata to the client SSO callback page.
 */
export default function SSOCallbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
