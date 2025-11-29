import { FileText, GitBranch, Search } from 'lucide-react'
import React from 'react'

import ThreeCardSection from '@/components/features/home/layout/ThreeCardSection'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'
import { ROUTES } from '@/constants/routes'

import GradientText from '../../shared/components/GradientText'

/**
 * Displays the main feature highlights section on the home page.
 */
export default function FeatureHighlights() {
  // The content of the individual cards
  const features = [
    {
      iconComponent: Search,
      title: 'Archív',
      description: (
        <>
          Databáza súťažných úloh s&nbsp;možnosťou vyhľadávať podľa kľúčových slov a ďalších
          kritérií.
        </>
      ),
      href: ROUTES.PROBLEMS,
    },
    {
      iconComponent: FileText,
      title: 'Materiály',
      description:
        'Priebežne pripravované texty, ktoré majú za cieľ pokryť kľúčové témy súťažnej matematiky.',
      href: ROUTES.HANDOUTS,
    },
    {
      iconComponent: GitBranch,
      title: 'Rozcestník',
      description:
        'Zoznam informácií o súťažiach a odkazy na rôzne užitočné veci zo sveta súťažnej matematiky.',
      href: ROUTES.GUIDE,
    },
  ]

  // The header of the section
  const header = (
    <h2 className={HOME_ABOUT_STYLES.sectionTitle}>
      Všetko potrebné <GradientText className="block">na jednom mieste</GradientText>
    </h2>
  )

  // The section itself
  return <ThreeCardSection headerContent={header} cards={features} />
}
