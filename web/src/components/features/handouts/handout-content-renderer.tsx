import { ImageOff } from 'lucide-react'
import React from 'react'

import type {
  HandoutImage,
  ListStyleType,
  RawContentBlock,
} from '@/components/features/handouts/handout-content-types'
import FootnoteRef from '@/components/math/FootnoteRef'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { parseDimensions } from '@/components/math/utils/dimension-parser'
import { AppLink } from '@/components/shared/components/AppLink'
import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { assertNever } from '@/components/shared/utils/assert-never'
import { getDocumentUrl, getProblemImageUrl } from '@/components/shared/utils/asset-urls'
import { cn } from '@/components/shared/utils/css-utils'

import { HIGHLIGHTED_PARAGRAPH_CLASSES } from './handout-colors'

/**
 * Maps a {@link ListStyleType} to the Tailwind class that drives the matching
 * counter style (decimal, parenthesised lower-roman, upper-alpha, ...).
 *
 * @param style The list style discriminator from the parsed content, or null/undefined.
 * @returns The className string to apply to the `<ul>`.
 */
function getListStyleClass(style: ListStyleType | null | undefined): string {
  switch (style) {
    case 'NumberDot':
      return 'list-decimal'
    case 'NumberParens':
      return 'list-style-number-parens'
    case 'LowerRomanParens':
      return 'list-style-lower-roman-parens'
    case 'UpperRoman':
      return 'list-[upper-roman]'
    case 'LowerAlphaParens':
      return 'list-style-lower-alpha-parens'
    case 'UpperAlphaParens':
      return 'list-[upper-alpha]'
    // A bullet list, and the fallback when no explicit style is set
    case 'Bullet':
    case null:
    case undefined:
      return 'list-disc'
    default:
      return assertNever(style)
  }
}

/**
 * Renders a single {@link RawContentBlock} into React nodes — covers every leaf
 * type (text, math, image, link, ...) as well as the recursive wrapper types
 * (paragraph, bold, italic, list, ...). Recurses through itself and through
 * {@link renderInlineContent} for list items.
 *
 * @param block The content block to render.
 * @param imagesById Lookup of image metadata keyed by content ID, used to resolve dimensions.
 * @param imageMissingText Fallback text shown when an image block references a missing asset.
 * @returns The rendered React node for the block.
 */
