import { useClerk } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bot, Inbox, LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { selectionHref } from '@/components/features/problem-selection/model/selection-routes'
import type { Organization } from '@/components/features/problem-selection/model/selection-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { MATHILDA_NAME } from '@/constants/mathilda'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { ROUTES } from '@/i18n/i18n'

import { AppLink } from '../shared/components/AppLink'

/**
 * Where a user menu item is drawn: the header's dropdown, or the mobile drawer.
 */
export type UserMenuItemVariant = 'dropdown' | 'mobile'

/**
 * The layout and text of a row of the user menu, in each place it is drawn, whether or not it can be picked.
 */
export const USER_MENU_ROW_CLASS: Record<UserMenuItemVariant, string> = {
  dropdown: 'flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/70',
  mobile: 'flex items-center gap-3 px-4 py-3 text-base font-medium text-muted-foreground',
}

/**
 * Props every user menu item takes.
 */
type UserMenuItemBaseProps = {
  /** Whether the menu item is disabled */
  disabled?: boolean
  /** Where the item is drawn */
  variant: UserMenuItemVariant
  /** Called when the item is picked */
  onClick?: () => void
}

/**
 * Props of an item every signed-in user's menu has, or every admin's.
 */
type FixedUserMenuItemProps = UserMenuItemBaseProps & {
  /** Which of those items it is */
  type: 'mathilda' | 'defenseReview' | 'profile' | 'signOut'
}

/**
 * Props of an item opening the selection of an organization the user is a member of.
 */
type OrganizationUserMenuItemProps = UserMenuItemBaseProps & {
  /** The kind of item: one opening an organization's selection */
  type: 'organization'
  /** The organization whose selection it opens. */
  organization: Organization
}

/**
 * Props for the {@link UserMenuItem} component.
 */
type UserMenuItemProps = FixedUserMenuItemProps | OrganizationUserMenuItemProps

/**
 * Props for the {@link UserMenuTile} component.
 */
type UserMenuTileProps = {
  /** The tile's background and ink colours. */
  className: string
  /** What the tile holds: an icon, or a letter. */
  children: ReactNode
}

/**
 * The coloured square a row of the user menu opens with.
 */
export function UserMenuTile({ className, children }: UserMenuTileProps) {
  // The square, its mark centred in it
  return (
    <div
      className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', className)}
    >
      {children}
    </div>
  )
}

/**
 * A row of the user menu that can be picked: a tile and a label. In the header's dropdown it is a Radix menu item over
 * a link or a button, and in the mobile drawer the link or button alone.
 */
