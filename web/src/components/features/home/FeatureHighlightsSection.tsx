import { FileText, GitBranch, Search } from 'lucide-react'

import GradientText from '@/components/shared/components/GradientText'
import Section from '@/components/shared/components/Section'
import { ROUTES } from '@/constants/routes'

/**
 * Displays the main feature highlights section on the home page.
 */
export default function FeatureHighlights() {
  const features = [
    {
      iconComponent: Search,
      title: 'Archív',
      description: (
        <>
          Databáza súťažných úloh s&nbsp;možnosťou vyhľadávania podľa kľúčových slov a ďalších
          kritérií.
        </>
      ),
      href: ROUTES.PROBLEMS,
    },
    {
      iconComponent: FileText,
      title: 'Materiály',
      description:
        'Priebežne dopĺňané študijné texty, ktoré majú za cieľ pokryť kľúčové témy súťažnej matematiky.',
      href: ROUTES.HANDOUTS,
    },
    {
      iconComponent: GitBranch,
      title: 'Rozcestník',
      description:
        'Zoznam súťaží a seminárov spolu s odkazmi na rôzne nástroje užitočné pre žiakov aj učiteľov.',
      href: ROUTES.GUIDE,
    },
  ]

  return (
    <Section
      title={
        <>
          Všetko potrebné <GradientText className="block">na jednom mieste</GradientText>
        </>
      }
      cards={features}
    />
  )
}
