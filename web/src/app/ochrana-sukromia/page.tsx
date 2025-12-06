import type { Metadata } from 'next'

import PrivacyPage from '@/components/features/privacy/PrivacyPage'
import Layout from '@/components/layout/Layout'
import { ROUTES } from '@/constants/routes'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'Ochrana súkromia a podmienky používania',
  description:
    'Zásady ochrany súkromia a podmienky používania platformy MathComps. Informácie o spracovaní údajov, cookies a práve na vymazanie dát.',
  path: ROUTES.PRIVACY,
  type: 'website',
  section: 'Ochrana súkromia',
})

export default function PrivacyRoutePage() {
  return (
    <Layout>
      <PrivacyPage />
    </Layout>
  )
}
