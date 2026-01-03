import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { FILE_UPLOAD_CONFIG, type FileType } from '@/constants/file-upload-constants'
import { ApiError, withAuth } from '@/lib/api/api-handler'

/**
 * Request body for upload URL generation.
 */
type UploadUrlRequest = {
  /** Original filename for the file being uploaded */
  filename: string
  /** MIME type of the file (e.g., 'image/png', 'application/pdf') */
  contentType: string
  /** File size in bytes, used for validation */
  fileSize: number
  /** File type: 'image' or 'attachment'.*/
  type: FileType
}

/**
 * Response with presigned upload URL.
 */
type UploadUrlResponse = {
  /** Presigned URL for direct PUT upload to R2 storage */
  uploadUrl: string
  /** Unique key/path for the file in R2 storage */
  key: string
}

/**
 * Generates a presigned Cloudflare R2 URL for direct browser upload.
 * Supports both images and attachments.
 */
export const POST = withAuth(async (request: NextRequest, userId: string) => {
  // Parse and validate request
  const body = (await request.json()) as UploadUrlRequest
  const { filename, contentType, fileSize, type = 'image' } = body

  // Validate file type
  if (type !== 'image' && type !== 'attachment') {
    throw new ApiError(400, 'Neplatný typ súboru')
  }

  // Get config for the current file type
  const typeConfig = FILE_UPLOAD_CONFIG[type]

  // Validate content type
  if (!(typeConfig.allowedTypes as readonly string[]).includes(contentType)) {
    throw new ApiError(400, 'Nepovolený typ súboru')
  }

  // Validate file size (convert MB to bytes)
  if (fileSize > typeConfig.maxFileSizeMB * 1024 * 1024) {
    throw new ApiError(400, `Súbor je príliš veľký. Maximum: ${typeConfig.maxFileSizeMB} MB`)
  }

  // Generate unique key for R2
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const extension = sanitizedFilename.split('.').pop()
  const shortUserId = userId.replace('user_', '')
  const fileId = `${timestamp}-${crypto.randomUUID()}.${extension}`
  const shortKey = `${shortUserId}/${typeConfig.folder}/${fileId}`

  // Full key for R2 storage (with all prefixes)
  const fullKey = `user-uploads/${userId}/${typeConfig.folder}/${fileId}`

  // Create S3 client
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${getRequiredEnv('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  })

  // Generate presigned URL
  const uploadUrl = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: getRequiredEnv('R2_BUCKET_NAME'),
      Key: fullKey,
      ContentType: contentType,
      ContentLength: fileSize,
    }),
    {
      expiresIn: FILE_UPLOAD_CONFIG.urlExpiration,
    }
  )

  // Return OK response
  return NextResponse.json<UploadUrlResponse>({
    uploadUrl,
    key: shortKey,
  })
})
