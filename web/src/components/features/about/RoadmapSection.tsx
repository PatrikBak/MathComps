import ContactButton from '@/components/features/contact/ContactButton'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

/**
 * A specific feature, either implemented or not
 */
type FeatureItem = {
  /* The name/description of the feature */
  title: string
  /* Whether the feature is implemented or not */
  isImplemented?: boolean
}

/**
 * A category of features
 */
type FeatureCategory = {
  /* The name of the category */
  title: string
  /* The icon of the category */
  icon: string
  /* The color of the category */
  color: string
  /* The features of the category */
  features: FeatureItem[]
}

/**
 * A badge representing a feature
 */
const FeatureBadge = ({ title, isImplemented }: FeatureItem) => (
  <span
    className={cn(
      'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border my-0.5',
      isImplemented
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
        : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
    )}
  >
    {isImplemented && '✓ '}
    {title}
  </span>
)

/**
 * A container with features of a single category
 */
const FeatureCategory = (category: FeatureCategory) => {
  return (
    <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-900/40 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
            category.color
          )}
        >
          {category.icon}
        </div>
        <h3 className="text-xl font-bold text-white">{category.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {category.features.map((feature, index) => (
          <FeatureBadge key={index} title={feature.title} isImplemented={feature.isImplemented} />
        ))}
      </div>
    </div>
  )
}

/**
 * The entire section with all categories and their features
 */
export const RoadmapSection = () => {
  const featureCategories: FeatureCategory[] = [
    {
      title: 'Obsah',
      icon: '📚',
      color: 'bg-blue-500/20 text-blue-400',
      features: [
        { title: 'Archív SK/CZ úloh', isImplemented: true },
        { title: 'Úvodné študijné texty', isImplemented: true },
        { title: 'Úlohy zo zahraničných súťaží' },
        { title: 'Doplnenie študijných textov' },
        { title: 'Preklady úloh (CZ/EN)' },
        { title: 'Plná lokalizácia (CZ/EN)' },
      ],
    },
    {
      title: 'Komunita',
      icon: '👥',
      color: 'bg-green-500/20 text-green-400',
      features: [
        { title: 'Sekcia s novinkami', isImplemented: true },
        { title: 'Používateľské profily', isImplemented: true },
        { title: 'Lajkovanie úloh', isImplemented: true },
        { title: 'Diskusie k obsahu' },
        { title: 'Možnosť reportovať chyby' },
        { title: 'Vlastné zoznamy úloh' },
        { title: 'Platforma pre prispievateľov' },
      ],
    },
    {
      title: 'Nástroje',
      icon: '🛠️',
      color: 'bg-purple-500/20 text-purple-400',
      features: [
        { title: 'Filtrovanie obľúbených úloh', isImplemented: true },
        { title: 'Export do PDF a TeX' },
        { title: 'Odporúčania podobných úloh' },
        { title: 'AI hinty k úlohám' },
        { title: 'Sledovanie progresu v riešení' },
        { title: 'Personalizované odporúčania úloh' },
      ],
    },
    {
      title: 'Súťaže',
      icon: '🏆',
      color: 'bg-yellow-500/20 text-yellow-400',
      features: [
        { title: 'Platforma na tréningové súťaže' },
        { title: 'Možnosť súkromných súťaží' },
        { title: 'Oficiálne tréningové súťaže' },
        { title: 'Rebríčky a medaily' },
        { title: 'AI predhodnotenie' },
      ],
    },
  ]

  return (
    <AnimatedSection className={HOME_ABOUT_STYLES.sectionWrapper} anchorId="roadmap-section">
      <div className={cn(HOME_ABOUT_STYLES.headerContainer, 'px-4')}>
        <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Funkcionality</h2>
        <p className={cn(HOME_ABOUT_STYLES.sectionDescription, 'text-balance')}>
          Toto je len začiatok projektu a v pláne je veľa nových funkcií.{' '}
          <span className="block w-fit mx-auto mt-6 items-center px-2 py-0.5 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✓ Zelené funkcie sú už dostupné!
          </span>
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4">
        <div className="space-y-6">
          {featureCategories.map((category) => (
            <div key={category.title}>
              <FeatureCategory {...category} />
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            Tento zoznam sa bude v čase meniť, pokojte{' '}
            <ContactButton
              reason="feature-ideas"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              prispejte svojimi nápadmi
            </ContactButton>
            .
          </p>
        </div>
      </div>
    </AnimatedSection>
  )
}
