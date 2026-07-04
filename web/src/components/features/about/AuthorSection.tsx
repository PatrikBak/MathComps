import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { GithubIcon, LinkedinIcon } from '@/components/shared/components/brand-icons'
import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { AUTHOR_GITHUB_URL, AUTHOR_LINKEDIN_URL, AUTHOR_PHOTO_PATH } from '@/constants/author'

import AboutPanelSection from './layout/AboutPanelSection'

export const AuthorSection = () => {
  // Translations for section
  const t = useTranslations('about.author')

  return (
    <AboutPanelSection id="aboutAuthor" title={t('title')}>
      <div className="flex flex-col sm:flex-row items-start gap-8">
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <ImageWithLoader
            src={AUTHOR_PHOTO_PATH}
            alt={t('alt')}
            width={128}
            height={128}
            className="object-cover rounded-full"
            priority
          />
        </div>

        <div className="text-muted text-sm sm:text-base lg:text-lg leading-relaxed space-y-4 sm:pr-2">
          <div>
            {t.rich('description', {
              p: (chunks) => <p>{chunks}</p>,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>

          <div className="flex items-center gap-4 sm:gap-6 pt-2">
            <AppLink
              href={AUTHOR_LINKEDIN_URL}
              className="text-muted hover:text-foreground transition-colors flex items-center gap-2"
              title="LinkedIn"
            >
              <LinkedinIcon size={20} />
              <span>LinkedIn</span>
            </AppLink>

            <AppLink
              href={AUTHOR_GITHUB_URL}
              className="text-muted hover:text-foreground transition-colors flex items-center gap-2"
              title="GitHub"
            >
              <GithubIcon size={20} />
              <span>GitHub</span>
            </AppLink>
          </div>
        </div>
      </div>
    </AboutPanelSection>
  )
}
