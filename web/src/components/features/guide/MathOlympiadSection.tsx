import { ExternalLink, HelpCircle, MedalIcon } from 'lucide-react'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import Tooltip from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { type Country, FlagIcon } from './layout/FlagIcon'
import { GUIDE_SECTION_IDS } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import TipBox from './layout/TipBox'

/**
 * Type definition for international competition cards.
 */
type InternationalCompetition = {
  id: string
  acronym: string
  fullName: string
  link?: string | undefined
  description: string
  details?: React.ReactNode[] | undefined
}

/**
 * Organization link card component for SK/CZ MO websites.
 */
function OrganizationLink({
  href,
  country,
  name,
  domain,
  colorScheme,
}: {
  href: string
  country: Country
  name: string
  domain: string
  colorScheme: 'blue' | 'red'
}) {
  const colors = {
    blue: {
      icon: 'group-hover:text-blue-400',
    },
    red: {
      icon: 'group-hover:text-red-400',
    },
  }[colorScheme]

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/50 hover:from-slate-700/70 hover:to-slate-800/70 border border-slate-600/50 transition-all"
    >
      <div className="flex-shrink-0">
        <FlagIcon countries={[country]} flagHeight={24} flagWidth={32} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base text-white font-semibold mb-0.5">{name}</div>
        <div className="text-xs text-slate-400">{domain}</div>
      </div>
      <ExternalLink
        size={14}
        className={cn('sm:w-4 sm:h-4 text-slate-500 transition-colors flex-shrink-0', colors.icon)}
      />
    </a>
  )
}

/**
 * Component for rendering a clean international competition card with improved readability.
 * Uses vertical stacking for scalability and consistent font sizes.
 */
function CompetitionCard({ competition }: { competition: InternationalCompetition }) {
  return (
    <article
      id={competition.id}
      className={cn(GUIDE_STYLES.card, 'border-l border-l-slate-600/40')}
    >
      <div className="mb-2 sm:mb-3">
        <div className="mb-1.5 sm:mb-2">
          <h4 className={GUIDE_STYLES.cardTitleSmall}>{competition.acronym}</h4>
          <div className={GUIDE_STYLES.textAcronym}>({competition.fullName})</div>
        </div>
        {competition.link && (
          <div className="mb-1">
            <ExternalLinkButton href={competition.link} />
          </div>
        )}
      </div>
      <div className={GUIDE_STYLES.contentSpacing}>
        <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{competition.description}</p>
        {competition.details && competition.details.length > 0 && (
          <BulletList items={competition.details} className={GUIDE_STYLES.listSpacing} />
        )}
      </div>
    </article>
  )
}

