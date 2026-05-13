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
  /**
   * Width in pixels — used for reserving space. Pass 0 to render in fluid mode
   * (no reserved space, image sized at runtime by its intrinsic dimensions).
   */
  width: number
  /**
   * Height in pixels — used for reserving space. Pass 0 to render in fluid mode
   * (no reserved space, image sized at runtime by its intrinsic dimensions).
   */
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
  /**
   * If true, the container renders as inline-flex with vertical-align: middle
   * and zero line-height so the image can flow inside a line of text.
   */
  inline?: boolean
}

/**
 * A Next.js Image wrapper that shows a loading spinner until the image loads.
 * Reserves exact dimensions to prevent layout shifts when width and height
 * are provided; with width=0 / height=0 the image renders fluidly at its
 * intrinsic size (max-width capped to the parent) and no spinner is shown.
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
  inline = false,
}: ImageWithLoaderProps) {
  // Track image load state
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')

  // Whether the caller passed concrete dimensions. Zero is the documented
  // sentinel for fluid mode — render at intrinsic size, no layout reservation
  const hasIntrinsicSize = width > 0 && height > 0

  // Compute scaled dimensions (only meaningful when we reserve layout)
  const scaledWidth = hasIntrinsicSize ? width * scale : undefined
  const scaledHeight = hasIntrinsicSize ? height * scale : undefined

  // Inline mode flows inside text with vertical-align: middle and zero leading;
  // block mode is the default centred-flex layout. box-content keeps caller-set
  // padding outside the reserved width/height so the image's content area
  // matches the dimensions the caller asked for. Fluid mode skips the reserved
  // box entirely and just lets the wrapper shrink-wrap the image
  const baseContainerClass = hasIntrinsicSize
    ? inline
      ? 'relative inline-flex items-center justify-center align-middle box-content'
      : 'relative flex items-center justify-center box-content'
    : inline
      ? 'inline-flex align-middle'
      : 'mx-auto w-fit overflow-hidden rounded-md'

  // Inline wrappers must be span-typed so the markup stays valid when the
  // component is dropped inside a <p> — a div there triggers the parser's
  // auto-close and visibly breaks the surrounding text
  const Wrapper = inline ? 'span' : 'div'

  // Block mode uses width: 100% + max-width + aspect-ratio so the wrapper
  // shrinks proportionally in both axes when its parent is narrower than the
  // declared width — fixing width + height alone leaves flex-shrink trimming
  // the width while the height stays locked, opening asymmetric whitespace
  // when the image hits Tailwind preflight's max-width: 100% / height: auto.
  // Inline mode keeps explicit dimensions because the wrapper sits inside a
  // line of text and we want exact reserved space, not responsive scaling.
  const sizeStyle =
    hasIntrinsicSize &&
    (inline
      ? { width: scaledWidth, height: scaledHeight }
      : {
          width: '100%',
          maxWidth: scaledWidth,
          aspectRatio: `${scaledWidth} / ${scaledHeight}`,
        })

  return (
    <Wrapper
      className={cn(baseContainerClass, containerClassName)}
      style={{
        ...sizeStyle,
        // Collapse the inherited text line-height so the inline wrapper hugs
        // the image vertically — otherwise inherited leading adds space above
        ...(inline && { lineHeight: 0 }),
      }}
    >
      {/* Loading spinner — only meaningful when there's a reserved box to centre it in */}
      {hasIntrinsicSize && loadState === 'loading' && (
        <Wrapper className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted animate-spin" size={spinnerSize} strokeWidth={2} />
        </Wrapper>
      )}

      {/* Error state — same caveat as the spinner */}
      {hasIntrinsicSize && loadState === 'error' && (
        <Wrapper className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="text-muted" size={spinnerSize} strokeWidth={1.5} />
        </Wrapper>
      )}

      {/* The actual image — fluid mode runs unoptimized through next/image
          with width/height=0 so it sizes from the source */}
      <Image
        src={src}
        alt={alt}
        width={hasIntrinsicSize ? width : 0}
        height={hasIntrinsicSize ? height : 0}
        sizes={hasIntrinsicSize ? undefined : '100vw'}
        unoptimized={!hasIntrinsicSize}
        priority={priority}
        className={cn(
          'transition-opacity duration-200 ease-in-out',
          hasIntrinsicSize && loadState !== 'loaded' && 'opacity-0',
          !hasIntrinsicSize &&
            (inline
              ? 'inline-block max-w-full h-auto object-contain'
              : 'block max-w-full h-auto object-contain'),
          className
        )}
        style={{
          width: 'auto',
          height: 'auto',
          ...(scale !== 1 && { zoom: scale }),
        }}
        onLoad={() => setLoadState('loaded')}
        onError={() => setLoadState('error')}
      />
    </Wrapper>
  )
}
