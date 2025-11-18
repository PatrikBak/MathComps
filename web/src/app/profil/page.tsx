import type { Metadata } from 'next'

import ProfilePageContent from '@/components/features/profile/ProfilePageContent'
import Layout from '@/components/layout/Layout'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'Profil',
  description: 'Váš používateľský profil.',
  path: '/profil',
  type: 'website',
})

export default async function ProfilePage() {
  return (
    <Layout centerMidscreen>
      <ProfilePageContent />
    </Layout>
  )
}
