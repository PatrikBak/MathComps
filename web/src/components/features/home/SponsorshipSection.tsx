import { Heart, Star } from 'lucide-react'

import ContactButton from '@/components/features/contact/ContactButton'
import Badge from '@/components/features/home/layout/Badge'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { AppLink } from '@/components/shared/components/AppLink'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

const WINCENT_LOGO_URL =
  'https://cdn.prod.website-files.com/625ec5cffd7f464ea56dc954/6267f07d3d8341e69a7ee06a_Wincent_logo_H_White.svg'

export default function SponsorshipSection() {
  return (
    <AnimatedSection className={HOME_ABOUT_STYLES.sectionWrapper} anchorId="sponsorship-section">
      <section id="sponsorship-section">
        <div className={cn(HOME_ABOUT_STYLES.containerNarrow, 'text-center')}>
          <div className={HOME_ABOUT_STYLES.headerContainer}>
            <Badge
              icon={<Star size={14} className="sm:w-4 sm:h-4" />}
              text="Neziskový projekt"
              color="amber"
            />

            <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Podporte rozvoj platformy</h2>

            <p className={cn(HOME_ABOUT_STYLES.sectionDescription, 'mb-6 sm:mb-10 lg:mb-12')}>
              MathComps je nezávislý neziskový projekt s cieľom zostať navždy{' '}
              <strong>úplne bezplatný pre všetkých</strong>. Každý príspevok pomôže naplniť cieľ
              venovať sa projektu naplno. Veľká vďaka patrí podpore, ktorá sa projektu dostala od
              nášho hlavného sponzora.
            </p>
          </div>

          <div className="max-w-xs sm:max-w-md md:max-w-lg mx-auto">
            <GlassCard title="Hlavný sponzor projektu" titleElement="h3">
              <div className="mb-4 sm:mb-6">
                <AppLink
                  href="https://www.wincent.com/"
                  className="inline-flex items-center text-[#B49032] hover:text-[#B49032]/80 transition-colors duration-300"
                >
                  <span
                    style={{
                      maskImage: `url(${WINCENT_LOGO_URL})`,
                      WebkitMaskImage: `url(${WINCENT_LOGO_URL})`,
                      maskRepeat: 'no-repeat',
                      WebkitMaskRepeat: 'no-repeat',
                      maskSize: 'contain',
                      WebkitMaskSize: 'contain',
                      aspectRatio: '594.67 / 116.29',
                    }}
                    className="inline-block bg-current opacity-90 w-[140px] lg:w-[220px]"
                  />
                </AppLink>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mb-4 sm:mb-6" />

              <ContactButton
                reason="sponsorship"
                className="inline-flex items-center gap-2 sm:gap-2 lg:gap-3 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 rounded-lg lg:rounded-xl text-violet-300 font-semibold lg:font-bold text-sm sm:text-base lg:text-lg border-2 border-violet-500/40 hover:bg-violet-500/10 hover:border-violet-500/70 transition-all duration-300 shadow-lg shadow-violet-500/10"
              >
                <Heart size={16} className="sm:w-[18px] sm:h-[18px] lg:w-6 lg:h-6" />
                <span>Staňte sa sponzorom</span>
              </ContactButton>
            </GlassCard>
          </div>
        </div>
      </section>
    </AnimatedSection>
  )
}
