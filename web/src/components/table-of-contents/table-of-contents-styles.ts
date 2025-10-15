/**
 * Shared styling constants for table of contents components.
 * Used by both desktop (TableOfContents) and mobile (MobileTableOfContents) to maintain
 * consistent visual appearance.
 */

/**
 * Base styles applied to all TOC links (active and inactive).
 */
export const TOC_LINK_BASE_STYLES = 'block rounded text-sm transition-colors'

/**
 * Styles for the currently active (highlighted) TOC link.
 */
export const TOC_LINK_ACTIVE_STYLES = 'bg-white/10 text-white'

/**
 * Styles for inactive TOC links with hover effects.
 */
export const TOC_LINK_INACTIVE_STYLES = 'text-gray-300 hover:bg-white/5 hover:text-white'

/**
 * Container styles for TOC content areas (cards, panels).
 * Provides glassmorphism effect with subtle border.
 */
export const TOC_CONTAINER_STYLES = 'rounded-lg bg-white/5 backdrop-blur-sm border border-white/10'
