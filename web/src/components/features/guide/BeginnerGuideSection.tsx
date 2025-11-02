import { Dumbbell, Play, Target } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { IconBadge } from './layout/IconBadge'

export default function BeginnerGuideSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const steps = [
    {
      icon: Play,
      title: 'Začiatky sú skvelé, lebo človek sa rýchlo zlepšuje',
      points: [
        'Vyskúšaj korešpondenčné semináre. Majú úlohy vhodné pre začiatočníkov a poskytujú spätnú väzbu. Zúčastni sa ich sústredení, kde sa naučíš, spoznáš a zabavíš.',
        'Hľadaj matematické krúžky na škole alebo v okolí. Spýtaj sa svojho učiteľa matematiky, či o niečom nevie.',
        'Skús riešenie úloh s niekým ďalším, môžete sa motivovať a baviť navzájom.',
        'Nájdi si tiež študijné materiály na systematické štúdium, odporúčania nájdeš o kúsok vyššie.',
      ],
      bulletStyle: 'checkbox',
    },
    {
      icon: Dumbbell,
      title: 'Princípy dobrého tréningu',
      points: [
        'Matematiku je treba aktívne trénovať, ani svaly sa nezískajú pozeraním na videá o cvičení. Vždy je lepšie najprv skúsiť úlohu riešiť samostatne. Proces premýšľania, skúšania a aj zlyhávania pomáha mysli učiť sa.',
        'Až po troche snahy je treba pozrieť vzorové riešenie úloh, ktoré si nevyriešil. Mozog sa z nich viac naučí, keď sa predtým trápil.',
        'Určite ale pozri aj vzorové riešenia úloh, ktoré si vyriešil, častokrát sa naučíš iné postupy, možno aj efektívnejšie.',
        'Niekomu viac vyhovujú systematické materiály a knihy, niekomu riešenie náhodných úloh. Ideálne je veci kombinovať, experimentovať, a nájsť to, čo ťa baví najviac.',
      ],
      bulletStyle: 'circle',
    },
  ]

  const finalNote = {
    title: 'Na záver',
    text: 'Základom je baviť sa procesom. Svet súťaží a seminárov priťahuje veľa ľudí a všetci nemôžu byť najlepší, čo ale vôbec neznamená, že to všetkým nemôže zmeniť život k lepšiemu 😊',
  }

  return (
    <GuideSection
      title={GUIDE_TITLES.HOW_TO_START}
      description="Na začiatku je vždy veľa možností, ako začať. Potom je veľa možností, ako napredovať. Nasledovné rady majú za cieľ týmto procesom pomôcť."
      icon={{ type: 'lucide', icon: Target }}
      iconColor="text-violet-400"
      iconBackground="bg-violet-500/10"
      sectionNumberer={sectionNumberer}
    >
      {/* Steps - Compact boxes */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const iconColors = [
            { color: 'text-sky-400', bg: 'bg-sky-500/10' },
            { color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ]
          const iconScheme = iconColors[index % iconColors.length]

          return (
            <div key={index} className={GUIDE_STYLES.card}>
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 -ml-1">
                <IconBadge
                  icon={StepIcon}
                  color={iconScheme.color}
                  background={iconScheme.bg}
                  size={16}
                />
                <div className="flex-1">
                  <h4 className={GUIDE_STYLES.cardTitle}>{step.title}</h4>
                </div>
              </div>
              {step.points && (
                <BulletList
                  items={step.points}
                  bulletStyle={step.bulletStyle as 'checkbox' | 'circle'}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Final Note - Simple info box */}
      <div className="mt-6 sm:mt-8">
        <div className={GUIDE_STYLES.noteBox}>
          <h4 className="text-lg sm:text-xl font-semibold text-emerald-300 mb-2 sm:mb-3">
            {finalNote.title}
          </h4>
          <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{finalNote.text}</p>
        </div>
      </div>
    </GuideSection>
  )
}
