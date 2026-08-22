import type { UserResource } from '@clerk/types'
import { useTranslations } from 'next-intl'

import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'
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
    username: 'text-sm',
    handle: 'text-xs',
  },
  md: {
    avatarSize: 48,
    username: 'text-base',
    handle: 'text-sm',
  },
} as const

/**
 * Displays user information including avatar, username, and email address.
 * Used in dropdown menus and navigation drawers to show the current user's details.
 *
 * The username and email both come from the site's own profile read, so the block is bare until that read
 * lands, and shows the email alone for somebody who has yet to choose a name.
 */
export const UserInfoHeader = ({
  user,
  className,
  avatarClassName,
  size = 'sm',
}: UserInfoHeaderProps) => {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The name and address the site holds them under
  const { username, email } = useUserProfile()

  // Get the size config
  const config = sizeConfig[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <UserAvatarImage
        imageUrl={user.imageUrl}
        altText={username ?? tProfile('defaultUser')}
        size={config.avatarSize}
        className={avatarClassName}
      />
      <div className="min-w-0">
        {username !== null && (
          <p className={cn('font-semibold text-foreground truncate', config.username)}>
            {username}
          </p>
        )}
        {email !== null && (
          <p
            className={cn(
              'text-popover-foreground/60 truncate',
              username !== null ? 'mt-0.5' : '',
              config.handle
            )}
          >
            {email}
          </p>
        )}
      </div>
    </div>
  )
}
