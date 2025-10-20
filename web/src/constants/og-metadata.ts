/**
 * Open Graph metadata constants
 * Based on the project's focus on mathematical competitions, learning materials, and community
 */

// Site information
export const SITE_NAME = 'MathComps'
export const SITE_TITLE = 'MathComps'

// Main descriptions - keeping the authentic tone from the codebase
export const SITE_DESCRIPTION =
  'Platforma pre matematické súťaže s archívom úloh, učebnými materiálmi a rozcestníkom užitočných zdrojov.'

// Keywords based on the site content
export const SITE_KEYWORDS = [
  'matematika',
  'matematické súťaže',
  'matematická olympiáda',
  'matematické úlohy',
  'matematické materiály',
  'matematický archív',
]

// Twitter/X
export const TWITTER_CARD_TYPE = 'summary_large_image'

// Language
export const SITE_LANGUAGE = 'sk'

/**
 * Default metadata template for pages without specific content
 */
export const DEFAULT_OG_METADATA = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  siteName: SITE_NAME,
  locale: 'sk_SK',
  type: 'website' as const,
}
