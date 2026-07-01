/**
 * The project's approved decorative color palette.
 *
 * Every component that needs a categorical/decorative accent color MUST
 * reference this union and map. This is the single source of truth — raw
 * Tailwind color classes (e.g. `text-blue-400`) should never appear at
 * call sites. To add a new accent, extend this file and the map below.
 */

/** Constrained set of decorative accent colors available across the project. */
export type AccentColor =
  | 'blue'
  | 'orange'
  | 'cyan'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'rose'
  | 'red'
  | 'purple'
  | 'indigo'

/**
 * Resolved Tailwind classes for a single {@link AccentColor}.
 */
type AccentColorClasses = {
  /** Tailwind text-color class. */
  text: string
  /** Tailwind tinted background class. */
  bg: string
  /** Tailwind faint background tint. */
  panelBg: string
  /** Tailwind panel border class. */
  panelBorder: string
  /** Tailwind hover background class. */
  hoverBg: string
  /** Tailwind hover border class. */
  hoverBorder: string
  /** Tailwind hover box-shadow (glow) class. */
  hoverGlow: string
}

/** Maps each {@link AccentColor} to its resolved {@link AccentColorClasses}. */
export const ACCENT_COLOR_MAP: Record<AccentColor, AccentColorClasses> = {
  blue: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    panelBg: 'bg-blue-500/5',
    panelBorder: 'border-blue-500/20',
    hoverBg: 'hover:bg-blue-500/15',
    hoverBorder: 'hover:border-blue-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(96,165,250,0.4)]',
  },
  indigo: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    panelBg: 'bg-indigo-500/5',
    panelBorder: 'border-indigo-500/20',
    hoverBg: 'hover:bg-indigo-500/15',
    hoverBorder: 'hover:border-indigo-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(129,140,248,0.4)]',
  },
  orange: {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    panelBg: 'bg-orange-500/5',
    panelBorder: 'border-orange-500/20',
    hoverBg: 'hover:bg-orange-500/15',
    hoverBorder: 'hover:border-orange-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(251,146,60,0.4)]',
  },
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    panelBg: 'bg-cyan-500/5',
    panelBorder: 'border-cyan-500/20',
    hoverBg: 'hover:bg-cyan-500/15',
    hoverBorder: 'hover:border-cyan-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    panelBg: 'bg-amber-500/5',
    panelBorder: 'border-amber-500/20',
    hoverBg: 'hover:bg-amber-500/15',
    hoverBorder: 'hover:border-amber-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(251,191,36,0.4)]',
  },
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    panelBg: 'bg-emerald-500/5',
    panelBorder: 'border-emerald-500/20',
    hoverBg: 'hover:bg-emerald-500/15',
    hoverBorder: 'hover:border-emerald-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(52,211,153,0.4)]',
  },
  sky: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    panelBg: 'bg-sky-500/5',
    panelBorder: 'border-sky-500/20',
    hoverBg: 'hover:bg-sky-500/15',
    hoverBorder: 'hover:border-sky-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(56,189,248,0.4)]',
  },
  rose: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    panelBg: 'bg-rose-500/5',
    panelBorder: 'border-rose-500/20',
    hoverBg: 'hover:bg-rose-500/15',
    hoverBorder: 'hover:border-rose-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(251,113,133,0.4)]',
  },
  red: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    panelBg: 'bg-red-500/5',
    panelBorder: 'border-red-500/20',
    hoverBg: 'hover:bg-red-500/15',
    hoverBorder: 'hover:border-red-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(248,113,113,0.4)]',
  },
  purple: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    panelBg: 'bg-purple-500/5',
    panelBorder: 'border-purple-500/20',
    hoverBg: 'hover:bg-purple-500/15',
    hoverBorder: 'hover:border-purple-400/20',
    hoverGlow: 'hover:shadow-[0_0_15px_rgba(192,132,252,0.4)]',
  },
}
