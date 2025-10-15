import { FileText, GitBranch, Search } from 'lucide-react'
import React from 'react'

import ThreeCardSection from '@/components/features/home/layout/ThreeCardSection'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

import GradientText from '../../shared/components/GradientText'

export default function FeatureHighlights() {
  const features = [
    {
      iconComponent: Search,
      title: 'Archív',
      description: (
        <>
          Databáza súťažných úloh s&nbsp;možnosťou vyhľadávať podľa kľúčových slov a ďalších
          kritérii.
        </>
      ),
    },
    {
      iconComponent: FileText,
      title: 'Materiály',
      description:
        'Priebežne pripravované texty, ktoré majú za cieľ pokryť kľúčové témy súťažnej matematiky.',
    },
    {
      iconComponent: GitBranch,
      title: 'Rozcestník',
      description:
        'Zoznam informácií o súťažiach a odkazy na rôzne užitočné veci zo sveta súťažnej matematiky.',
    },
  ]

  const header = (
    <h2 className={HOME_ABOUT_STYLES.sectionTitle}>
      Všetko potrebné <GradientText className="block">na jednom mieste</GradientText>
    </h2>
  )

  return <ThreeCardSection headerContent={header} cards={features} />
}
