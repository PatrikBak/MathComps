import { FileText, GitBranch, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'
import TypingEffect from '@/components/animations/TypingEffect'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { ROUTES } from '@/i18n/i18n'

import GradientText from '../../shared/components/GradientText'
import { HeroButton } from './HeroButton'

/**
 * Top landing page section.
 */
export default function HeroSection() {
  // The translations for the hero section
  const t = useTranslations('home.hero')

  // The description used in the typing effect
  const heroDescription = t('description')

  return (
    <AnimatedSection eager className={`text-center sm:mt-2 md:mt-4 lg:mb-8 `}>
      {/* Background Animations */}
      <ParticleSystem />
      <FloatingMath />

      {/* Content */}
      <div className="px-4 max-w-4xl mx-auto relative z-10">
        <h1 className="text-foreground font-black tracking-tight text-balance leading-[1] mb-4 sm:mb-6 lg:mb-8 text-[clamp(2rem,8vw,5.5rem)] hyphens-none">
          <GradientText>{t('title.modernHome')}</GradientText> {t('title.forMath')}{' '}
          <GradientText>{t('title.olympiad')}</GradientText>
        </h1>
        {/* Grid overlay trick: invisible text reserves height, typing effect renders on top */}
        <div className="mt-4 sm:mt-6 lg:mt-8 text-base sm:text-xl lg:text-2xl text-muted max-w-2xl mx-auto leading-relaxed text-balance hyphens-none grid [&>*]:col-start-1 [&>*]:row-start-1">
          <span className="invisible" aria-hidden="true">
            {heroDescription}
          </span>
          <TypingEffect text={heroDescription} speed={25} />
        </div>

        <div className="mt-6 sm:mt-10 lg:mt-12 flex flex-col lg:flex-row gap-6 justify-center items-center text-nowrap pb-2 lg:pb-0">
          <HeroButton href={ROUTES.PROBLEMS} variant="indigoPurple" icon={Search}>
            {t('buttons.exploreArchive')}
          </HeroButton>

          <HeroButton href={ROUTES.HANDOUTS} variant="violetPink" icon={FileText}>
            {t('buttons.exploreHandouts')}
          </HeroButton>

          <HeroButton href={ROUTES.GUIDE} variant="pinkRose" icon={GitBranch}>
            {t('buttons.exploreGuide')}
          </HeroButton>
        </div>
      </div>
    </AnimatedSection>
  )
}
