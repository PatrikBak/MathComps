import { Brain, Briefcase, Sparkles, Trophy, Users } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { IconBadge } from './layout/IconBadge'

export default function WhyCompetitionsSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const benefits = [
    {
      title: 'Objavenie potenciálu',
      icon: Sparkles,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      description:
        'Veľa ľudí často nevie, čoho je ich mozog schopný, keď sa snaží. Súťaže poskytujú bezpečné prostredie toto otestovať, a pre mnohých sú tak začiatkom ich budúcej cesty za kariérnym aj osobným rastom.',
    },
    {
      icon: Brain,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      title: 'Rozvoj logického myslenia',
      description:
        'Matematické súťaže rozvíjajú schopnosť analýzy problémov a hľadania kreatívnych riešení. Tieto zručnosti sú potom prenesiteľné do všetkých sfér života, keďže problémy je treba riešiť všade.',
    },
    {
      title: 'Komunita a priateľstvo',
      icon: Users,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      description:
        'Prostrednie súťaží a sústredení je veľmi komunitne orientované a bez toho by mnohé ani neexistovali. Veľa ľudí si v týchto komunitách našlo priateľov a partnetov na celý život.',
    },
    {
      icon: Briefcase,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      title: 'Veľké uplatnenie',
      description:
        'Ľudia z prostredia matematických súťaží sú tí najžiadanejší na rôzne pozície vyžadujúce riešenie ťažkých problémov, napr. v oblasti AI, algoritmického obchodovania atď. Vďaka nadobudnutým schopnostiam a kontaktom z komunity ich potom ľahko získavajú.',
    },
  ]

  return (
    <GuideSection
      title={GUIDE_TITLES.WHY_COMPETITIONS}
      description="Matematické súťaže nie sú len o súťažení a matematike 🙂."
      icon={{ type: 'lucide', icon: Trophy }}
      iconColor="text-amber-400"
      iconBackground="bg-amber-500/10"
      sectionNumberer={sectionNumberer}
    >
      <div className={GUIDE_STYLES.sectionSpacing}>
        {benefits.map((benefit, index) => {
          const Icon = benefit.icon
          return (
            <div key={index} className={cn(GUIDE_STYLES.card, 'flex items-start gap-3 sm:gap-4')}>
              <IconBadge icon={Icon} color={benefit.iconColor} background={benefit.iconBg} />
              <div className="flex-1 min-w-0">
                <h3 className={GUIDE_STYLES.cardTitleSmall}>{benefit.title}</h3>
                <p className={GUIDE_STYLES.textSmall}>{benefit.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </GuideSection>
  )
}
