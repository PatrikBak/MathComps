'use client'

import { ListChecks } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'

import type { Organization } from '@/components/features/problem-selection/model/selection-types'

import type { UserMenuItemVariant } from './UserMenuItem'
import { USER_MENU_ROW_CLASS, UserMenuItem, UserMenuTile } from './UserMenuItem'

/**
 * Props for the {@link UserMenuSelections} component.
 */
type UserMenuSelectionsProps = {
  /** The organizations the user is a member of, in the order they are offered. */
  organizations: readonly Organization[]
  /** Where the selections are drawn */
  variant: UserMenuItemVariant
  /** Called when an organization is picked */
  onClick?: () => void
}

/**
 * The user menu's problem selections: a heading row laid out like an item but with nothing to pick, over an item per
 * organization the user is a member of, set in beneath it. Nothing for a user on no organization's list.
 */
export function UserMenuSelections({ organizations, variant, onClick }: UserMenuSelectionsProps) {
  // The heading's id, which names the group
  const headingId = useId()

  // The problem selection's own copy
  const t = useTranslations('pages.problemSelection')

  // A user on no list has no selection to open
  if (organizations.length === 0) {
    return null
  }

  // The heading over an item per organization
  return (
    <div role="group" aria-labelledby={headingId}>
      {/* Heading */}
      <div id={headingId} className={USER_MENU_ROW_CLASS[variant]}>
        <UserMenuTile className="bg-success/10 text-success">
          <ListChecks className="w-5 h-5" />
        </UserMenuTile>
        <span>{t('title')}</span>
      </div>

      {/* Items */}
      {organizations.map((organization) => (
        <UserMenuItem
          key={organization.slug}
          type="organization"
          organization={organization}
          variant={variant}
          onClick={onClick}
        />
      ))}
    </div>
  )
}
