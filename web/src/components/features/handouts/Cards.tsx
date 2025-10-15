import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

type CardType = 'theorem' | 'exercise' | 'example' | 'problem'

const PALETTE: Record<CardType, { border: string; title: string; tint: string; summary: string }> =
  {
    theorem: {
      border: 'border-green-500',
      title: 'text-green-300',
      tint: 'border-green-500/20',
      summary: 'text-green-300',
    },
    exercise: {
      border: 'border-yellow-500',
      title: 'text-yellow-300',
      tint: 'border-yellow-500/20',
      summary: 'text-yellow-300',
    },
    example: {
      border: 'border-blue-500',
      title: 'text-blue-300',
      tint: 'border-blue-500/20',
      summary: 'text-blue-300',
    },
    problem: {
      border: 'border-purple-500',
      title: 'text-purple-300',
      tint: 'border-purple-500/20',
      summary: 'text-purple-300',
    },
  }

export function CollapsibleCard({
  type,
  title,
  subtitle,
  children,
  detailsTitle,
  details,
}: {
  type: CardType
  title?: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
  detailsTitle?: string
  details?: React.ReactNode
}) {
  const c = PALETTE[type]

  return (
    <section className={cn('bg-gray-800/50 border-l-4 rounded-r-lg my-6', c.border)}>
      <div className="p-5 sm:p-6">
        {(title || subtitle) && (
          <div className="mb-2 flex items-center gap-5 flex-wrap">
            {title && (
              <p
                className={cn(
                  'ui-text ui-nums font-semibold text-[1.06em] sm:text-[1.1em] leading-tight',
                  c.title
                )}
              >
                {title}
              </p>
            )}{' '}
            {subtitle && (
              <span
                className={`ui-text ui-nums ${c.title} border ${c.tint} bg-white/5
                text-[0.82em] sm:text-[0.86em] font-medium
                px-[0.6em] py-[0.28em] rounded-full
                inline-flex items-baseline leading-none`}
              >
                {subtitle}
              </span>
            )}
          </div>
        )}
        <div className="text-gray-300 leading-relaxed">{children}</div>
      </div>

      {(detailsTitle || details) && (
        <details className={cn('border-t group', c.tint)}>
          <summary
            className={cn(
              'flex justify-between items-center px-5 sm:px-6 py-3 sm:py-4 hover:bg-white/5',
              c.summary
            )}
          >
            <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
              {detailsTitle}
            </span>{' '}
            <svg
              className="w-5 h-5 transition-transform group-open:rotate-90"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <div className="p-5 sm:p-6 border-t text-gray-300 leading-relaxed">
            {details ? details : <em className="text-gray-400">—</em>}
          </div>
        </details>
      )}
    </section>
  )
}