export const UserMenuItem = (props: UserMenuItemProps) => {
  // What every item takes
  const { disabled = false, variant, onClick } = props

  // The copy the items' labels come from
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const tDefenseReview = useTranslations('admin.defenseReview')

  // Clerk's sign-out
  const { signOut } = useClerk()

  // A function reading the address of the page being read
  const getCurrentUrl = useCurrentUrl()

  // A function signing the user out and telling the caller
  const handleSignOut = () => {
    // Signed out back onto the page they are on
    signOut({ redirectUrl: getCurrentUrl() })

    // And the caller told
    onClick?.()
  }

  // A function naming what the item reads
  const labelOf = (): string => {
    switch (props.type) {
      case 'mathilda':
        return MATHILDA_NAME
      case 'defenseReview':
        return tDefenseReview('title')
      case 'profile':
        return tCommon('profile')
      case 'signOut':
        return tAuth('signOut')
      case 'organization':
        return props.organization.name
      default:
        return assertNever(props)
    }
  }

  // A function drawing the tile the item opens with
  const tileOf = (): ReactNode => {
    switch (props.type) {
      case 'mathilda':
        return (
          <UserMenuTile className="bg-brand/10 text-brand-light">
            <Bot className="w-5 h-5" />
          </UserMenuTile>
        )
      case 'defenseReview':
        return (
          <UserMenuTile className="bg-warning/10 text-warning">
            <Inbox className="w-5 h-5" />
          </UserMenuTile>
        )
      case 'profile':
        return (
          <UserMenuTile className="bg-info/10 text-info-light">
            <User className="w-5 h-5" />
          </UserMenuTile>
        )
      case 'signOut':
        return (
          <UserMenuTile className="bg-error/10 text-error">
            <LogOut className="w-5 h-5" />
          </UserMenuTile>
        )
      case 'organization':
        // The organization's initial, kept out of the item's accessible name, which the label beside it already gives
        return (
          <UserMenuTile className="bg-success/10 text-success">
            <span aria-hidden className="text-sm font-semibold">
              {props.organization.name[0]}
            </span>
          </UserMenuTile>
        )
      default:
        return assertNever(props)
    }
  }

  // The item's tile and label
  const content = (
    <>
      {tileOf()}
      <span>{labelOf()}</span>
    </>
  )

  // The item, drawn for the place it sits in
  switch (variant) {
    case 'dropdown':
      // How an item looks in the header's dropdown
      const baseClasses = cn(
        USER_MENU_ROW_CLASS.dropdown,
        'hover:text-foreground',
        'transition-colors duration-150',
        // Radix focuses an item when the pointer enters it, so a focus ring would double as a hover
        // style. The highlight is the indicator for both routes.
        'outline-none data-[highlighted]:bg-foreground/5 data-[highlighted]:text-foreground',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      // A Radix menu item over a button for an action, or over a link for a page
      switch (props.type) {
        case 'mathilda':
          return (
            <DropdownMenu.Item asChild>
              <button onClick={onClick} className={cn('w-full', baseClasses)}>
                {content}
              </button>
            </DropdownMenu.Item>
          )
        case 'signOut':
          return (
            <DropdownMenu.Item asChild>
              <button onClick={handleSignOut} className={cn('w-full', baseClasses)}>
                {content}
              </button>
            </DropdownMenu.Item>
          )
        case 'defenseReview':
          return (
            <DropdownMenu.Item asChild>
              <AppLink href={ROUTES.ADMIN_DEFENSES} plain className={baseClasses}>
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
        case 'profile':
          return (
            <DropdownMenu.Item asChild disabled={disabled}>
              <AppLink
                href={ROUTES.PROFILE}
                plain
                className={baseClasses}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : undefined}
              >
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
        case 'organization':
          // Set in under the selections' heading, its tile starting inside the heading's, and typed to by its name
          // alone, since the initial on its tile is text too
          return (
            <DropdownMenu.Item asChild textValue={props.organization.name}>
              <AppLink
                href={selectionHref(props.organization.slug)}
                plain
                className={cn(baseClasses, 'pl-10')}
              >
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
        default:
          return assertNever(props)
      }

    case 'mobile':
      // How an item looks in the mobile drawer
      const mobileClasses = cn(
        USER_MENU_ROW_CLASS.mobile,
        'w-full hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all duration-200',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      // A button for an action, or a link for a page
      switch (props.type) {
        case 'mathilda':
          return (
            <button onClick={onClick} className={mobileClasses}>
              {content}
            </button>
          )
        case 'signOut':
          return (
            <button onClick={handleSignOut} className={mobileClasses}>
              {content}
            </button>
          )
        case 'defenseReview':
          return (
            <AppLink href={ROUTES.ADMIN_DEFENSES} plain onClick={onClick} className={mobileClasses}>
              {content}
            </AppLink>
          )
        case 'profile':
          return (
            <AppLink
              href={ROUTES.PROFILE}
              plain
              onClick={disabled ? undefined : onClick}
              className={mobileClasses}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : undefined}
            >
              {content}
            </AppLink>
          )
        case 'organization':
          // Set in under the selections' heading, its tile starting inside the heading's
          return (
            <AppLink
              href={selectionHref(props.organization.slug)}
              plain
              onClick={onClick}
              className={cn(mobileClasses, 'pl-10')}
            >
              {content}
            </AppLink>
          )
        default:
          return assertNever(props)
      }
    default:
      return assertNever(variant)
  }
}
