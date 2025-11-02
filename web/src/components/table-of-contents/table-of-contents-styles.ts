/**
 * Shared styling constants for table of contents components.
 * Used by both desktop (TableOfContents) and mobile (MobileTableOfContents) to maintain
 * consistent visual appearance.
 */

/**
 * Base styles applied to all TOC links (active and inactive).
 */
export const TOC_LINK_BASE_STYLES = 'block rounded-md text-sm transition-all duration-200'

/**
 * Styles for the currently active (highlighted) TOC link.
 */
export const TOC_LINK_ACTIVE_STYLES = 'bg-slate-800/80 text-white font-medium'

/**
 * Styles for inactive TOC links with hover effects.
 */
export const TOC_LINK_INACTIVE_STYLES = 'text-slate-300 hover:bg-slate-800/40 hover:text-white'

/**
 * Container styles for TOC content areas (cards, panels).
 * Provides a clean dark background with refined border.
 */
export const TOC_CONTAINER_STYLES = 'rounded-xl bg-slate-900/95 border border-slate-700/50'
