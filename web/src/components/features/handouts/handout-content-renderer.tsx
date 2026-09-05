import { ImageOff } from 'lucide-react'
import React from 'react'

import type {
  HandoutImage,
  ListStyleType,
  MathBlock,
  RawContentBlock,
} from '@/components/features/handouts/handout-content-types'
import FootnoteRef from '@/components/math/FootnoteRef'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { parseDimensions } from '@/components/math/utils/dimension-parser'
import type { MathGlueReader, MathGlueResult } from '@/components/math/utils/math-nowrap'
import { MATH_NOWRAP_CLASS, planMathGlue } from '@/components/math/utils/math-nowrap'
import { AppLink } from '@/components/shared/components/AppLink'
import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { assertNever } from '@/components/shared/utils/assert-never'
import { getDocumentUrl, getProblemImageUrl } from '@/components/shared/utils/asset-urls'
import { cn } from '@/components/shared/utils/css-utils'

import { HIGHLIGHTED_PARAGRAPH_CLASSES } from './handout-colors'

/** One handout block, with whatever punctuation an inline formula claimed from it. */
type GluedContentBlock = MathGlueResult<RawContentBlock, MathBlock, GlueWrapperBlock>

/** A block whose markup only wraps the content it holds. */
type WrapperBlock = Extract<RawContentBlock, { type: 'bold' | 'italic' | 'quote' | 'link' }>

/** A {@link WrapperBlock} a formula inside it may take punctuation in through. */
type GlueWrapperBlock = Extract<WrapperBlock, { type: 'bold' | 'italic' }>

/**
 * Which blocks {@link MathGlueReader.isWrapper} holds for, in the handout AST's vocabulary. A quote
 * writes quotation marks around its content, a link underlines it, and a footnote opens it in a
 * popover, so each of those moves where the punctuation renders.
 */
const IS_GLUE_WRAPPER = {
  bold: true,
  italic: true,
  quote: false,
  link: false,
  footnote: false,
  paragraph: false,
  list: false,
  math: false,
  image: false,
  text: false,
} as const satisfies Record<RawContentBlock['type'], boolean>

/**
 * Whether a formula inside a block may take punctuation written outside it in through its markup.
 *
 * @param block The block to classify.
 * @returns True when punctuation moved inside the block still renders where it was written.
 */
function isGlueWrapper(block: RawContentBlock): block is GlueWrapperBlock {
  // The table above answers for every block type there is
  return IS_GLUE_WRAPPER[block.type]
}

/** Answers the glue pass's questions about a handout's blocks. */
const HANDOUT_GLUE_READER: MathGlueReader<RawContentBlock, MathBlock, GlueWrapperBlock> = {
  isInlineMath: (block): block is MathBlock => block.type === 'math' && !block.isDisplay,
  readText: (block) => (block.type === 'text' ? block.text : null),
  isWrapper: isGlueWrapper,
  readChildren: (wrapper) => wrapper.content,
}

/**
 * Renders a {@link WrapperBlock}'s own markup around content already rendered.
 *
 * @param block The wrapping block whose markup to emit.
 * @param children The rendered content to put inside it.
 * @returns The rendered React node for the block.
 */
