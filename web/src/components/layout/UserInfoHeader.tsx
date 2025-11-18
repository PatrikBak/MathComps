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
    name: 'text-sm',
    email: 'text-xs',
  },
  md: {
    avatar: { width: 48, height: 48, className: 'w-12 h-12' },
    name: 'text-base',
    email: 'text-sm',
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
  // Figure out the display name
  const displayName = user.fullName || user.firstName || user.username || '???'

  // Get the size config
  const config = sizeConfig[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <UserAvatarImage
        imageUrl={user.imageUrl}
        altText={displayName}
        width={config.avatar.width}
        height={config.avatar.height}
        className={cn(config.avatar.className, avatarClassName)}
      />
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-white truncate', config.name)}>{displayName}</p>
        {user.primaryEmailAddress?.emailAddress && (
          <p className={cn('text-white/50 truncate mt-0.5', config.email)}>
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
      </div>
    </div>
  )
}
