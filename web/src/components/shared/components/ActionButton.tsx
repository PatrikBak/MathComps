'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-500',
        secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus-visible:ring-slate-500',
        ghost:
          'text-slate-300 hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-slate-600',
        gradientIndigoPurple:
          'text-white bg-gradient-to-b lg:bg-gradient-to-r from-indigo-700/40 to-purple-800/40 border border-white/10 hover:border-white/50 hover:shadow-indigo-500/20 focus-visible:ring-indigo-500',
        gradientVioletPink:
          'text-white bg-gradient-to-b lg:bg-gradient-to-r from-violet-700/40 to-fuchsia-800/40 border border-white/10 hover:border-white/50 hover:shadow-violet-500/20 focus-visible:ring-violet-500',
        gradientPinkRose:
          'text-white bg-gradient-to-b lg:bg-gradient-to-r from-fuchsia-700/40 to-pink-800/40 border border-white/10 hover:border-white/50 hover:shadow-fuchsia-500/20 focus-visible:ring-fuchsia-500',
      },
      size: {
        large: 'px-6 py-3 text-lg',
        medium: 'px-4 py-2 text-base',
        small: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'medium',
    },
  }
)

type ActionButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

type ActionButtonProps = ActionButtonBaseProps &
  (
    | {
        href: string
        target?: string
        onClick?: React.MouseEventHandler<HTMLAnchorElement>
      }
    | {
        href?: undefined
        target?: undefined
        onClick?: React.MouseEventHandler<HTMLButtonElement>
      }
  )

export default function ActionButton(props: ActionButtonProps) {
  const { children, className, disabled } = props
  const variant = props.variant
  const size = props.size
  const finalClassName = cn(
    buttonVariants({ variant, size }),
    disabled && 'opacity-50 cursor-not-allowed',
    className
  )

  if ('href' in props && props.href) {
    const { onClick } = props
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault()
        return
      }
      onClick?.(e)
    }

    return (
      <AppLink
        href={props.href}
        className={finalClassName}
        newTab={props.target === '_blank'}
        onClick={handleClick}
      >
        {children}
      </AppLink>
    )
  }

  return (
    <button
      className={finalClassName}
      onClick={props.onClick as React.MouseEventHandler<HTMLButtonElement>}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
