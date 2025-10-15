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

/**
 * Common layout values used across all pages for consistency.
 * Change these values to update spacing/padding across the entire app.
 */
export const PAGE_LAYOUT = {
  // Standard responsive padding used across all pages
  padding: 'px-4 sm:px-6 md:px-8',

  // Standard header spacing (space below header)
  headerSpacing: 'h-12 sm:h-16 md:h-20',

  // Standard bottom margin for page content
  bottomMargin: 'mb-12 sm:mb-16 md:mb-12',

  // Standard max-width for most pages
  maxWidth: 'max-w-6xl',

  // Wide max-width for pages with sidebars
  maxWidthWide: 'max-w-7xl',

  // Hero section specific values
  hero: {
    // Hero top margin (space from header)
    topMargin: 'mt-20 sm:mt-24 lg:mt-32',
    // Hero content max-width
    maxWidth: 'max-w-4xl',
    // Hero content padding
    padding: 'px-4',
  },
} as const
