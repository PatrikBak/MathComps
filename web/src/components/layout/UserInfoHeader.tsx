import type { UserResource } from '@clerk/types'

import { cn } from '@/components/shared/utils/css-utils'

import { UserAvatarImage } from './UserAvatarImage'

/**
 * Props for the {@link UserInfoHeader} component.
 */
type UserInfoHeaderProps = {
  /** The Clerk user object containing user information */
  user: UserResource
  /** Optional CSS class applied to the container div */
  className?: string
  /** Optional CSS class applied to the avatar image */
  avatarClassName?: string
  /**
   * Size variant for the avatar and text. @default 'sm'
   */
  size: 'sm' | 'md'
}

/**
 * Size configuration mapping for avatar and text sizing.
 */
const sizeConfig = {
  sm: {
    avatarSize: 44,
    displayName: 'text-sm',
    handle: 'text-xs',
  },
  md: {
    avatarSize: 48,
    displayName: 'text-base',
    handle: 'text-sm',
  },
} as const

/**
 * Displays user information including avatar, name, and email address.
 * Used in dropdown menus and navigation drawers to show the current user's details.
 */
export const UserInfoHeader = ({
  user,
  className,
  avatarClassName,
  size = 'sm',
}: UserInfoHeaderProps) => {
  // Get the size config
  const config = sizeConfig[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <UserAvatarImage
        imageUrl={user.imageUrl}
        altText={user.firstName || 'Používateľ'}
        size={config.avatarSize}
        className={avatarClassName}
      />
      <div className="min-w-0">
        {user.firstName && (
          <p className={cn('font-semibold text-foreground truncate', config.displayName)}>
            {user.firstName}
          </p>
        )}
        {user.emailAddresses && user.emailAddresses.length > 0 && (
          <p
            className={cn(
              'text-popover-foreground/60 truncate',
              user.firstName ? 'mt-0.5' : '',
              config.handle
            )}
          >
            {user.emailAddresses[0].emailAddress}
          </p>
        )}
      </div>
    </div>
  )
}
