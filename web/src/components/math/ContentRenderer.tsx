import { ImageOff, Loader2 } from 'lucide-react'
import Image from 'next/image'
import React, { useState } from 'react'

import type {
  ListStyleType,
  RawContentBlock,
} from '@/components/features/handouts/types/handout-types'
import { getDocumentUrl, getProblemImageUrl } from '@/components/features/problems/utils/url-utils'
import FootnoteRef from '@/components/math/FootnoteRef'
import { parseDimensions } from '@/components/math/utils/dimension-parser'
import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

import type { ProblemImage } from '../features/problems/types/problem-api-types'
import type { ImageType } from '../features/problems/utils/url-utils'
import { MathRendererClient } from './MathRendererClient'

type ContentRendererProps = {
  content: RawContentBlock[]
  imagesById: Record<string, ProblemImage>
  imageType: ImageType
  className?: string
}

function ImageWithPlaceholder({
  src,
  alt,
  width,
  height,
  className,
  isInline,
  scale,
}: {
  src: string
  alt: string
  width?: string
  height?: string
  className: string
  isInline: boolean
  scale: number
}) {
  // Parse dimensions
  let { widthPx, heightPx } = parseDimensions(width, height)

  // Ensure parsing dimensions was successful
  if (!widthPx || !heightPx) {
    console.error('Invalid dimensions for image:', { width, height })

    // Fallback to default dimensions
    widthPx = 200
    heightPx = 200
  }

  // Track image load state
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')

  // Handle successful image load - Next.js Image component uses onLoad
  const handleLoad = () => {
    setLoadState('loaded')
  }

  // Handle image load errors - show error icon instead of infinite spinner
  const handleError = () => {
    setLoadState('error')
  }

  // Spinner placeholder with exact image dimensions to prevent layout shift
  const LoadingPlaceholder = () => (
    <div
      className="flex items-center justify-center absolute inset-0"
      style={{
        width: widthPx * scale,
        height: heightPx * scale,
      }}
    >
      <Loader2 className="text-gray-400 animate-spin" size={isInline ? 16 : 24} strokeWidth={2} />
    </div>
  )

  // Error state with icon, no borders
  const ErrorPlaceholder = () => (
    <div
      className="flex items-center justify-center absolute inset-0"
      style={{
        width: widthPx * scale,
        height: heightPx * scale,
      }}
    >
      <ImageOff className="text-gray-500" size={isInline ? 16 : 24} strokeWidth={1.5} />
    </div>
  )

  if (isInline) {
    return (
      <span
        className="inline-flex items-center justify-center align-middle relative bg-white rounded p-1"
        style={{
          display: 'inline-flex',
          verticalAlign: 'middle',
          margin: '0 0.25em',
          lineHeight: 0,
          width: widthPx * scale,
          height: heightPx * scale,
        }}
      >
        {loadState === 'loading' && <LoadingPlaceholder />}
        {loadState === 'error' && <ErrorPlaceholder />}
        <Image
          src={src}
          alt={alt}
          width={widthPx}
          height={heightPx}
          className={cn(className, loadState !== 'loaded' && 'opacity-0')}
          style={{
            verticalAlign: 'middle',
            zoom: scale,
            transition: 'opacity 0.2s ease-in-out',
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      </span>
    )
  }

  return (
    <div className="my-4 flex justify-center">
      <div
        className="flex items-center justify-center relative bg-white rounded-lg p-1"
        style={{
          width: widthPx * scale,
          height: heightPx * scale,
        }}
      >
        {loadState === 'loading' && <LoadingPlaceholder />}
        {loadState === 'error' && <ErrorPlaceholder />}
        <Image
          src={src}
          alt={alt}
          width={widthPx}
          height={heightPx}
          className={cn(className, loadState !== 'loaded' && 'opacity-0')}
          style={{
            zoom: scale,
            transition: 'opacity 0.2s ease-in-out',
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  )
}

function getOrderedListStyleClass({ style }: { style?: ListStyleType | null }) {
  switch (style) {
    case 'NumberDot':
      return { className: 'list-decimal' } as const
    case 'NumberParens':
      return { className: 'marker-decimal-paren' } as const
    case 'LowerRomanParens':
      return { className: 'marker-roman-paren' } as const
    case 'UpperRoman':
      return { className: 'list-[upper-roman]' } as const
    case 'LowerAlphaParens':
      return { className: 'marker-alpha-paren' } as const
    case 'UpperAlphaParens':
      return { className: 'list-[upper-alpha]' } as const
    case 'Bullet':
    default:
      return { className: 'list-disc' } as const
  }
}

/**
 * Renders a raw content block (a parsed block which can contain text, math, lists, etc.).
 *
 * @param block - The raw content block to render
 * @param imagesById - Optional mapping of image IDs to ProblemImage objects
 * @param imageType - Optional type of the image (problems or handouts)
 * @returns The rendered content block
 */
export function renderRawContentBlock(
  block: RawContentBlock,
  imagesById: Record<string, ProblemImage>,
  imageType: ImageType
): React.ReactNode {
  switch (block.type) {
    case 'text':
      // Inline text
      // Using a non-breaking space for the leading space to prevent it from
      // being collapsed when rendered inside a flex container.
      return <>{block.text.replace(/^ /, '\u00A0')}</>
    case 'bold':
      return (
        <strong>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageType)}</span>
          ))}
        </strong>
      )
    case 'italic':
      return (
        <em>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageType)}</span>
          ))}
        </em>
      )
    case 'quote':
      return (
        <q className="italic">
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageType)}</span>
          ))}
        </q>
      )
    case 'link': {
      // Detect if the URL is an external URL or a file path
      const isExternalUrl = /^https?:\/\//i.test(block.url)
      const href = isExternalUrl ? block.url : getDocumentUrl(block.url)

      return (
        <AppLink
          href={href}
          className="text-blue-400 hover:text-blue-300 underline transition-colors"
          external={isExternalUrl}
          newTab
        >
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageType)}</span>
          ))}
        </AppLink>
      )
    }
    case 'footnote': {
      return (
        <FootnoteRef>
          {renderRawContentBlock(
            { type: 'paragraph', content: block.content } as RawContentBlock,
            imagesById,
            imageType
          )}
        </FootnoteRef>
      )
    }
    case 'math': {
      const mathBody = block.text

      if (block.isDisplay) {
        return (
          <div className="math-display">
            <MathRendererClient content={`$$${mathBody}$$`} />
          </div>
        )
      } else {
        return (
          <span className="math-inline">
            <MathRendererClient content={`$${mathBody}$`} />
          </span>
        )
      }
    }
    case 'list': {
      const listStyle = getOrderedListStyleClass({ style: block.styleType })
      const renderListItem = (listItem: RawContentBlock[]) => {
        return renderInlineContent(listItem, imagesById, imageType)
      }
      return (
        <ul className={cn('mb-4 pl-6 space-y-1 text-gray-300', listStyle.className)}>
          {block.items.map((listItem, listItemIndex) => (
            <li key={listItemIndex}>{renderListItem(listItem)}</li>
          ))}
        </ul>
      )
    }
    case 'paragraph': {
      const paragraphParts: React.ReactNode[] = []
      let inlineRun: React.ReactNode[] = []
      const flushInlineRun = () => {
        if (inlineRun.length > 0) {
          paragraphParts.push(
            <p key={`p-${paragraphParts.length}`} className="leading-relaxed mb-4 text-gray-300">
              {inlineRun}
            </p>
          )
          inlineRun = []
        }
      }
      for (let childIndex = 0; childIndex < block.content.length; childIndex++) {
        const childBlock = block.content[childIndex]
        const isBlockContent =
          (childBlock.type === 'math' && childBlock.isDisplay) ||
          childBlock.type === 'list' ||
          (childBlock.type === 'paragraph' && !childBlock.highligted) ||
          (childBlock.type === 'image' && !(childBlock as { isInline?: boolean }).isInline)
        if (isBlockContent) {
          flushInlineRun()
          paragraphParts.push(
            <div key={`b-${paragraphParts.length}`}>
              {renderRawContentBlock(childBlock, imagesById, imageType)}
            </div>
          )
        } else {
          inlineRun.push(
            <React.Fragment key={childIndex}>
              {renderRawContentBlock(childBlock, imagesById, imageType)}
            </React.Fragment>
          )
        }
      }
      flushInlineRun()
      return block.highligted ? (
        <div className="relative my-6 rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10 p-4 shadow-lg">
          <div className="relative">{<>{paragraphParts}</>}</div>
        </div>
      ) : (
        <>{paragraphParts}</>
      )
    }
    case 'image': {
      const imagePath = getProblemImageUrl(block.id, imageType)
      const scale = block.scale || 1
      const isInline = block.isInline
      const meta = imagesById?.[block.id]

      if (!meta) {
        // Log
        console.error(`Image metadata not found for image: ${imagePath}`)

        // Image metadata not found - render error placeholder
        return (
          <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
            <ImageOff size={16} strokeWidth={1.5} />
            <span className="italic">Obrázok sa stratil</span>
          </span>
        )
      }

      if (isInline) {
        return (
          <ImageWithPlaceholder
            src={imagePath}
            alt=""
            width={meta.width}
            height={meta.height}
            className="inline-block align-middle"
            isInline={isInline}
            scale={scale}
          />
        )
      } else {
        return (
          <ImageWithPlaceholder
            src={imagePath}
            alt=""
            width={meta.width}
            height={meta.height}
            className="block"
            isInline={isInline}
            scale={scale}
          />
        )
      }
    }
    default:
      return null
  }
}

