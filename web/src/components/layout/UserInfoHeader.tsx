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
    avatar: { width: 44, height: 44, className: 'w-11 h-11' },
    displayName: 'text-sm',
    handle: 'text-xs',
  },
  md: {
    avatar: { width: 48, height: 48, className: 'w-12 h-12' },
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
        width={config.avatar.width}
        height={config.avatar.height}
        className={cn(config.avatar.className, avatarClassName)}
      />
      <div className="min-w-0">
        {user.firstName && (
          <p className={cn('font-semibold text-white truncate', config.displayName)}>
            {user.firstName}
          </p>
        )}
        {user.emailAddresses && user.emailAddresses.length > 0 && (
          <p
            className={cn('text-white/60 truncate', user.firstName ? 'mt-0.5' : '', config.handle)}
          >
            {user.emailAddresses[0].emailAddress}
          </p>
        )}
      </div>
    </div>
  )
}
