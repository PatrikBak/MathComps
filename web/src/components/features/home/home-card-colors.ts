import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'

/**
 * Rotating color schemes for the three-column card grid on the home page.
 * Cards cycle through these by index to create visual variety.
 */
export const HOME_CARD_COLOR_SCHEMES = [
  {
    iconColor: ACCENT_COLOR_MAP.indigo.text,
    iconGradient: 'from-indigo-600/30 to-purple-600/30',
  },
  {
    iconColor: ACCENT_COLOR_MAP.purple.text,
    iconGradient: 'from-purple-600/30 to-pink-600/30',
  },
  {
    iconColor: ACCENT_COLOR_MAP.rose.text,
    iconGradient: 'from-pink-600/30 to-rose-600/30',
  },
]