/**
 * Renders an array of RawContentBlock elements into a React node, ensuring that
 * no block-level elements like <p> are created. This is suitable for rendering
 * content inside elements that expect inline content, such as badges or titles.
 */
export function renderInlineContent(
  content: RawContentBlock[],
  imagesById: Record<string, ProblemImage>,
  imageType: ImageType
): React.ReactNode {
  const inlineNodes: React.ReactNode[] = []

  for (let i = 0; i < content.length; i++) {
    const block = content[i]
    if (block.type === 'paragraph') {
      // Flatten paragraph contents to avoid inserting <p> or wrappers
      for (let j = 0; j < block.content.length; j++) {
        const child = block.content[j]
        inlineNodes.push(
          <React.Fragment key={`p-${i}-${j}`}>
            {renderRawContentBlock(child, imagesById, imageType)}
          </React.Fragment>
        )
      }
    } else {
      inlineNodes.push(
        <React.Fragment key={i}>
          {renderRawContentBlock(block, imagesById, imageType)}
        </React.Fragment>
      )
    }
  }

  return <>{inlineNodes}</>
}

/**
 * Renders an array of RawContentBlock elements into a React node.
 * This function iterates through a list of content blocks and renders them sequentially.
 */
export function renderBlocks(
  blocks: RawContentBlock[] | null | undefined,
  imagesById: Record<string, ProblemImage>,
  imageType: ImageType
): React.ReactNode {
  if (!blocks) {
    return null
  }
  return (
    <>
      {blocks.map((block, index) => (
        <React.Fragment key={index}>
          {renderRawContentBlock(block, imagesById, imageType)}
        </React.Fragment>
      ))}
    </>
  )
}

export function ContentRenderer({
  content,
  className,
  imagesById,
  imageType,
}: ContentRendererProps) {
  return (
    <div className={cn('content-renderer', className)}>
      {renderBlocks(content, imagesById, imageType)}
    </div>
  )
}
