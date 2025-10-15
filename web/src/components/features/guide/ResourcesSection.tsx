import { BookOpen, Link2, type LucideIcon, MessageSquare, Wrench, Youtube } from 'lucide-react'
import React from 'react'

import { getSiteUrl } from '@/components/features/problems/utils/url-utils'
import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'
import { ROUTES } from '@/constants/routes'

import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { GUIDE_SECTION_IDS } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { InfoCard } from './layout/InfoCard'
import TipBox from './layout/TipBox'

type Resource = {
  title: string
  fullName?: string
  description: string | React.ReactNode
  link?: string
}

type ResourceCategoryType = {
  id: string
  icon: LucideIcon
  description?: string | React.ReactNode
  resources: Resource[]
  renderFooter?: () => React.ReactNode
}

/**
 * Render a single resource card with name, optional acronym, description, and link.
 * Follows the same pattern as competition cards in OtherCompetitionsSection.
 */
function renderResourceCard(resource: Resource, resourceIndex: number) {
  return (
    <InfoCard key={resourceIndex}>
      {/* Header with name and optional acronym */}
      <div className="mb-2 sm:mb-3">
        <h4 className={cn(GUIDE_STYLES.cardTitle, 'mb-0')}>{resource.title}</h4>
        {resource.fullName && (
          <p className={cn(GUIDE_STYLES.textAcronym, 'mt-0.5')}>({resource.fullName})</p>
        )}
      </div>

      {/* Link */}
      {resource.link && (
        <div className="mb-3">
          <ExternalLinkButton href={resource.link} />
        </div>
      )}

      {/* Description */}
      <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{resource.description}</p>
    </InfoCard>
  )
}

