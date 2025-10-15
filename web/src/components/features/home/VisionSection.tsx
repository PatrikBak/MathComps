import { Brain, Sparkles, Trophy, Users } from 'lucide-react'
import React from 'react'

import Badge from '@/components/features/home/layout/Badge'
import ThreeCardSection from '@/components/features/home/layout/ThreeCardSection'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

export default function VisionSection() {
  const visionItems = [
    {
      iconComponent: Users,
      title: 'Komunita',
      description:
        'Priestor na diskutovanie o úlohách, materiáloch a novinkách vo svete súťaznej matematiky.',
    },
    {
      iconComponent: Trophy,
      title: 'Súťaže',
      description:
        'Pravidelné online súťaže s rebríčkom a s poloautomatizovaným bodovaním riešení.',
    },
    {
      iconComponent: Brain,
      title: 'AI nástroje',
      description:
        'Funkcie ako odporúčania úloh na mieru, spätná väzba k napísaným riešeniam, a podobne.',
    },
  ]

  const header = (
    <>
      <Badge
        icon={<Sparkles size={14} className="sm:w-4 sm:h-4" />}
        text="Kam smerujeme?"
        color="sky"
      />
      <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Vízia do budúcnosti</h2>
      <p className={HOME_ABOUT_STYLES.sectionDescription}>
        MathComps je na začiatku svojej cesty. V hlave je kopa nápadov, ako tento projekt vylepšiť,
        aby priniesol čo najviac úžitku svetu matematických súťaží. Mimo zveľaďovania už
        vytvoreného, ďalšie myšlienky sú:
      </p>
    </>
  )

  return <ThreeCardSection headerContent={header} cards={visionItems} />
}
