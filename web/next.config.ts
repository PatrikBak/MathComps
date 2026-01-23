import createNextIntlPlugin from 'next-intl/plugin'

/**
 * The config enabeling i18n support + partial static generation
 */
export default createNextIntlPlugin()({
  cacheComponents: true,
})
