/**
 * Centralized style constants for guide components.
 * Contains all commonly repeated class patterns to maintain consistency and reduce duplication.
 */
export const GUIDE_STYLES = {
  // Card and container styles (responsive padding)
  card: 'border border-slate-700/50 rounded-lg p-4 sm:p-5 lg:p-6 bg-slate-800/20 hover:border-slate-600/50 transition-colors',
  cardLarge:
    'border border-slate-700/50 rounded-lg p-4 sm:p-6 bg-gradient-to-br from-slate-800/20 to-slate-800/10',

  // Final box
  noteBox: 'border border-emerald-500/30 rounded-lg p-4 sm:p-5 bg-emerald-500/5',

  // List item styles
  listItem: 'flex items-start gap-3 text-sm sm:text-base text-slate-300 leading-relaxed',
  listItemSmall: 'flex items-start gap-3 text-sm sm:text-base text-slate-400 leading-relaxed',

  // Bullet point styling
  bulletDot: 'text-emerald-500 flex-shrink-0 mt-[6px] sm:mt-[8px]',
  bulletDotCheckbox: 'text-emerald-500 flex-shrink-0 mt-[2px] sm:mt-[4px]',

  // Text styles
  textNormal: 'text-base sm:text-lg text-slate-300',
  textSmall: 'text-sm sm:text-base text-slate-400',
  textAcronym: 'text-sm text-slate-400 italic',

  // Heading text for cards
  cardTitle: 'text-lg sm:text-xl font-bold text-white',
  cardTitleSmall: 'text-base sm:text-lg font-semibold text-white',

  // Spacing
  sectionSpacing: 'space-y-4 sm:space-y-5 md:space-y-6',
  contentSpacing: 'space-y-2 sm:space-y-3',
  listSpacing: 'space-y-3 sm:space-y-4',
  listBottomMargin: 'mb-4 sm:mb-8',

  // The styles for the school section
  schoolCommon: 'text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2',
  elementaryColor: 'text-purple-400',
  elementaryBgColor: 'bg-purple-500/15',
  highSchoolColor: 'text-orange-400',
  highSchoolBgColor: 'bg-orange-500/15',

  // The common link styling
  link: 'text-blue-400 hover:text-blue-300 underline transition-colors',
} as const
