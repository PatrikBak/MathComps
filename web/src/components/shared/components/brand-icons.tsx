import { createLucideIcon, type IconNode } from 'lucide-react'

/**
 * Brand logos in lucide's outline style.
 *
 * lucide removed brand icons (GitHub, LinkedIn, YouTube, …) in v1, so they are
 * recreated here with {@link createLucideIcon} using the original ISC-licensed
 * outline paths. Built this way they are genuine {@link import('lucide-react').LucideIcon}
 * values — identical sizing, stroke, and a11y behavior to every other lucide icon,
 * so they stay visually consistent and remain assignable wherever a `LucideIcon` is expected.
 */

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

const youtubeIconNode: IconNode = [
  [
    'path',
    {
      d: 'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
      key: 'youtube-screen',
    },
  ],
  ['path', { d: 'm10 15 5-3-5-3z', key: 'youtube-play' }],
]

/** GitHub logo in lucide's outline style. */
export const GithubIcon = createLucideIcon('github', githubIconNode)

/** LinkedIn logo in lucide's outline style. */
export const LinkedinIcon = createLucideIcon('linkedin', linkedinIconNode)

/** YouTube logo in lucide's outline style. */
export const YoutubeIcon = createLucideIcon('youtube', youtubeIconNode)
