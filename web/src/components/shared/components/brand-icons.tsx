import { createLucideIcon, type IconNode } from 'lucide-react'

/**
 * Brand logos in lucide's outline style.
 *
 * Each is built with {@link createLucideIcon} from the ISC-licensed lucide outline paths, so they are
 * genuine {@link import('lucide-react').LucideIcon} values — identical sizing, stroke, and a11y behavior
 * to every other lucide icon, and assignable wherever a `LucideIcon` is expected.
 */

// GitHub outline path nodes
const githubIconNode: IconNode = [
  [
    'path',
    {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
      key: 'github-body',
    },
  ],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2', key: 'github-tail' }],
]

// LinkedIn outline path nodes
const linkedinIconNode: IconNode = [
  [
    'path',
    {
      d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z',
      key: 'linkedin-arm',
    },
  ],
  ['rect', { width: '4', height: '12', x: '2', y: '9', key: 'linkedin-bar' }],
  ['circle', { cx: '4', cy: '4', r: '2', key: 'linkedin-dot' }],
]

/** GitHub logo in lucide's outline style. */
export const GithubIcon = createLucideIcon('github', githubIconNode)

/** LinkedIn logo in lucide's outline style. */
export const LinkedinIcon = createLucideIcon('linkedin', linkedinIconNode)
