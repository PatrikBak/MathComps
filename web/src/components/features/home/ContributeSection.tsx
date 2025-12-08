import { Code, FileText, Globe, Shield } from 'lucide-react'

import ContactButton from '@/components/features/contact/ContactButton'
import Badge from '@/components/features/home/layout/Badge'
import { AppLink } from '@/components/shared/components/AppLink'
import Section from '@/components/shared/components/Section'

/**
 * Displays the contribute/open-source section on the home page.
 */
export const ContributeSection = () => {
  const contributeCards = [
    {
      iconComponent: Globe,
      title: 'Spätná väzba',
      description: (
        <>
          Našli ste chybu, máte nápad na funkciu alebo akýkoľvek iný postreh?{' '}
          <ContactButton reason="feedback" className="text-indigo-400 font-medium hover:underline">
            Napíšte
          </ContactButton>
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
          <ContactButton
            reason="content-contribution"
            className="text-indigo-400 font-medium hover:underline"
          >
            sa ozvite
          </ContactButton>
          .
        </>
      ),
    },
  ]

  return (
    <Section
      id="contribute-section"
      badge={
        <Badge
          icon={<Shield size={14} className="sm:w-4 sm:h-4" />}
          text="Otvorený projekt"
          color="green"
        />
      }
      title="Prispejte svojím dielom"
      description="MathComps je otvorená platforma a každá pomoc je nesmierne cenná."
      cards={contributeCards}
    />
  )
}
