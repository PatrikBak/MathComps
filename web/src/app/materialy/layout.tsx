import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Materiály',
}

export default function HandoutsLayout({ children }: { children: React.ReactNode }) {
  return children
}
