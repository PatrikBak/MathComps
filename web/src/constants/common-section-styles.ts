/**
 * Centralized style constants for common section components across the application.
 * Contains commonly repeated class patterns to maintain consistency and reduce duplication.
 * Used by home, about, guide, and shared components.
 */
export const HOME_ABOUT_STYLES = {
  // Section wrapper with consistent vertical spacing
  sectionWrapper: 'py-6 sm:py-10 md:py-14',

  // Header container (for titles, badges, and descriptions)
  headerContainer: 'text-center mb-8 sm:mb-10 md:mb-12',

  // Section titles (main headings)
  sectionTitle: 'text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-5 md:mb-6',

  // Section descriptions (subtitle/intro text)
  sectionDescription:
    'text-slate-400 text-sm sm:text-base md:text-lg max-w-4xl mx-auto leading-normal sm:leading-relaxed',

  // Container max-widths for different content types
  containerNarrow: 'max-w-md sm:max-w-2xl md:max-w-4xl mx-auto px-5',
  containerWide: 'max-w-7xl mx-auto px-4',
  containerStandard: 'max-w-4xl mx-auto px-4',

  // Three-card grid layout
  threeCardGrid:
    'grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8 max-w-xs sm:max-w-md md:max-w-4xl md:max-w-5xl mx-auto',

  // Footer text for sections
  sectionFooter: 'text-center mt-10 sm:mt-14 md:mt-24 text-sm text-slate-500 max-w-xl mx-auto',
} as const
