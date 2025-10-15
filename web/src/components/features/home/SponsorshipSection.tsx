import { Heart, Star } from 'lucide-react'

import Badge from '@/components/features/home/layout/Badge'
import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { AppLink } from '@/components/shared/components/AppLink'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

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
                  className="inline-flex items-center gap-2 sm:gap-2.5 text-amber-300 hover:text-amber-200 transition-colors duration-300"
                >
                  <svg
                    width="28"
                    height="21"
                    viewBox="0 0 255 191"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-90 sm:w-9 sm:h-7 lg:w-10 lg:h-8"
                  >
                    <path
                      d="M242.2 53.58C239.599 48.0225 236.068 42.9497 231.76 38.58L231.51 38.36C238.96 38.48 246.51 35.6 253.15 30.52C252.431 30.3898 251.699 30.3428 250.97 30.38C238.47 32.56 227.13 29.86 216.56 23.98C213.6 22.34 210.653 20.6733 207.72 18.98C214.658 15.6609 219.997 9.72784 222.57 2.48001C219.434 5.97576 215.405 8.55027 210.915 9.92643C206.426 11.3026 201.646 11.4283 197.09 10.29C195.35 9.81001 193.67 9.13001 191.88 8.79001C191.021 8.62007 190.144 8.55959 189.27 8.61001C185.464 6.74921 181.216 5.98401 177 6.40001C173.53 6.76001 170 5.90001 166.47 5.34001C164.86 5.08001 163.79 5.23001 162.89 6.69001C162.528 7.32686 162.061 7.89819 161.51 8.38001C161.604 8.77109 161.821 9.1216 162.13 9.38001C162.887 10.0158 163.865 10.3251 164.85 10.24C172.6 9.13001 173.23 12.9 177.5 12.09C175.919 13.0569 174.162 13.7021 172.331 13.9887C170.5 14.2753 168.631 14.1976 166.83 13.76C164.031 12.9987 161.567 11.3232 159.83 9.00001L138.65 6.79001C136.921 9.4805 136.113 12.6605 136.35 15.85C136.35 19.29 137.14 22.39 138.16 23.85L139.53 13.04C139.885 13.0626 140.23 13.1707 140.535 13.3553C140.84 13.5399 141.095 13.7954 141.28 14.1C141.905 15.1565 142.204 16.3741 142.14 17.6L142.85 23.6C143.09 24.95 143.24 27.48 144.85 29.13L145.5 22.04C145.77 21.1786 146.37 20.4593 147.17 20.04C148.029 19.7624 148.96 19.8051 149.79 20.16L156.87 22.55C161.56 23.04 164.8 28.24 171.54 27.09C171.89 27.03 171.75 31.77 167.17 32.34L161.75 31.48C159.448 30.8533 156.993 31.1324 154.89 32.26L149.89 34.8C147.935 35.5272 145.792 35.5695 143.81 34.92L142.69 32.46C142.414 31.175 142.5 29.8386 142.94 28.6L140.94 33.47C140.979 34.0452 140.792 34.6128 140.418 35.0519C140.044 35.4909 139.514 35.7666 138.94 35.82L137.25 35.65C136.905 35.5662 136.603 35.3601 136.4 35.07L135.9 33.77C135.856 31.9384 136.137 30.1136 136.73 28.38L134.58 32.71C134.263 34.2391 134.349 35.8243 134.83 37.31L135.07 39.16L134.7 40.88C135.24 42.1 134.7 41.31 139.05 41.69L146.89 42.43C149.342 42.2265 151.725 41.5183 153.89 40.35L163.09 39.86C165.87 41.26 168.56 42.86 171.21 44.47C173.334 45.8445 175.716 46.7732 178.21 47.2C180.535 47.7624 182.976 47.6055 185.21 46.75L192.78 42.34L192.32 43.34C190.99 45.469 189.161 47.2418 186.992 48.505C184.822 49.7683 182.378 50.4839 179.87 50.59C184.24 56.85 187.32 62.99 188.42 69.05C189.135 73.1289 189.135 77.3011 188.42 81.38L186.85 87.93L185.85 90.93C186.13 90.42 163.47 133.47 163.47 133.47L149 109.94L110.82 46.18L110.77 46.26V46.18L58.2098 133.41C58.2098 133.41 38.5898 103 32.4598 87.23C31.2598 83.08 30.2598 77.94 31.0298 73.71C34.2798 55.71 43.2698 58.32 44.3598 45.41C42.7498 50.33 33.5598 47.52 28.7198 53.95C36.9998 39.17 51.6298 43.05 56.8398 26.72C50.9298 32.38 44.9298 29.95 39.5398 30.48C53.5398 25.48 62.4798 6.48001 73.7998 13.17C72.5398 7.91001 55.6198 0.810009 41.7998 16.81C47.2698 11.29 44.7998 5.38001 52.0798 2.51001C30.2998 4.80001 34.9998 14.44 28.4198 20.24C28.8298 14.31 27.7498 7.88001 23.9298 5.71001C24.6598 16.62 18.0698 16.32 16.4198 34.21C17.5898 36.21 11.3598 25.95 5.20982 26.44C13.7798 39.17 3.11982 52.84 1.20982 71.44C0.830246 74.0565 0.773155 76.7096 1.03982 79.34C1.40833 81.9231 2.07962 84.4539 3.03982 86.88C3.73673 88.608 4.56585 90.2796 5.51982 91.88C5.28982 92.35 5.04982 92.79 4.83982 93.27C2.71893 97.9462 1.88356 103.103 2.41982 108.21C2.66641 110.906 3.36977 113.54 4.49982 116C5.7986 118.634 7.64675 120.96 9.91982 122.82C14.1798 126.25 17.8298 128.28 20.9998 130.97C24.1577 133.573 27.0244 136.51 29.5498 139.73C32.2056 143.159 34.6054 146.779 36.7298 150.56L41.3198 159.47C41.6598 160.17 42.0098 160.86 42.3198 161.56L56.9998 189.87L95.8598 123.82L110.74 98.15L125.62 123.82L164.49 189.87L200.96 122.87C201.315 125.569 201.203 128.309 200.63 130.97C206.49 124.85 209.71 117.44 211.5 108.81C212.666 112.997 212.666 117.423 211.5 121.61C213.44 120.41 217.05 113.23 218.22 108.41C219.385 103.5 219.723 98.4308 219.22 93.41C221.526 98.1662 222.749 103.375 222.8 108.66C227.31 98.93 228.2 89.16 226.88 79.02C230.29 81.28 232.31 86.1 232.13 91.85C234.373 88.0507 235.586 83.7318 235.65 79.32C235.783 74.9667 234.867 70.6453 232.98 66.72C236.912 67.9058 240.354 70.3337 242.79 73.64C242.79 67.91 237.35 58.08 228.79 48.41C233.51 49.3962 238.039 51.1423 242.2 53.58Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeMiterlimit="10"
                    />
                  </svg>
                  <span className="text-lg sm:text-2xl lg:text-3xl font-bold">Wincent</span>
                </AppLink>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mb-4 sm:mb-6" />

              <AppLink
                href="mailto:contact@mathcomps.fun"
                className="inline-flex items-center gap-2 sm:gap-2 lg:gap-3 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 rounded-lg lg:rounded-xl text-violet-300 font-semibold lg:font-bold text-sm sm:text-base lg:text-lg border-2 border-violet-500/40 hover:bg-violet-500/10 hover:border-violet-500/70 transition-all duration-300 shadow-lg shadow-violet-500/10"
              >
                <Heart size={16} className="sm:w-[18px] sm:h-[18px] lg:w-6 lg:h-6" />
                <span>Staňte sa sponzorom</span>
              </AppLink>
            </GlassCard>
          </div>
        </div>
      </section>
    </AnimatedSection>
  )
}
