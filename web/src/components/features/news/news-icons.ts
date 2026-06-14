import {
  ArrowDownUp,
  Languages,
  ListPlus,
  type LucideIcon,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  Newspaper,
  Route,
  SquareCheckBig,
  Tent,
  Trophy,
} from 'lucide-react'

/**
 * The set of line icons available as a news card cover.
 */
export type NewsIconName =
  | 'trophy'
  | 'square-check-big'
  | 'list-plus'
  | 'mouse-pointer-click'
  | 'monitor-smartphone'
  | 'languages'
  | 'arrow-down-up'
  | 'newspaper'
  | 'route'
  | 'tent'
  | 'messages-square'

/**
 * Maps each {@link NewsIconName} to its Lucide component.
 */
export const NEWS_ICONS: Record<NewsIconName, LucideIcon> = {
  trophy: Trophy,
  'square-check-big': SquareCheckBig,
  'list-plus': ListPlus,
  'mouse-pointer-click': MousePointerClick,
  'monitor-smartphone': MonitorSmartphone,
  languages: Languages,
  'arrow-down-up': ArrowDownUp,
  newspaper: Newspaper,
  route: Route,
  tent: Tent,
  'messages-square': MessagesSquare,
}
