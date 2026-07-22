import { getR2BaseUrl } from '@/components/shared/utils/url-utils'

/**
 * The suffix for the URL endpoint for images for different types of content.
 */
type ImageType = 'problems' | 'handouts'

/**
 * Builds a public URL to a content image by its content id. Both problem and handout images
 * live on Cloudflare R2 under a per-type prefix that matches the image type.
 *
 * @param contentId - The unique identifier of the problem content/image
 * @param type - The type of the image (problems or handouts)
 * @returns The URL to the image
 */
export function getProblemImageUrl(contentId: string, type: ImageType): string {
  return `${getR2BaseUrl()}/${type}/${contentId}`
}

/**
 * Builds a public URL to a handout PDF by its filename. All handout PDFs live
 * together in the flat `handouts/pdfs/` folder on R2.
 *
 * @param filename - The PDF filename (e.g., "factorization.sk.pdf")
 * @returns The public URL to the PDF on R2
 */
export function getHandoutPdfUrl(filename: string): string {
  return `${getR2BaseUrl()}/handouts/pdfs/${filename}`
}

/**
 * Builds a public URL to a downloadable document by its identifier. Documents
 * (handout-linked PDFs) live on Cloudflare R2 under the flat `documents/` prefix.
 *
 * @param documentId - The unique identifier of the document asset
 * @returns The public URL to the document on R2
 */
export function getDocumentUrl(documentId: string): string {
  return `${getR2BaseUrl()}/documents/${documentId}`
}
