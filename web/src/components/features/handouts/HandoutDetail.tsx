'use client'

import { ChevronRight, Users } from 'lucide-react'
import React from 'react'

import type { Document, RawContentBlock } from '@/components/features/handouts/types/handout-types'
import Layout from '@/components/layout/Layout'
import {
  renderBlocks,
  renderInlineContent,
  renderRawContentBlock,
} from '@/components/math/ContentRenderer'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { cn } from '@/components/shared/utils/css-utils'
import { MobileTableOfContents } from '@/components/table-of-contents/MobileTableOfContents'
import { TableOfContents } from '@/components/table-of-contents/TableOfContents'
import { PAGE_LAYOUT } from '@/constants/common-section-styles'

import { CollapsibleCard } from './Cards'

type HandoutDetailProps = {
  document: Document
  authors: string[]
}

// Render a title that can be either a string or RawContentBlock
function renderTitle(title: RawContentBlock | null | undefined): React.ReactNode {
  if (!title) return null

  if (title.type === 'text') {
    return title.text
  }

  // For complex titles, render as React elements to preserve formatting.
  // Crucially, use renderInlineContent to avoid block-level wrappers like <p>.
  if (title.type === 'paragraph' || title.type === 'bold' || title.type === 'italic') {
    return renderInlineContent(title.content)
  }

  // Fallback for unexpected types, though paragraph should cover most cases.
  return renderRawContentBlock(title)
}

function renderDifficultyStars(difficulty: number): React.ReactNode {
  if (difficulty === 0) return null
  return <sup className="text-purple-400">*</sup>
}

function computeTableOfContentsItems(
  documentContent: Document
): Array<{ id: string; label: string; title: string; level: number }> {
  const tableOfContentsCounters: number[] = []
  return documentContent.sections.map((section) => {
    const headerLevel = Math.max(1, section.level)
    while (tableOfContentsCounters.length < headerLevel) tableOfContentsCounters.push(0)

    tableOfContentsCounters[headerLevel - 1] += 1
    for (let index = headerLevel; index < tableOfContentsCounters.length; index += 1)
      tableOfContentsCounters[index] = 0
    const sectionNumber = tableOfContentsCounters
      .slice(0, headerLevel)
      .filter((count) => count > 0)
      .join('.')

    const sectionId = `sec-${sectionNumber}`
    return {
      id: sectionId,
      label: sectionNumber,
      title: section.title,
      level: headerLevel,
    }
  })
}

