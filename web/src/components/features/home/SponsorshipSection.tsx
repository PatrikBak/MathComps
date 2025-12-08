import { Heart, Star } from 'lucide-react'

import ContactButton from '@/components/features/contact/ContactButton'
import Badge from '@/components/features/home/layout/Badge'
import { AppLink } from '@/components/shared/components/AppLink'
import GlassCard from '@/components/shared/components/GlassCard'
import Section from '@/components/shared/components/Section'

/**
 * The URL of the Wincent logo taken from their website.
 */
const WINCENT_LOGO_URL =
  'https://cdn.prod.website-files.com/625ec5cffd7f464ea56dc954/6267f07d3d8341e69a7ee06a_Wincent_logo_H_White.svg'

/**
 * Displays the sponsorship section on the home page.
 */
export default function SponsorshipSection() {
  return (
    <Section
      id="sponsorship-section"
      containerWidth="narrow"
      badge={
        <Badge
          icon={<Star size={14} className="sm:w-4 sm:h-4" />}
          text="Neziskový projekt"
          color="amber"
        />
      }
      title="Podporte rozvoj platformy"
      description="MathComps je nezávislý neziskový projekt s cieľom zostať navždy úplne bezplatný pre všetkých. Každý príspevok pomôže naplniť cieľ venovať sa projektu naplno. Veľká vďaka patrí podpore, ktorá sa projektu dostala od nášho hlavného sponzora."
      descriptionClassName="mb-6 sm:mb-10 lg:mb-12"
    >
      <div className="max-w-xs sm:max-w-md md:max-w-lg mx-auto text-center">
        <GlassCard title="Hlavný sponzor projektu" titleElement="h3">
          <div className="mt-4 sm:mt-6 mb-4 sm:mb-6">
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
    </Section>
  )
}
