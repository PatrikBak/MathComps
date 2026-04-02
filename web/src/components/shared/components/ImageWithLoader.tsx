'use client'

import { ImageOff, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ImageWithLoader} component.
 */
type ImageWithLoaderProps = {
  /** Image source URL */
  src: string
  /** Alt text for accessibility */
  alt: string
  /** Width in pixels - used for reserving space */
  width: number
  /** Height in pixels - used for reserving space */
  height: number
  /** Additional class names for the image */
  className?: string
  /** Additional class names for the container */
  containerClassName?: string
  /** If true, the image is loaded with priority (LCP optimization) */
  priority?: boolean
  /** Scale factor for the image (uses CSS zoom) */
  scale?: number
  /** Size of the spinner icon in pixels */
  spinnerSize?: number
}

/**
 * A Next.js Image wrapper that shows a loading spinner until the image loads.
 * Reserves exact dimensions to prevent layout shifts.
 */
export function ImageWithLoader({
  src,
  alt,
  width,
  height,
  className,
  containerClassName,
  priority = false,
  scale = 1,
  spinnerSize = 24,
}: ImageWithLoaderProps) {
  // Track image load state
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')

  // Compute scaled dimensions
  const scaledWidth = width * scale
  const scaledHeight = height * scale

  return (
    <div
      className={cn('relative flex items-center justify-center', containerClassName)}
      style={{
        width: scaledWidth,
        height: scaledHeight,
      }}
    >
      {/* Loading spinner - shown while image is loading */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted animate-spin" size={spinnerSize} strokeWidth={2} />
        </div>
      )}

      {/* Error state - shown if image fails to load */}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="text-muted" size={spinnerSize} strokeWidth={1.5} />
        </div>
      )}

      {/* The actual image - hidden until loaded for smooth fade-in */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn(
          'transition-opacity duration-200 ease-in-out',
          loadState !== 'loaded' && 'opacity-0',
          className
        )}
        style={scale !== 1 ? { zoom: scale } : undefined}
        onLoad={() => setLoadState('loaded')}
        onError={() => setLoadState('error')}
      />
    </div>
  )
}