function renderDocumentSections(
  documentContent: Document,
  tableOfContentsItems: Array<{ id: string; label: string; title: string; level: number }>
) {
  const localizedEnvironmentLabelByType: Record<
    'theorem' | 'exercise' | 'example' | 'problem',
    string
  > = {
    theorem: 'Tvrdenie',
    exercise: 'Cvičenie',
    example: 'Príklad',
    problem: 'Úloha',
  }
  const environmentTextColorClassByType: Record<
    'theorem' | 'exercise' | 'example' | 'problem',
    string
  > = {
    theorem: 'text-green-300',
    exercise: 'text-yellow-300',
    example: 'text-blue-300',
    problem: 'text-purple-300',
  }

  const environmentBadgeClassByType: Record<
    'theorem' | 'exercise' | 'example' | 'problem',
    { text: string; bg: string; border: string }
  > = {
    theorem: {
      text: 'text-green-200',
      bg: 'bg-green-500/15',
      border: 'border-green-400/20',
    },
    exercise: {
      text: 'text-yellow-200',
      bg: 'bg-yellow-500/15',
      border: 'border-yellow-400/20',
    },
    example: {
      text: 'text-blue-200',
      bg: 'bg-blue-500/15',
      border: 'border-blue-400/20',
    },
    problem: {
      text: 'text-purple-200',
      bg: 'bg-purple-500/15',
      border: 'border-purple-400/20',
    },
  }

  const environmentCounters: Record<'theorem' | 'exercise' | 'example' | 'problem', number> = {
    theorem: 0,
    exercise: 0,
    example: 0,
    problem: 0,
  }

  const getNextEnvironmentNumber = (environmentType: keyof typeof environmentCounters) => {
    environmentCounters[environmentType] += 1
    return `${environmentCounters[environmentType]}`
  }
  const sectionLevelCounters: number[] = []

  const renderedSections: React.ReactNode[] = []
  let sectionIndex = -1
  const totalSections = documentContent.sections.length

  for (const section of documentContent.sections) {
    const headerLevel = Math.max(1, section.level)
    while (sectionLevelCounters.length < headerLevel) sectionLevelCounters.push(0)

    sectionLevelCounters[headerLevel - 1] += 1
    for (let index = headerLevel; index < sectionLevelCounters.length; index += 1)
      sectionLevelCounters[index] = 0
    const sectionNumber = sectionLevelCounters
      .slice(0, headerLevel)
      .filter((count) => count > 0)
      .join('.')

    sectionIndex += 1
    const sectionId = tableOfContentsItems[sectionIndex]?.id || `sec-${sectionNumber}`
    const isLastSection = sectionIndex === totalSections - 1

    renderedSections.push(
      <section
        key={`${sectionNumber}-${section.title}`}
        // Ehm, the min-h to ensure the last TOC click is clickable :D
        className={cn('max-w-none', isLastSection && 'lg:min-h-[52vh]')}
      >
        <h2
          id={sectionId}
          className="text-3xl font-bold text-white mt-16 mb-6 border-b border-gray-700 pb-3"
        >
          <span className="mr-4 text-gray-300">{sectionNumber}</span>
          {/*
           * The section title is rendered on the client to avoid server-side performance bottlenecks
           * from rendering complex math equations. By using MathRendererClient, the initial page
           * load is fast, and math is rendered asynchronously in the browser.
           */}
          <MathRendererClient content={section.title} />
        </h2>
        {section.text.content.map((contentBlock, contentBlockIndex) => {
          if (
            contentBlock.type === 'theorem' ||
            contentBlock.type === 'exercise' ||
            contentBlock.type === 'example' ||
            contentBlock.type === 'problem'
          ) {
            const environmentNumber = getNextEnvironmentNumber(contentBlock.type)
            const environmentBaseTitle = localizedEnvironmentLabelByType[contentBlock.type]
            const userProvidedTitle = renderTitle(contentBlock.title)
            const difficultyStars =
              contentBlock.type === 'problem'
                ? renderDifficultyStars(contentBlock.difficulty)
                : null
            const mainTitle = (
              <>
                {environmentBaseTitle} {environmentNumber}
                {difficultyStars}
              </>
            )

            const subtitleBadge = userProvidedTitle ? userProvidedTitle : undefined

            if (contentBlock.type === 'theorem') {
              return (
                <div key={`${sectionNumber}-env-${contentBlockIndex}`}>
                  <CollapsibleCard type="theorem" title={mainTitle} subtitle={subtitleBadge}>
                    {renderBlocks(contentBlock.body)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.theorem
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.theorem.bg,
                                environmentBadgeClassByType.theorem.text,
                                environmentBadgeClassByType.theorem.border
                              )}
                            >
                              <span className="w-[8px] h-[8px] bg-green-200 rounded-[2px]"></span>
                            </span>
                            Dôkaz
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.proof)}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            if (contentBlock.type === 'exercise') {
              return (
                <div key={`${sectionNumber}-env-${contentBlockIndex}`}>
                  <CollapsibleCard type="exercise" title={mainTitle} subtitle={subtitleBadge}>
                    {renderBlocks(contentBlock.body)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.exercise
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.exercise.bg,
                                environmentBadgeClassByType.exercise.text,
                                environmentBadgeClassByType.exercise.border
                              )}
                            >
                              ✓
                            </span>
                            Riešenie
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.solution)}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            if (contentBlock.type === 'example') {
              return (
                <div key={`${sectionNumber}-env-${contentBlockIndex}`}>
                  <CollapsibleCard type="example" title={mainTitle} subtitle={subtitleBadge}>
                    {renderBlocks(contentBlock.body)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.example
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.example.bg,
                                environmentBadgeClassByType.example.text,
                                environmentBadgeClassByType.example.border
                              )}
                            >
                              ✓
                            </span>
                            Riešenie
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.solution)}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            // contentBlock.type === 'problem'
            return (
              <div key={`${sectionNumber}-env-${contentBlockIndex}`}>
                <CollapsibleCard type="problem" title={mainTitle} subtitle={subtitleBadge}>
                  <div>{renderBlocks(contentBlock.body)}</div>
                  <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                    {contentBlock.hint1 && (
                      <details className="group">
                        <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  text-amber-200 hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                          <span className="ui-text inline-flex items-center gap-2 font-medium leading-6">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-200 border border-amber-400/20">
                              1
                            </span>
                            Nápoveda
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.hint1)}
                        </div>
                      </details>
                    )}

                    {contentBlock.hint2 && (
                      <details className="group">
                        <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  text-amber-200 hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                          <span className="ui-text inline-flex items-center gap-2 font-medium leading-6">
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-200 border border-amber-400/20">
                              2
                            </span>
                            Nápoveda
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.hint2)}
                        </div>
                      </details>
                    )}

                    {contentBlock.solution && (
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.problem
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.problem.bg,
                                environmentBadgeClassByType.problem.text,
                                environmentBadgeClassByType.problem.border
                              )}
                            >
                              ✓
                            </span>
                            Riešenie
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(contentBlock.solution)}
                        </div>
                      </details>
                    )}
                  </div>
                </CollapsibleCard>
              </div>
            )
          }

          return (
            <div key={`${sectionNumber}-blk-${contentBlockIndex}`}>
              {renderRawContentBlock(contentBlock as RawContentBlock)}
            </div>
          )
        })}
      </section>
    )
  }

  return <div className="article--math">{renderedSections}</div>
}