export function renderRawContentBlock(
  block: RawContentBlock,
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode {
  switch (block.type) {
    case 'text':
      // Replace a leading space with a non-breaking space so it survives the
      // whitespace collapsing that happens when text sits inside a flex parent.
      return <>{block.text.replace(/^ /, '\u00A0')}</>
    case 'bold':
      // Wrap each child in its own keyed span so the React keys stay stable
      // when the bolded run mixes text with other inline blocks.
      return (
        <strong>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageMissingText)}</span>
          ))}
        </strong>
      )
    case 'italic':
      // Same per-child keyed span treatment as bold above.
      return (
        <em>
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageMissingText)}</span>
          ))}
        </em>
      )
    case 'quote':
      // `<q>` provides locale-aware quotation marks; italics match our visual style.
      return (
        <q className="italic">
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageMissingText)}</span>
          ))}
        </q>
      )
    case 'link': {
      // Internal references are identifiers — expand them to an absolute API URL
      // so AppLink's own external-vs-internal detection picks the right element.
      const href = /^https?:\/\//i.test(block.url) ? block.url : getDocumentUrl(block.url)

      return (
        <AppLink
          href={href}
          className="text-link hover:text-link-hover underline transition-colors"
          newTab
        >
          {block.content.map((child, index) => (
            <span key={index}>{renderRawContentBlock(child, imagesById, imageMissingText)}</span>
          ))}
        </AppLink>
      )
    }
    case 'footnote': {
      // Wrap the footnote children as a synthetic paragraph so nested formatting
      // (bold, math, links, ...) routes through the standard renderer path.
      return (
        <FootnoteRef>
          {renderRawContentBlock(
            { type: 'paragraph', content: block.content, highligted: false },
            imagesById,
            imageMissingText
          )}
        </FootnoteRef>
      )
    }
    case 'math': {
      // Display math gets a block-level wrapper; inline math stays in flow.
      if (block.isDisplay) {
        return (
          <div className="math-display">
            <MathRendererClient content={`$$${block.text}$$`} />
          </div>
        )
      }
      return (
        <span className="math-inline">
          <MathRendererClient content={`$${block.text}$`} />
        </span>
      )
    }
    case 'list': {
      // Style class is computed up front; each `<li>` then just renders inline content.
      const listStyleClass = getListStyleClass(block.styleType)
      return (
        <ul className={cn('mb-4 pl-6 space-y-1 text-muted-foreground', listStyleClass)}>
          {block.items.map((listItem, listItemIndex) => (
            <li key={listItemIndex}>
              {renderInlineContent(listItem, imagesById, imageMissingText)}
            </li>
          ))}
        </ul>
      )
    }
    case 'paragraph': {
      // Walk the paragraph's children and group inline runs into `<p>` elements,
      // breaking out whenever a true block child (display math, list, nested
      // paragraph, block image) appears — those render bare, then the next `<p>`
      // resumes for whatever inline content follows.
      const paragraphParts: React.ReactNode[] = []
      let inlineRun: React.ReactNode[] = []

      // Flush the accumulated inline buffer as a single `<p>` and reset it.
      const flushInlineRun = () => {
        if (inlineRun.length > 0) {
          paragraphParts.push(
            <p
              key={`p-${paragraphParts.length}`}
              className="leading-relaxed mb-4 text-muted-foreground"
            >
              {inlineRun}
            </p>
          )
          inlineRun = []
        }
      }

      // Classify each child as block-level or inline and route accordingly.
      for (let childIndex = 0; childIndex < block.content.length; childIndex++) {
        const childBlock = block.content[childIndex]

        // Block content here means content that cannot legally sit inside a
        // `<p>`: display math gets centred on its own line, lists open a `<ul>`,
        // plain (non-highlighted) nested paragraphs already emit their own `<p>`,
        // and block-mode images are wrapped in a centring `<div>`. Inline math,
        // inline images and highlighted paragraphs all flow inside the current `<p>`.
        const isBlockContent =
          (childBlock.type === 'math' && childBlock.isDisplay) ||
          childBlock.type === 'list' ||
          (childBlock.type === 'paragraph' && !childBlock.highligted) ||
          (childBlock.type === 'image' && !childBlock.isInline)

        if (isBlockContent) {
          // Seal the current inline run as its own `<p>` first, then emit the
          // block child as a sibling `<div>` — keeping it outside the surrounding
          // `<p>` is what stops React from producing invalid HTML and bailing on hydration.
          flushInlineRun()
          paragraphParts.push(
            <div key={`b-${paragraphParts.length}`}>
              {renderRawContentBlock(childBlock, imagesById, imageMissingText)}
            </div>
          )
        } else {
          // Inline child — append to the buffer; it joins the next `<p>` the
          // moment we hit a block sibling or fall out of the loop.
          inlineRun.push(
            <React.Fragment key={childIndex}>
              {renderRawContentBlock(childBlock, imagesById, imageMissingText)}
            </React.Fragment>
          )
        }
      }

      // Flush whatever inline content remained after the loop.
      flushInlineRun()

      // Highlighted paragraphs get a gradient card surround; plain ones render bare.
      return block.highligted ? (
        <div
          className={cn(
            'relative my-6 rounded-lg border p-4 shadow-lg',
            HIGHLIGHTED_PARAGRAPH_CLASSES
          )}
        >
          <div className="relative">{paragraphParts}</div>
        </div>
      ) : (
        <>{paragraphParts}</>
      )
    }
    case 'image': {
      // Handouts have only image ids, resolve real url
      const imagePath = getProblemImageUrl(block.id, 'handouts')

      // Dimensions live in the side-channel map keyed by content ID; the block itself only carries the ID.
      const imageMeta = imagesById?.[block.id]

      // Missing metadata means the document references an image we never received;
      // surface a small inline placeholder instead of rendering a broken `<img>`.
      if (!imageMeta) {
        console.error(`Image metadata not found for image: ${imagePath}`)
        return (
          <span className="inline-flex items-center gap-1 text-muted text-sm">
            <ImageOff size={16} strokeWidth={1.5} />
            <span className="italic">{imageMissingText}</span>
          </span>
        )
      }

      // Parse the string dimensions into numeric pixels. Missing/malformed values
      // pass through as undefined and become 0 at the call site below, which puts
      // ImageWithLoader into fluid mode (renders at the image's intrinsic size).
      const { widthPx, heightPx } = parseDimensions(imageMeta.width, imageMeta.height)
      if (!widthPx || !heightPx) {
        console.error('Invalid dimensions for image:', {
          width: imageMeta.width,
          height: imageMeta.height,
        })
      }

      // Single ImageWithLoader call — its own `inline` mode handles the inline-flex
      // wrapper / alignment / valid-inside-`<p>` `<span>`; we just feed it the right
      // spinner size and white-card surround for the inline-vs-block case.
      const image = (
        <ImageWithLoader
          src={imagePath}
          alt=""
          width={widthPx ?? 0}
          height={heightPx ?? 0}
          scale={block.scale || 1}
          inline={block.isInline}
          spinnerSize={block.isInline ? 16 : 24}
          containerClassName={
            block.isInline ? 'bg-white rounded p-1 mx-[0.25em]' : 'bg-white rounded-lg p-1'
          }
        />
      )

      // Block images sit on their own line, centered; inline images flow with text.
      return block.isInline ? image : <div className="my-4 flex justify-center">{image}</div>
    }
    default:
      return assertNever(block)
  }
}

