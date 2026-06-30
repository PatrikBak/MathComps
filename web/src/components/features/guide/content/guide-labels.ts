import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type {
  CompetitionKind,
  GuidePage,
  ResourceBucket,
  ResourceLevel,
  SchoolLevel,
} from './guide-content-types'
import type { FilterCountry } from './guide-filters'

/** Localized label maps for the deck's enumerable values, each keyed by canonical id. */
export type GuideLabels = {
  /** Page tab/section names */
  page: Record<GuidePage, string>
  /** Competition kind names */
  kind: Record<CompetitionKind, string>
  /** Resource bucket names */
  bucket: Record<ResourceBucket, string>
  /** Resource experience-level names (short nouns) */
  resourceLevel: Record<ResourceLevel, string>
  /** Resource experience-level qualifier phrases (e.g. "for beginners") */
  resourceAudience: Record<ResourceLevel, string>
  /** School level names */
  schoolLevel: Record<SchoolLevel, string>
  /** Country names */
  country: Record<FilterCountry, string>
}

/**
 * A hook that resolves the deck's enumerable-value labels from the active locale into one memoized
 * record set.
 *
 * @returns Label records for every enumerable deck value, keyed by canonical id.
 */
export function useGuideLabels(): GuideLabels {
  // Deck chrome labels
  const tDeck = useTranslations('guide.deck')
  // Shared school-level names
  const tLevels = useTranslations('guide.schoolLevels')
  // Shared country names
  const tCountries = useTranslations('countries')

  // Build every label map once
  return useMemo(() => {
    // Resolve each page label from the deck namespace
    const page: Record<GuidePage, string> = {
      why: tDeck('pages.why'),
      olympiad: tDeck('pages.olympiad'),
      other: tDeck('pages.other'),
      seminars: tDeck('pages.seminars'),
      resources: tDeck('pages.resources'),
      getStarted: tDeck('pages.getStarted'),
    }

    // Resolve the competition-kind labels
    const kind: Record<CompetitionKind, string> = {
      team: tDeck('kind.team'),
      individual: tDeck('kind.individual'),
    }

    // Resolve the resource-bucket labels
    const bucket: Record<ResourceBucket, string> = {
      websites: tDeck('bucket.websites'),
      programs: tDeck('bucket.programs'),
      youtube: tDeck('bucket.youtube'),
      studyTexts: tDeck('bucket.studyTexts'),
    }

    // Resolve the short level nouns
    const resourceLevel: Record<ResourceLevel, string> = {
      beginner: tDeck('resourceLevel.beginner'),
      advanced: tDeck('resourceLevel.advanced'),
    }

    // Resolve the audience qualifier phrases
    const resourceAudience: Record<ResourceLevel, string> = {
      beginner: tDeck('resourceAudience.beginner'),
      advanced: tDeck('resourceAudience.advanced'),
    }

    // Resolve the school-level labels
    const schoolLevel: Record<SchoolLevel, string> = {
      elementary: tLevels('elementary'),
      highSchool: tLevels('highSchool'),
    }

    // Resolve the country labels
    const country: Record<FilterCountry, string> = {
      SK: tCountries('SK'),
      CZ: tCountries('CZ'),
      PL: tCountries('PL'),
      INTERNATIONAL: tCountries('INTERNATIONAL'),
    }

    // Hand back every label map
    return { page, kind, bucket, resourceLevel, resourceAudience, schoolLevel, country }
  }, [tDeck, tLevels, tCountries])
}
