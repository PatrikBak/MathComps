import type { TableOfContentsItem } from '@/components/table-of-contents/table-of-contents-types'

/**
 * Static constants for all guide section IDs to ensure consistency and prevent typos.
 * These constants are used throughout the guide components and structure definition.
 */
export const GUIDE_SECTION_IDS = {
  // Main sections
  WHY_COMPETITIONS: 'why-competitions',
  COMPETITIONS: 'competitions',
  RESOURCES: 'resources',
  HOW_TO_START: 'how-to-start',

  // Competition subsections
  MATH_OLYMPIAD: 'math-olympiad',
  SEMINARS: 'seminars',
  OTHER_COMPETITIONS: 'other-competitions',

  // Seminar subsections
  SEMINARS_ELEMENTARY: 'seminars-elementary',
  SEMINARS_HIGH_SCHOOL: 'seminars-high-school',

  // Other competitions subsections
  OTHER_COMPETITIONS_TEAM: 'other-competitions-team',
  OTHER_COMPETITIONS_INDIVIDUAL: 'other-competitions-individual',

  // Resource subsections
  WEBSITES: 'websites',
  PROGRAMS: 'programs',
  YOUTUBE: 'youtube',
  STUDY_TEXTS: 'study-texts',
} as const

/**
 * Type definition for a guide section with optional nested children.
 * Used to define the hierarchical structure of the guide navigation.
 */
type GuideSection = {
  /** Unique identifier for the section */
  id: string
  /** Display title of the section */
  title: string
  /** Optional nested child sections */
  children?: GuideSection[]
}

/**
 * Static definition of the guide's section hierarchy.
 * This structure mirrors the component tree and is used to generate
 * the table of contents navigation items in a SSR-compatible way.
 */
const GUIDE_STRUCTURE: GuideSection[] = [
  {
    id: GUIDE_SECTION_IDS.WHY_COMPETITIONS,
    title: 'Prečo matematické súťaže?',
  },
  {
    id: GUIDE_SECTION_IDS.COMPETITIONS,
    title: 'Zoznam súťaží',
    children: [
      {
        id: GUIDE_SECTION_IDS.MATH_OLYMPIAD,
        title: 'Matematická olympiáda',
      },
      {
        id: GUIDE_SECTION_IDS.SEMINARS,
        title: 'Korešpondenčné semináre',
        children: [
          {
            id: GUIDE_SECTION_IDS.SEMINARS_ELEMENTARY,
            title: 'ZŠ semináre',
          },
          {
            id: GUIDE_SECTION_IDS.SEMINARS_HIGH_SCHOOL,
            title: 'SŠ semináre',
          },
        ],
      },
      {
        id: GUIDE_SECTION_IDS.OTHER_COMPETITIONS,
        title: 'Ďalšie súťaže',
        children: [
          {
            id: GUIDE_SECTION_IDS.OTHER_COMPETITIONS_TEAM,
            title: 'Tímové súťaže',
          },
          {
            id: GUIDE_SECTION_IDS.OTHER_COMPETITIONS_INDIVIDUAL,
            title: 'Individuálne súťaže',
          },
        ],
      },
    ],
  },
  {
    id: GUIDE_SECTION_IDS.RESOURCES,
    title: 'Ďalšie odkazy',
    children: [
      {
        id: GUIDE_SECTION_IDS.WEBSITES,
        title: 'Webstránky a komunity',
      },
      {
        id: GUIDE_SECTION_IDS.PROGRAMS,
        title: 'Programy a nástroje',
      },
      {
        id: GUIDE_SECTION_IDS.YOUTUBE,
        title: 'YouTube kanály',
      },
      {
        id: GUIDE_SECTION_IDS.STUDY_TEXTS,
        title: 'Študijné texty',
      },
    ],
  },
  {
    id: GUIDE_SECTION_IDS.HOW_TO_START,
    title: 'Ako začať aj pokračovať',
  },
]

/**
 * The pre-calculcate TOC for the guide component
 */
export const guideTableOfContents = (() => {
  // We'll agreggate the result here
  const navigationItems: TableOfContentsItem[] = []

  // The last seen section we've processed e.g. 1.2.2
  const levelCounters: number[] = []

  /**
   * Recursively process a section and its children to build navigation items.
   * Generates hierarchical section numbering (1, 1.1, 1.2, 2, etc.) for TOC display.
   */
  function processSection(section: GuideSection, level: number) {
    // Initialize counter array to track section numbers at each hierarchy level
    while (levelCounters.length <= level) {
      levelCounters.push(0)
    }

    // Increment the counter for current level to assign this section's number
    levelCounters[level] += 1

    // Reset all deeper level counters since we're starting a new branch at this level
    for (let i = level + 1; i < levelCounters.length; i++) {
      levelCounters[i] = 0
    }

    // Construct hierarchical section number by joining active counters (e.g., "1.2.3")
    const sectionNumber = levelCounters
      .slice(0, level + 1)
      .filter((count) => count > 0)
      .join('.')

    // Create TOC item with separate number and title fields
    navigationItems.push({
      id: section.id,
      label: sectionNumber,
      title: section.title,
      level: level + 1,
    })

    // Recursively process child sections to maintain hierarchical numbering
    if (section.children) {
      section.children.forEach((child) => processSection(child, level + 1))
    }
  }

  // Handle each section
  GUIDE_STRUCTURE.forEach((section) => processSection(section, 0))

  // The recursive call should have filled this up
  return navigationItems
})()
