import type { Metadata } from 'next'
import { Suspense } from 'react'

import ProblemsLibrary from '@/components/features/problems/components/ProblemsLibrary'
import Layout from '@/components/layout/Layout'

// Page metadata: Problems library
export const metadata: Metadata = { title: 'Úlohy' }

export default function Problems() {
  return (
    <Layout displayFooter={false}>
      <Suspense fallback={null}>
        <ProblemsLibrary />
      </Suspense>
    </Layout>
  )
}