function ResourceCategory({
  category,
  categoryIndex,
  sectionNumberer,
}: {
  category: ResourceCategoryType
  categoryIndex: number
  sectionNumberer: SectionNumberer
}) {
  const CategoryIcon = category.icon
  const iconColors = [
    { color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]
  const iconScheme = iconColors[categoryIndex % iconColors.length]

  return (
    <GuideSection
      id={category.id}
      description={category.description}
      icon={{ type: 'lucide', icon: CategoryIcon }}
      iconColor={iconScheme.color}
      iconBackground={iconScheme.bg}
      sectionNumberer={sectionNumberer}
    >
      <div className="space-y-3 sm:space-y-4">
        {category.resources.map(renderResourceCard)}
        {category.id === GUIDE_SECTION_IDS.PROGRAMS && (
          <TipBox>
            Všetci vidíme, že AI sa v matike zlepšuje. Vie to byť rýchla pomôcka pri učení sa nových
            vecí. Len je treba mať sa na pozore, keďže ono to nemá vždy pravdu a vie si to
            povymýšľať kde-čo 🙃
          </TipBox>
        )}
        {category.renderFooter && category.renderFooter()}
      </div>
    </GuideSection>
  )
}

export default function ResourcesSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const resourceCategories: ResourceCategoryType[] = [
    {
      id: GUIDE_SECTION_IDS.WEBSITES,
      icon: MessageSquare,
      resources: [
        {
          title: 'AoPS',
          fullName: 'Art of Problem Solving',
          description:
            'Asi najväčšia a najdôležitejšia stránka o olympiádnej matematike na svete. Fóra, obrovské zbierky úloh, články, všetko na jednom mieste. Nutnosť poznať.',
          link: 'https://artofproblemsolving.com/',
        },
        {
          title: 'MODS',
          fullName: 'Math Olympiad Discord Server',
          description:
            'Veľký medzinárodný Discord server, kde možno diskutovať s ľuďmi z celého sveta. Už viac ako 2000 dní pripravuje rubriku úloha dňa, pričom je možné pristúpiť k starším úlohám podľa oblastí a hodnotení obtiažnosti.',
          link: 'https://discord.gg/mods',
        },
        {
          title: 'Evan Chen stránka',
          description:
            'Osobná stránka svetoznámeho olympiádneho experta. Cez jeho stránku sa možno preklikať na veľa nielen jeho materiálov alebo ďalších zdrojov a informácií.',
          link: 'http://web.evanchen.cc/',
        },
      ],
    },
    {
      id: GUIDE_SECTION_IDS.PROGRAMS,
      icon: Wrench,
      resources: [
        {
          title: 'GeoGebra',
          description: (
            <>
              Fantastická pomôcka pri učení sa geometrie, prípadne nástroj na kreslenie grafov.
              Dobre narysovoaný obrázok môže robiť rozdiel v tom, či riešenie vidíme alebo nie, no a{' '}
              <span className="text-no-break">GeoGebra</span> ich vie rysovať presne 📐.
            </>
          ),
          link: 'https://www.geogebra.org/',
        },
        {
          title: 'WolframAlpha',
          description:
            'Rýchly a spoľahlivý nástroj na riešenie rovníc, rozkladanie čísel na súčin, počítanie súm, alebo aj derivovanie, integerovanie atď.',
          link: 'https://www.wolframalpha.com/',
        },
        {
          title: 'Overleaf',
          description:
            'Online prostriedie na písanie v LaTeX-u, čo je štandard pre matematiku. Obsahuje návody pre začiatočníkov na LaTeX samotný.',
          link: 'https://www.overleaf.com/',
        },
      ],
    },
    {
      id: GUIDE_SECTION_IDS.YOUTUBE,
      icon: Youtube,
      resources: [
        {
          title: 'MindYourDecisions',
          description:
            'Videá s riešením úloh všetkých obtiažností, od priam popularizačných až po zaujímavé olympiádne.',
          link: 'https://www.youtube.com/@MindYourDecisions',
        },
        {
          title: 'Michael Penn',
          description: 'Vysvetlenia riešení súťažných úloh zo súťaží z celého sveta pred tabuľou.',
          link: 'https://www.youtube.com/c/MichaelPennMath',
        },
        {
          title: '3Blue1Brown',
          description: 'Unikátne vizuálne spracovanie všemožných tém z matematiky.',
          link: 'https://www.youtube.com/c/3blue1brown',
        },
      ],
    },
    {
      id: GUIDE_SECTION_IDS.STUDY_TEXTS,
      icon: BookOpen,
      description: (
        <>
          V tejto sekcii si zhrnieme niektoré študijné materiály. Priorita je poskytnúť
          začiatočníkom prehľad, kam sa môžu obrátiť.
        </>
      ),
      resources: [
        {
          title: 'Naše materiály',
          description:
            'Verejne dostupných materiálov pre začiatočníkov s dobrými vysvetleniami myšlienok nie je veľa. Naše materiály na tejto stránke majú ambíciu túto medzeru zaplniť. Priebežne sa ich zbierka bude rozrastať.',
          link: `${getSiteUrl()}${ROUTES.HANDOUTS}`,
        },
        {
          title: 'KMS zbierka',
          description:
            'Starší, ale nadčasový materiál. Príjemné zdôvodnenia a krátke úvody do všetkých tém s veľa príkladmi zo seminára KMS.',
          link: 'https://kms.sk/zbierka/',
        },
        {
          title: 'Vzorové riešenia',
          description: (
            <>
              Najľahšie úlohy{' '}
              <AppLink href="#seminars" className={GUIDE_STYLES.link}>
                seminárov
              </AppLink>
              , prípadne nižších kategórii MO, sú dobrým zdrojom. V seminároch sú riešenia písané
              viac v štýle, ako na úlohy prísť, zatiaľ čo v olympiáde viac v štýle, ako ich napísať,
              keď už na to niekto prišiel.
            </>
          ),
        },
        {
          title: 'Návodné úlohy k domácim kolám MO',
          description:
            'Oplatí sa riešiť si aj staršie domáceho kolá MO, lebo v rámci nich sa vydávajú návodné a doplňujúce úlohy (aj s riešenia/odkazmi na ne), čo je dobrý spôsob ako nasať nejakú tému.',
        },
        {
          title: 'PraSe knižnica',
          description:
            'Veľká zbierka materiálov zo seminára PraSe. Na samostatné štúdium sú veľmi zaujímavé takzvané seriály, čo sú tematické texty. ',
          link: 'https://prase.cz/knihovna/',
        },
      ],
      renderFooter: () => (
        <TipBox variant="info">
          Je možné, že sa pýtate, prečo tu nie je to a to. Je to najmä preto, že tento rozcestník je
          písaný najmä pre začiatočníkov, a zahltenie množstvom materiálov hneď v úvode nemusí byť
          produktívne. Priebežne budú pribúdať odkazy na ďalšie štúdium dovnútra materiálov na
          stránke, prípadne neskôr môže vzkninúť stránka s návodom pre pokročilých, kde bude väčšia
          databáza. Ono aj tak, v PraSe knižnici je toho fakt veľa 😜.
        </TipBox>
      ),
    },
  ]

  return (
    <GuideSection
      id={GUIDE_SECTION_IDS.RESOURCES}
      description="Stručný zoznam tých najdôležitejších študijných/komunitných zdrojov zo sveta súťažnej matematiky, ktoré sa určite oplatí poznať."
      icon={{ type: 'lucide', icon: Link2 }}
      iconColor="text-blue-400"
      iconBackground="bg-blue-500/10"
      sectionNumberer={sectionNumberer}
    >
      <div className={GUIDE_STYLES.sectionSpacing}>
        {resourceCategories.map((category, categoryIndex) => (
          <ResourceCategory
            key={categoryIndex}
            category={category}
            categoryIndex={categoryIndex}
            sectionNumberer={sectionNumberer}
          />
        ))}
      </div>
    </GuideSection>
  )
}
