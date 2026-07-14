import { type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { AppLink } from '@/components/shared/components/AppLink'
import { GithubIcon, LinkedinIcon } from '@/components/shared/components/brand-icons'
import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { AUTHOR_GITHUB_URL, AUTHOR_LINKEDIN_URL, AUTHOR_PHOTO_PATH } from '@/constants/author'
import { GEOGEN_URL } from '@/constants/links'

import { AboutProse } from './layout/AboutProse'
import BeatLabel from './layout/BeatLabel'

/**
 * Props for the {@link SocialLink} component.
 */
type SocialLinkProps = {
  /** The profile URL. */
  href: string
  /** The platform's brand icon. */
  icon: LucideIcon
  /** The platform's name. */
  label: string
}

/**
 * One of the author's profile links: a brand icon beside its platform name.
 */
function SocialLink({ href, icon: Icon, label }: SocialLinkProps) {
  return (
    <AppLink
      href={href}
      className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
      title={label}
    >
      <Icon size={18} />
      <span>{label}</span>
    </AppLink>
  )
}

/**
 * The "who" beat: the author's portrait beside a first-person bio.
 */
export const AuthorSection = () => {
  // Translations for section
  const t = useTranslations('about.author')

  return (
    <AnimatedSection id="aboutAuthor" eager>
      <BeatLabel>{t('title')}</BeatLabel>
      {/* Portrait on one side, bio and links on the other */}
      <div className="mt-6 flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
        {/* The portrait */}
        <div className="mx-auto shrink-0 sm:mx-0">
          <ImageWithLoader
            src={AUTHOR_PHOTO_PATH}
            alt={t('alt')}
            width={140}
            height={140}
            className="rounded-2xl object-cover ring-1 ring-brand/20"
            priority
          />
        </div>

        {/* Bio and social links */}
        <AboutProse className="space-y-4">
          {/* Bio */}
          <div>
            {t.rich('description', {
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
              link: (chunks) => (
                <AppLink
                  href={GEOGEN_URL}
                  newTab
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors duration-300"
                >
                  {chunks}
                </AppLink>
              ),
            })}
          </div>

          {/* Where to find him */}
          <div className="flex items-center gap-6 pt-1 text-sm">
            <SocialLink href={AUTHOR_LINKEDIN_URL} icon={LinkedinIcon} label="LinkedIn" />
            <SocialLink href={AUTHOR_GITHUB_URL} icon={GithubIcon} label="GitHub" />
          </div>
        </AboutProse>
      </div>
    </AnimatedSection>
  )
}
