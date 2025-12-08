import { FileText, GitBranch, Search } from 'lucide-react'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'
import TypingEffect from '@/components/animations/TypingEffect'
import ActionButton from '@/components/shared/components/ActionButton'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { ROUTES } from '@/constants/routes'

import GradientText from '../../shared/components/GradientText'

export default function HeroSection() {
  // The classes for the fancy buttons with arhive, handouts, guide
  const buttonClassName =
    'gap-2 md:gap-3 w-full max-w-[240px] md:max-w-[300px] text-sm md:text-xl md:px-6 md:py-3'
  const iconClassName = 'w-4 h-4 md:w-5 md:h-5'

  // The description used in the typing effect
  const heroDescription =
    'Prehľadný archív úloh, študijných materiálov a rozcestník užitočných zdrojov'

  return (
    <AnimatedSection className={`text-center sm:mt-2 md:mt-4 lg:mb-8 `}>
      {/* Background Animations */}
      <ParticleSystem />
      <FloatingMath />

      {/* Content */}
      <div className="px-4 max-w-4xl mx-auto relative z-10">
        <h1 className="text-white font-black tracking-tight text-balance leading-[1] mb-4 sm:mb-6 lg:mb-8 text-[clamp(2rem,8vw,5.5rem)]">
          <GradientText>Moderný domov</GradientText> pre Matematickú{' '}
          <GradientText>olympiádu</GradientText>
        </h1>
        {/* Grid overlay trick: invisible text reserves height, typing effect renders on top */}
        <div className="mt-4 sm:mt-6 lg:mt-8 text-base sm:text-xl lg:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed text-balance hyphens-none grid [&>*]:col-start-1 [&>*]:row-start-1">
          <span className="invisible" aria-hidden="true">
            {heroDescription}
          </span>
          <TypingEffect text={heroDescription} speed={25} />
        </div>

        <div className="mt-6 sm:mt-10 lg:mt-12 flex flex-col lg:flex-row gap-6 justify-center items-center text-nowrap pb-2 lg:pb-0">
          <ActionButton
            href={ROUTES.PROBLEMS}
            size="medium"
            className={buttonClassName}
            variant="gradientIndigoPurple"
          >
            <Search className={iconClassName} />
            Preskúmať archív
          </ActionButton>

          <ActionButton
            href={ROUTES.HANDOUTS}
            size="medium"
            className={buttonClassName}
            variant="gradientVioletPink"
          >
            <FileText className={iconClassName} />
            Preskúmať materiály
          </ActionButton>

          <ActionButton
            href={ROUTES.GUIDE}
            size="medium"
            className={buttonClassName}
            variant="gradientPinkRose"
          >
            <GitBranch className={iconClassName} />
            Preskúmať rozcestník
          </ActionButton>
        </div>
      </div>
    </AnimatedSection>
  )
}
