import type { Metadata } from 'next'

import GuideDetail from '@/components/features/guide/GuideDetail'
import Layout from '@/components/layout/Layout'

export const metadata: Metadata = { title: 'Rozcestník' }

export default function GuidePage() {
  return (
    <Layout>
      <GuideDetail />
    </Layout>
  )
}
