import Image from 'next/image'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link UserAvatarImage} component.
 */
type UserAvatarImageProps = {
  /**
   * Primary image provided by Clerk for {@link UserAvatarImage}.
   * Falls back to the brand avatar when undefined or when requests fail.
   */
  imageUrl?: string | null
  /** Textual description surfaced to assistive technologies */
  altText: string
  /**
   * Size of the avatar in pixels. This value is used for both the Next.js Image
   * intrinsic dimensions (for optimization) and the rendered CSS size.
   */
  size: number
  /**
   * Optional utility classes appended after the base avatar styles.
   * Use this for additional styling like margins, but NOT for sizing
   * (use the `size` prop instead).
   */
  className?: string
}

/**
 * Shared avatar renderer that wraps the Next image component and
 * infuses our fallback behavior.
 */
export const UserAvatarImage = ({ imageUrl, altText, size, className }: UserAvatarImageProps) => {
  // A random AI-generated SVG as fallback
  const defaultAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%238b5cf6'/%3E%3Cpath d='M50 45c7.5 0 13.64-6.14 13.64-13.64S57.5 17.72 50 17.72s-13.64 6.14-13.64 13.64S42.5 45 50 45zm0 6.82c-9.09 0-27.28 4.56-27.28 13.64v3.41c0 1.88 1.53 3.41 3.41 3.41h47.74c1.88 0 3.41-1.53 3.41-3.41v-3.41c0-9.08-18.19-13.64-27.28-13.64z' fill='%23fff'/%3E%3C/svg%3E`

  return (
    <Image
      src={imageUrl || defaultAvatar}
      alt={altText}
      width={size}
      height={size}
      className={cn('rounded-full ring-2 ring-white/20 object-cover flex-none', className)}
      style={{ width: size, height: size }}
      onError={(event) => {
        // Ensure future renders use the fallback when the original image fails
        event.currentTarget.src = defaultAvatar
      }}
      unoptimized
    />
  )
}
