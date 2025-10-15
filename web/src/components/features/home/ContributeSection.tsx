import { Code, FileText, Globe, Shield } from 'lucide-react'

import Badge from '@/components/features/home/layout/Badge'
import ThreeCardSection from '@/components/features/home/layout/ThreeCardSection'
import { AppLink } from '@/components/shared/components/AppLink'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

export const ContributeSection = () => {
  const contributeCards = [
    {
      iconComponent: Globe,
      title: 'Spätná väzba',
      description: (
        <>
          Našli ste chybu, máte nápad na funkciu alebo akýkoľvek iný postreh?{' '}
          <AppLink
            href="mailto:contact@mathcomps.fun"
            className="text-indigo-400 font-medium hover:underline"
          >
            Napíšte
          </AppLink>
          .
        </>
      ),
    },
    {
      iconComponent: Code,
      title: 'Vývoj a kód',
      description: (
        <>
          Ste programátor? Pozrite na{' '}
          <AppLink
            href="https://github.com/PatrikBak/MathComps"
            className="text-indigo-400 font-medium hover:underline"
          >
            zdrojový kód na GitHube
          </AppLink>{' '}
          a&nbsp;pokojne prispejte.
        </>
      ),
    },
    {
      iconComponent: FileText,
      title: 'Tvorba obsahu',
      description: (
        <>
          Ak máte záujem prispievať materiálmi alebo inými užitočnými článkami, určite{' '}
          <AppLink
            href="mailto:contact@mathcomps.fun"
            className="text-indigo-400 font-medium hover:underline"
          >
            sa ozvite
          </AppLink>
          .
        </>
      ),
    },
  ]

  return (
    <ThreeCardSection
      id="contribute-section"
      headerContent={
        <>
          <Badge
            icon={<Shield size={14} className="sm:w-4 sm:h-4" />}
            text="Otvorený projekt"
            color="green"
          />

          <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Prispejte svojím dielom</h2>
          <p className={HOME_ABOUT_STYLES.sectionDescription}>
            MathComps je otvorená platforma a každá pomoc je nesmierne cenná.
          </p>
        </>
      }
      cards={contributeCards}
    />
  )
}
