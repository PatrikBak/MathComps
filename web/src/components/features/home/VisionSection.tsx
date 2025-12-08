import { Brain, Sparkles, Trophy, Users } from 'lucide-react'

import Badge from '@/components/features/home/layout/Badge'
import Section from '@/components/shared/components/Section'

/**
 * Displays the vision/future goals section on the home page.
 */
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

  return (
    <Section
      badge={
        <Badge
          icon={<Sparkles size={14} className="sm:w-4 sm:h-4" />}
          text="Kam smerujeme?"
          color="sky"
        />
      }
      title="Vízia do budúcnosti"
      description="MathComps je na začiatku svojej cesty. V hlave je kopa nápadov, ako tento projekt vylepšiť, aby priniesol čo najviac úžitku svetu matematických súťaží. Mimo zveľaďovania už vytvoreného, ďalšie myšlienky sú:"
      cards={visionItems}
    />
  )
}
