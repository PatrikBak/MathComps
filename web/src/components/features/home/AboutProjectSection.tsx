import { Code2, FileText, type LucideIcon, MessageSquarePlus } from 'lucide-react'
import type { Messages } from 'next-intl'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'
import { AppLink } from '@/components/shared/components/AppLink'
import { ProseLink } from '@/components/shared/components/ProseLink'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { GLOBAL_TALENT_FUND_URL, MATHCOMPS_REPO_URL, WINCENT_URL } from '@/constants/links'
import { ROUTES } from '@/i18n/i18n'

import { HomeSection, SectionHeading } from './HomeSection'

/**
 * A translation key under `home.about.help`.
 */
type HelpDescriptionKey = `help.${string & keyof Messages['home']['about']['help']}`

/**
 * One row of the "how to help" list: an icon, the sentence's translation key, and the renderer for
 * that sentence's inline `<link>` chunk.
 */
type HelpItem = {
  /** The row's lead icon. */
  icon: LucideIcon
  /** Translation key for the row's sentence. */
  descriptionKey: HelpDescriptionKey
  /** Renders the sentence's inline link. */
  link: (chunks: ReactNode) => ReactNode
}

/**
 * The three channels for contributing, each pairing an icon with its sentence's link target.
 */
const HELP_ITEMS: HelpItem[] = [
  {
    icon: MessageSquarePlus,
    descriptionKey: 'help.feedback',
    link: (chunks) => <ProseContactLink reason="feedback">{chunks}</ProseContactLink>,
  },
  {
    icon: Code2,
    descriptionKey: 'help.code',
    link: (chunks) => (
      <ProseLink href={MATHCOMPS_REPO_URL} newTab>
        {chunks}
      </ProseLink>
    ),
  },
  {
    icon: FileText,
    descriptionKey: 'help.content',
    link: (chunks) => <ProseContactLink reason="contentContribution">{chunks}</ProseContactLink>,
  },
]

/**
 * One supporter's masked wordmark: the raw logo asset plus how it's colored, sized, and shaped.
 */
type SponsorLogo = {
  /** Where the mark links to. */
  href: string
  /** Accessible label for the link. */
  label: string
  /** URL of the logo asset. */
  logoUrl: string
  /** The logo artwork's intrinsic width/height ratio. */
  aspectRatio: string
  /** Text color (plus its hover state) the mask renders in. */
  linkClassName: string
  /** Sizing for the masked span — which dimension is locked, and any scale correction. */
  spanClassName: string
}

/**
 * The project's supporters, each masked to a themeable color and set on a shared optical baseline.
 */
const SPONSOR_LOGOS: SponsorLogo[] = [
  {
    href: WINCENT_URL,
    label: 'Wincent',
    logoUrl: '/sponsors/wincent-logo-white.svg',
    aspectRatio: '594.67 / 116.29',
    linkClassName: 'text-[#B49032] hover:text-[#B49032]/80',
    spanClassName: 'w-[132px] sm:w-[168px] opacity-90',
  },
  {
    href: GLOBAL_TALENT_FUND_URL,
    label: 'Global Talent Fund',
    // Cropped to its artwork
    logoUrl: '/sponsors/gtf-logo-white.svg',
    aspectRatio: '656 / 391',
    linkClassName: 'text-foreground/90 hover:text-foreground',
    // Scaled up via transform, leaving the layout box height untouched
    spanClassName: 'h-11 scale-[1.2] sm:h-14',
  },
]

/**
 * One supporter's masked wordmark, rendered as a link in the sponsors row.
 */
function SponsorLogoLink({
  href,
  label,
  logoUrl,
  aspectRatio,
  linkClassName,
  spanClassName,
}: SponsorLogo) {
  return (
    <AppLink
      href={href}
      newTab
      plain
      aria-label={label}
      className={cn('inline-flex h-12 items-center transition-colors sm:h-16', linkClassName)}
    >
      <span
        style={{
          maskImage: `url(${logoUrl})`,
          WebkitMaskImage: `url(${logoUrl})`,
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          aspectRatio,
        }}
        className={cn('inline-block bg-current', spanClassName)}
      />
    </AppLink>
  )
}

/**
 * A single honest colophon for the project: what it is, how to help, and who supports it, laid out as
 * one composed panel.
 */
export default function AboutProjectSection() {
  // Copy for the about block
  const t = useTranslations('home.about')

  return (
    <HomeSection id="about-project">
      <SurfacePanel radius="2xl" className="p-5 text-pretty hyphens-none sm:p-6">
        {/* Narrative and the ways to help, side by side */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* What it is */}
          <div>
            {/* Section title */}
            <SectionHeading>{t('title')}</SectionHeading>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t('intro')}</p>
            <p className="mt-3 text-sm text-muted">
              {t.rich('story', {
                link: (chunks) => <ProseLink href={ROUTES.ABOUT}>{chunks}</ProseLink>,
              })}
            </p>
          </div>

          {/* How to help: an icon-led line per contribution channel */}
          <div className="md:border-l md:border-foreground/10 md:pl-12">
            {/* Column heading */}
            <h3 className="text-base font-semibold text-foreground">{t('helpTitle')}</h3>
            <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
              {HELP_ITEMS.map((item) => (
                <li key={item.descriptionKey} className="flex gap-3">
                  <item.icon size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                  <span>{t.rich(item.descriptionKey, { link: item.link })}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Who supports it */}
        <div className="mt-8 border-t border-foreground/10 pt-8">
          {/* The personal note */}
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {t.rich('supportNote', {
              link: (chunks) => <ProseContactLink reason="sponsorship">{chunks}</ProseContactLink>,
            })}
          </p>

          {/* The supporter marks */}
          <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-5">
            {SPONSOR_LOGOS.map((sponsor) => (
              <SponsorLogoLink key={sponsor.href} {...sponsor} />
            ))}
          </div>
        </div>
      </SurfacePanel>
    </HomeSection>
  )
}
