import fs from 'fs'
import matter from 'gray-matter'
import type { Metadata } from 'next'
import path from 'path'
import { Suspense } from 'react'

import { NewsList } from '@/components/features/news/NewsList'
import type { NewsArticle, NewsCategory } from '@/components/features/news/types'
import Layout from '@/components/layout/Layout'
import { ROUTES } from '@/constants/routes'
import { generatePageMetadata } from '@/lib/metadata'
import { validateUniqueIds } from '@/lib/validation'

export const metadata: Metadata = generatePageMetadata({
  title: 'Novinky',
  description: 'Najnovšie správy tom, čo sa deje na webe.',
  path: ROUTES.NEWS,
  type: 'website',
  section: 'Novinky',
})

export default function NovinkyPage() {
  return (
    <Layout wider centerMidscreen>
      <Suspense>
        <NewsList articles={getAllNewsArticles()} />
      </Suspense>
    </Layout>
  )
}

/**
 * Directory containing news articles in MDX format.
 */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/news')

/**
 * Get all news articles from MDX files in the content directory.
 *
 * @returns Array of {@link NewsArticle} objects with MDX body content for rendering in cards.
 */
export function getAllNewsArticles(): NewsArticle[] {
  // Check if directory exists
  if (!fs.existsSync(CONTENT_DIR)) throw new Error(`Directory ${CONTENT_DIR} does not exist`)

  // Get all mdx files in the directory
  const articles: NewsArticle[] = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      // Get file content
      const filePath = path.join(CONTENT_DIR, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')

      // Parse frontmatter and content
      const { data, content } = matter(fileContent)

      // Trim the content
      const trimmedContent = content.trim()

      // Validate required fields (including date now)
      if (!data.title || !data.date || !data.category || !data.author || !trimmedContent) {
        throw new Error(`Missing required fields in ${file}`)
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error(`Invalid date format in ${file}. Expected YYYY-MM-DD, got: ${data.date}`)
      }

      // Return article data
      return {
        id: data.id,
        title: data.title,
        date: data.date,
        category: data.category as NewsCategory,
        author: data.author,
        content: trimmedContent,
      } as NewsArticle
    })

  // Check for duplicate IDs
  validateUniqueIds(articles, (article) => article.id, 'news article')

  // Sort by date (newest first)
  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
