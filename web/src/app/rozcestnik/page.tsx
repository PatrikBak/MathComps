import type { Metadata } from 'next'

import GuideDetail from '@/components/features/guide/GuideDetail'
import { ROUTES } from '@/constants/routes'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'Rozcestník',
  description:
    'Zoznam informácií o súťažiach a odkazy na rôzne užitočné veci zo sveta súťažnej matematiky.',
  path: ROUTES.GUIDE,
  type: 'article',
  section: 'Rozcestník',
})

export default function GuidePage() {
  return <GuideDetail />
}