export default function MathOlympiadSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const internationalCompetitions: InternationalCompetition[] = [
    {
      id: 'imo',
      acronym: 'IMO',
      fullName: 'International Mathematical Olympiad',
      link: 'https://imo-official.org/',
      description: 'Najprestížnejšia medzinárodná olympiáda',
      details: [
        '6 najlepších riešiteľov z krajiny',
        '100 a viac krajín',
        '2 súťažné dni, každý má 3 príklady na 4 a pol hodiny',
      ],
    },
    {
      id: 'memo',
      acronym: 'MEMO',
      fullName: 'Middle European Mathematical Olympiad',
      link: 'https://memo-official.org/',
      description: 'Súťaž pre najlepších budúcich potenciálnych IMO účastníkov',
      details: [
        '6 najlepších riešiteľov neidúcich na IMO, ktorí tam ale môžu ísť o rok',
        '11 a viac krajín',
        'Individuálna a tímová časť',
      ],
    },
    {
      id: 'egmo',
      acronym: 'EGMO',
      fullName: "European Girls' Mathematical Olympiad",
      link: 'https://egmo.org/',
      description: 'Súťaž s cieľom povzbudiť účasť dievčat v matematických súťažiach',
      details: [
        '6 najlepších riešiteliek z krajiny',
        'Kvalifikácia cez špeciálne výberové sústredenie',
        'Pozvánka naň na základe výsledkov krajského kola kategórie A',
        '55 a viac krajín (aj neeurópske)',
        'Formát súťaže ako na IMO',
      ],
    },
    {
      id: 'caps',
      acronym: 'CAPS',
      fullName: 'Czech Austrian Polish Slovak Match',
      description: 'Prípravná súťaž pre IMO tímy účastných krajín',
      details: [
        'Formát súťaže ako IMO',
        <>
          Posledné roky spravidla na{' '}
          <a
            href="https://ista.ac.at/"
            target="_blank"
            rel="noopener noreferrer"
            className={GUIDE_STYLES.link}
          >
            ISTA
          </a>{' '}
          v Rakúsku
        </>,
      ],
    },
    {
      id: 'cpsj',
      acronym: 'CPSJ',
      fullName: 'Czech-Polish-Slovak Junior Match',
      description: 'Súťaž pre šiestich najlepších prvákov SŠ (a mladších) účastníckych krajín',
      details: [
        'Kvalifikácia cez špeciálne výberové sústredenie',
        'V Česku výber na základe výsledkov kategórie A, na Slovensku kategórie C',
        'Individuálna a tímová časť',
        'Trojčlenné tímy (1 člen z každej krajiny) a losované náhodne',
      ],
    },
  ]

  return (
    <GuideSection
      id={GUIDE_SECTION_IDS.MATH_OLYMPIAD}
      description={
        <>
          Súťaž v riešení zaujímavých matematických úloh pre základné aj stredné školy, ktorá začína
          domácim kolom a vrcholí najprestížnejšou medzinárodnou matematickou olympiádou{' '}
          <AppLink href="#imo" className={GUIDE_STYLES.link}>
            IMO
          </AppLink>
          .
        </>
      }
      icon={{ type: 'lucide', icon: MedalIcon }}
      iconColor="text-amber-400"
      iconBackground="bg-amber-500/10"
      sectionNumberer={sectionNumberer}
    >
      {/* Main content container */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        <div className="relative border border-blue-500/20 rounded-lg p-4 sm:p-5 bg-slate-800/30 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
          <div className="relative">
            <p className={cn(GUIDE_STYLES.textNormal, 'mb-3 sm:mb-4')}>
              Česko a Slovensko má spoločné úlohy, ale samostatné organizácie
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <OrganizationLink
                href="https://skmo.sk/"
                country="SK"
                name="Slovenská MO"
                domain="skmo.sk"
                colorScheme="blue"
              />
              <OrganizationLink
                href="https://matematickaolympiada.cz/"
                country="CZ"
                name="Česká MO"
                domain="matematickaolympiada.cz"
                colorScheme="red"
              />
            </div>
          </div>
        </div>

        <p className={cn(GUIDE_STYLES.textNormal, 'my-4 sm:my-6')}>
          Matematická olympiáda je rozdelená do dvoch hlavných častí:{' '}
          <span className="text-purple-400 font-semibold">základoškolská</span> a{' '}
          <span className="text-orange-400 font-semibold">stredoškolská</span> kategória, každá s
          vlastnými ročníkovými úrovňami a kolami.
        </p>
      </div>

      {/* Main content container */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        {/* ZŠ kategórie */}
        <div className={GUIDE_STYLES.cardLarge}>
          <h4 className={cn(GUIDE_STYLES.schoolCommon, GUIDE_STYLES.elementaryColor)}>
            ZŠ kategórie
          </h4>
          <BulletList
            items={[
              'Z5 – Z9 podľa ročníkov ZŠ (a im zodpodevajúcich ročníkov osemročných gymnázií)',
              'V každej kategórii domáce a okresné kolá',
              'V kategórii Z9 navyše krajské kolo a v Česku aj celoštátne',
            ]}
            className={GUIDE_STYLES.listSpacing}
          />
        </div>

        {/* SŠ kategórie */}
        <div className={GUIDE_STYLES.cardLarge}>
          <h4 className={cn(GUIDE_STYLES.schoolCommon, GUIDE_STYLES.highSchoolColor)}>
            SŠ kategórie
          </h4>
          <BulletList
            items={[
              'C pre 1., B pre 2., A pre 3. a 4. ročník (a im zodpovedajúce ročníky osemročných gymnázií)',
              'V každej kategórii domáce, školské a krajské kolo',
              <>
                V kategórii A navyše celoštátne kolo, z neho možný postup na výberové sústredenie{' '}
                <Tooltip
                  content={
                    <>
                      Obe krajiny majú rôzne pravidlá pre postup, na Slovensku je k tomu treba ešte
                      &bdquo;kvalifikáciu&ldquo;, viď stránka súťaže
                    </>
                  }
                >
                  <HelpCircle className="inline h-3.5 w-3.5 text-slate-400/80 cursor-help" />
                </Tooltip>
              </>,
              <>
                Z výberového sústredenia sa dá postúpiť na <strong>medzinárodné súťaže</strong>
              </>,
              'Zábavné viacdňové udalosti, kde matika býva len časť programu',
              'Striedanie hostiteľských krajín, výlety na nové miesta teda zaručené',
            ]}
            className={cn(GUIDE_STYLES.listSpacing, 'mb-4 sm:mb-5')}
          />

          {/* IMO and MEMO cards stacked */}
          <div className="space-y-4 sm:space-y-5 mb-4 sm:mb-5">
            <CompetitionCard competition={internationalCompetitions[0]} />
            <CompetitionCard competition={internationalCompetitions[1]} />
          </div>

          {/* Other international competitions */}
          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-700/50">
            <p className={cn(GUIDE_STYLES.textNormal, 'mb-3 sm:mb-4 font-medium')}>
              Okrem toho sú tu ďalšie akcie:
            </p>
            <div className="space-y-4 sm:space-y-5">
              {internationalCompetitions.slice(2).map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))}
            </div>
          </div>
        </div>

        {/* Tip box */}
        <TipBox>
          Netreba sa báť skúsiť riešiť vyššie kategórie, úlohy často nevyžadujú zložitejšie znalosti
          a kategórie sa prelínajú. Najlepší z najlepších často riešili aj vyššie kategórie.
        </TipBox>
      </div>
    </GuideSection>
  )
}