/**
 * Renders the detailed view of a handout, shifting expensive math rendering to the client.
 *
 * This component is designated as a Client Component ('use client') to delegate the
 * computationally intensive task of rendering LaTeX to the user's browser. This approach
 * ensures a fast initial page load from the server, with mathematical content being
 * rendered asynchronously on the client-side. It improves perceived performance,
 * especially for large documents with many formulas, by preventing server-side bottlenecks.
 */
export default function HandoutDetail({ document: documentContent, authors }: HandoutDetailProps) {
  const tableOfContentsItems = computeTableOfContentsItems(documentContent)

  const renderedSections = renderDocumentSections(documentContent, tableOfContentsItems)

  return (
    <Layout>
      <div className="h-20" />
      <div className={`${PAGE_LAYOUT.padding} pt-8`}>
        <div
          className={`${PAGE_LAYOUT.maxWidthWide} mx-auto lg:grid lg:grid-cols-[9fr_280px] lg:gap-8`}
        >
          <div>
            <header className="mb-16 pt-4">
              <div className="mb-6">
                <h1 className="text-5xl sm:text-6xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                  <MathRendererClient
                    content={documentContent.subtitle || documentContent.title || ''}
                  />
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {documentContent.subtitle && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-400/20">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-blue-200 font-medium text-sm">
                      <MathRendererClient content={documentContent.title || ''} />
                    </span>
                  </div>
                )}

                {authors?.length > 0 && (
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 leading-5">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-gray-400" aria-hidden />
                      <span className="text-sm uppercase font-semibold text-gray-400">
                        {' '}
                        {authors.length > 1 ? 'Autori' : 'Autor'}{' '}
                      </span>
                    </div>
                    <span className="text-gray-200 font-semi-bold text-sm">
                      {' '}
                      {authors.join(', ')}{' '}
                    </span>
                  </div>
                )}
              </div>
            </header>

            {renderedSections}
          </div>

          <aside className="mt-8">
            <TableOfContents items={tableOfContentsItems} key={documentContent.title} />
          </aside>
        </div>
      </div>

      {/* Mobile fixed navigation bar */}
      <MobileTableOfContents items={tableOfContentsItems} key={documentContent.title} />
    </Layout>
  )
}
