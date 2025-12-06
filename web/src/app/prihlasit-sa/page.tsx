import type { Metadata } from 'next'
import { Suspense } from 'react'

import AuthForm from '@/components/features/auth/AuthForm'
import Layout from '@/components/layout/Layout'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'Prihlásiť sa',
  description: 'Prihláste sa do svojho účtu.',
  path: '/prihlasit-sa',
  type: 'website',
})

export default function AuthPage() {
  return (
    <Layout centerMidscreen>
      <Suspense>
        <AuthForm />
      </Suspense>
    </Layout>
  )
}
