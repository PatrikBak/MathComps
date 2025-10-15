import { ImageOff, Loader2 } from 'lucide-react'
import Image from 'next/image'
import React, { useState } from 'react'

import type {
  ListStyleType,
  RawContentBlock,
} from '@/components/features/handouts/types/handout-types'
import { getProblemImageUrl } from '@/components/features/problems/utils/url-utils'
import FootnoteRef from '@/components/math/FootnoteRef'
import { parseDimensions } from '@/components/math/utils/dimension-parser'
import { cn } from '@/components/shared/utils/css-utils'

import type { ProblemImage } from '../features/problems/types/problem-api-types'
import { MathRendererClient } from './MathRendererClient'

type ContentRendererProps = {
  content: RawContentBlock[]
  className?: string
  imagesById?: Record<string, ProblemImage>
}

function InlineText({ text }: { text: string }) {
  // Using a non-breaking space for the leading space to prevent it from
  // being collapsed when rendered inside a flex container.
  return <>{text.replace(/^ /, '\u00A0')}</>
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
  const { widthPx, heightPx } = parseDimensions(width, height)
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
        width: widthPx,
        height: heightPx,
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
        width: widthPx,
        height: heightPx,
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
          zoom: scale,
          display: 'inline-flex',
          verticalAlign: 'middle',
          margin: '0 0.25em',
          lineHeight: 0,
          width: widthPx,
          height: heightPx,
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
          width: widthPx,
          height: heightPx,
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

export function renderRawContentBlock(
  block: RawContentBlock,
  imagesById?: Record<string, ProblemImage>
): React.ReactNode {
  switch (block.type) {
    case 'text':
      // Inline text with math
      return <InlineText text={block.text} />
    case 'bold':
      return (
        <strong>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById)}</span>
          ))}
        </strong>
      )
    case 'italic':
      return (
        <em>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById)}</span>
          ))}
        </em>
      )
    case 'quote':
      return (
        <q className="italic">
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById)}</span>
          ))}
        </q>
      )
    case 'footnote': {
      return (
        <FootnoteRef>
          {renderRawContentBlock(
            { type: 'paragraph', content: block.content } as RawContentBlock,
            imagesById
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
          <span className="math-inline" style={{ display: 'inline', whiteSpace: 'nowrap' }}>
            <MathRendererClient content={`$${mathBody}$`} />
          </span>
        )
      }
    }
    case 'list': {
      const listStyle = getOrderedListStyleClass({ style: block.styleType })
      const renderListItem = (listItem: RawContentBlock[]) => {
        return renderInlineContent(listItem, imagesById)
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
          childBlock.type === 'paragraph' ||
          (childBlock.type === 'image' && !(childBlock as { isInline?: boolean }).isInline)
        if (isBlockContent) {
          flushInlineRun()
          paragraphParts.push(
            <div key={`b-${paragraphParts.length}`}>
              {renderRawContentBlock(childBlock, imagesById)}
            </div>
          )
        } else {
          inlineRun.push(
            <React.Fragment key={childIndex}>
              {renderRawContentBlock(childBlock, imagesById)}
            </React.Fragment>
          )
        }
      }
      flushInlineRun()
      return <>{paragraphParts}</>
    }
    case 'image': {
      const imagePath = getProblemImageUrl(block.id)
      const scale = block.scale || 1
      const isInline = block.isInline
      const meta = imagesById?.[block.id]

      if (isInline) {
        return (
          <ImageWithPlaceholder
            src={imagePath}
            alt=""
            width={meta?.width}
            height={meta?.height}
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
            width={meta?.width}
            height={meta?.height}
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
  imagesById?: Record<string, ProblemImage>
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
            {renderRawContentBlock(child, imagesById)}
          </React.Fragment>
        )
      }
    } else {
      inlineNodes.push(
        <React.Fragment key={i}>{renderRawContentBlock(block, imagesById)}</React.Fragment>
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
  imagesById?: Record<string, ProblemImage>
): React.ReactNode {
  if (!blocks) {
    return null
  }
  return (
    <>
      {blocks.map((block, index) => (
        <React.Fragment key={index}>{renderRawContentBlock(block, imagesById)}</React.Fragment>
      ))}
    </>
  )
}

export function ContentRenderer({ content, className, imagesById }: ContentRendererProps) {
  return (
    <div className={cn('content-renderer', className)}>{renderBlocks(content, imagesById)}</div>
  )
}