/**
 * Renders an array of {@link RawContentBlock}s as flat inline content — any
 * nested paragraph is unwrapped so the result never produces a block-level
 * `<p>`. Suitable for list items, badges, titles, and other inline-only slots.
 *
 * @param content The blocks to render inline.
 * @param imagesById Lookup of image metadata keyed by content ID.
 * @param imageMissingText Fallback text shown for missing images.
 * @returns The flattened inline React node.
 */
function renderInlineContent(
  content: RawContentBlock[],
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode {
  // Collects every walked block's rendered output as a flat sequence of nodes.
  const inlineNodes: React.ReactNode[] = []

  // Walk each top-level block; paragraph blocks get unwrapped so their children
  // are emitted directly without an enclosing `<p>`.
  for (let i = 0; i < content.length; i++) {
    const block = content[i]

    if (block.type === 'paragraph') {
      // Unwrap the paragraph — pushing its children one by one keeps the inline
      // context valid (a `<p>` would split whichever inline parent rendered us).
      for (let j = 0; j < block.content.length; j++) {
        const child = block.content[j]

        // Compound key on both indices so unwrapped children stay uniquely
        // identifiable across multiple sibling paragraphs in the same `content`.
        inlineNodes.push(
          <React.Fragment key={`p-${i}-${j}`}>
            {renderRawContentBlock(child, imagesById, imageMissingText)}
          </React.Fragment>
        )
      }
    } else {
      // Everything that isn't a paragraph (text, math, image, link, bold, ...)
      // is already inline-safe, so we pass it through unchanged.
      inlineNodes.push(
        <React.Fragment key={i}>
          {renderRawContentBlock(block, imagesById, imageMissingText)}
        </React.Fragment>
      )
    }
  }

  // Wrap the collection in a single Fragment so the caller always gets back
  // exactly one ReactNode regardless of how many blocks we walked.
  return <>{inlineNodes}</>
}

/**
 * Renders a sequence of {@link RawContentBlock}s, delegating each block to
 * {@link renderRawContentBlock}. Returns null when given null/undefined so
 * callers can pass optional content fields without guarding at every site.
 *
 * @param blocks The blocks to render, or null/undefined.
 * @param imagesById Lookup of image metadata keyed by content ID.
 * @param imageMissingText Fallback text shown for missing images.
 * @returns The rendered block sequence, or null when no blocks were provided.
 */
export function renderBlocks(
  blocks: RawContentBlock[] | null | undefined,
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode {
  if (!blocks) return null
  return (
    <>
      {blocks.map((block, index) => (
        <React.Fragment key={index}>
          {renderRawContentBlock(block, imagesById, imageMissingText)}
        </React.Fragment>
      ))}
    </>
  )
}