function renderWrapperBlock(block: WrapperBlock, children: React.ReactNode): React.ReactNode {
  switch (block.type) {
    // Bold and italic are the plain phrasing elements
    case 'bold':
      return <strong>{children}</strong>
    case 'italic':
      return <em>{children}</em>
    // `<q>` provides locale-aware quotation marks; italics match our visual style.
    case 'quote':
      return <q className="italic">{children}</q>
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
          {children}
        </AppLink>
      )
    }
    default:
      return assertNever(block)
  }
}

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
    // Prose renders verbatim; the surrounding markup owns its whitespace
    case 'text':
      return <>{block.text}</>
    // A wrapping block renders its own markup around its rendered content
    case 'bold':
    case 'italic':
    case 'quote':
    case 'link':
      return renderWrapperBlock(block, renderSequence(block.content, imagesById, imageMissingText))
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

      // Each inline formula arrives already fused with the punctuation hugging it.
      const inlineItems = planMathGlue(block.content, HANDOUT_GLUE_READER)

      // Classify each item as block-level or inline and route accordingly.
      for (let itemIndex = 0; itemIndex < inlineItems.length; itemIndex++) {
        const item = inlineItems[itemIndex]

        // Block content here means content that cannot legally sit inside a
        // `<p>`: display math gets centred on its own line, lists open a `<ul>`,
        // plain (non-highlighted) nested paragraphs already emit their own `<p>`,
        // and block-mode images are wrapped in a centring `<div>`. Inline math,
        // inline images and highlighted paragraphs all flow inside the current `<p>`.
        // A glued formula is inline by construction, and so is trimmed prose, so
        // only an untouched block can be block-level.
        const isBlockContent =
          item.kind === 'unchanged' &&
          ((item.node.type === 'math' && item.node.isDisplay) ||
            item.node.type === 'list' ||
            (item.node.type === 'paragraph' && !item.node.highligted) ||
            (item.node.type === 'image' && !item.node.isInline))

        if (isBlockContent) {
          // Seal the current inline run as its own `<p>` first, then emit the
          // block child as a sibling `<div>` — keeping it outside the surrounding
          // `<p>` is what stops React from producing invalid HTML and bailing on hydration.
          flushInlineRun()
          paragraphParts.push(
            <div key={`b-${paragraphParts.length}`}>
              {renderGluedItem(item, imagesById, imageMissingText)}
            </div>
          )
        } else {
          // Inline child — append to the buffer; it joins the next `<p>` the
          // moment we hit a block sibling or fall out of the loop.
          inlineRun.push(
            <React.Fragment key={itemIndex}>
              {renderGluedItem(item, imagesById, imageMissingText)}
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
 * Renders one {@link GluedContentBlock}. A formula and its punctuation share a
 * nowrap wrapper so neither orphans onto a line of its own; everything else
 * falls straight through to {@link renderRawContentBlock}.
 *
 * @param item The block to render, with whatever the glue pass made of it.
 * @param imagesById Lookup of image metadata keyed by content ID.
 * @param imageMissingText Fallback text shown for missing images.
 * @returns The rendered React node for the block.
 */
function renderGluedItem(
  item: GluedContentBlock,
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode {
  switch (item.kind) {
    // An untouched block renders exactly as it always did
    case 'unchanged':
      return renderRawContentBlock(item.node, imagesById, imageMissingText)
    // Prose renders as whatever a neighbouring formula left of it
    case 'trimmed':
      return <>{item.text}</>
    // A walked run keeps its own markup and takes back the children the pass planned
    case 'wrapper':
      return renderWrapperBlock(
        item.node,
        renderPlanned(item.children, imagesById, imageMissingText)
      )
    // The formula and its hugging punctuation become one unbreakable run
    case 'glued':
      return (
        <span className={MATH_NOWRAP_CLASS}>
          {item.glue.leading}
          {renderRawContentBlock(item.math, imagesById, imageMissingText)}
          {item.glue.trailing}
        </span>
      )
    default:
      return assertNever(item)
  }
}

/**
 * Renders a content sequence, fusing each inline formula with the punctuation
 * hugging it before handing the pieces to {@link renderGluedItem}.
 *
 * @param blocks The blocks to render in order.
 * @param imagesById Lookup of image metadata keyed by content ID.
 * @param imageMissingText Fallback text shown for missing images.
 * @returns One keyed node per rendered item.
 */
function renderSequence(
  blocks: RawContentBlock[],
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode[] {
  // Plan what every formula in the sequence holds on to, then render the plan
  return renderPlanned(planMathGlue(blocks, HANDOUT_GLUE_READER), imagesById, imageMissingText)
}

/**
 * Renders an already-planned content sequence.
 *
 * @param items The planned blocks to render in order.
 * @param imagesById Lookup of image metadata keyed by content ID.
 * @param imageMissingText Fallback text shown for missing images.
 * @returns One keyed node per rendered item.
 */
function renderPlanned(
  items: GluedContentBlock[],
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode[] {
  // A fragment per item, keyed by the position its block held
  return items.map((item, index) => (
    <React.Fragment key={index}>
      {renderGluedItem(item, imagesById, imageMissingText)}
    </React.Fragment>
  ))
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
  // Splice each paragraph's children in directly — an enclosing `<p>` would split
  // whichever inline parent rendered us.
  const inlineBlocks = content.flatMap((block) =>
    block.type === 'paragraph' ? block.content : [block]
  )

  // One fragment, so the caller always gets back exactly one node
  return <>{renderSequence(inlineBlocks, imagesById, imageMissingText)}</>
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
  // Optional content fields arrive absent, and render as nothing
  if (!blocks) return null

  // One fragment, so the caller always gets back exactly one node
  return <>{renderSequence(blocks, imagesById, imageMissingText)}</>
}
