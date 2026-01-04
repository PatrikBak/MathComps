import { describe, expect, it } from 'vitest'

import { type EditorConfig, EditorState } from '../model/EditorState'

/**
 * Configuration used for tests.
 */
const TEST_CONFIG: EditorConfig = {
  maxCharacters: 5000,
  maxImages: 3,
  maxAttachments: 2,
}

describe('EditorState', () => {
  describe('construction', () => {
    it('should store the provided text', () => {
      const state = new EditorState('Hello World', TEST_CONFIG)
      expect(state.text).toBe('Hello World')
    })

    it('should handle empty text', () => {
      const state = new EditorState('', TEST_CONFIG)
      expect(state.text).toBe('')
    })

    it('should compute metrics on construction', () => {
      const state = new EditorState('Hello World', TEST_CONFIG)
      expect(state.metrics.charCount).toBe(11)
    })
  })

  describe('hasContent', () => {
    it('should return false for empty string', () => {
      const state = new EditorState('', TEST_CONFIG)
      expect(state.hasContent).toBe(false)
    })

    it('should return false for whitespace-only string', () => {
      const state = new EditorState('   \n\t  ', TEST_CONFIG)
      expect(state.hasContent).toBe(false)
    })

    it('should return true for non-empty text', () => {
      const state = new EditorState('Hello', TEST_CONFIG)
      expect(state.hasContent).toBe(true)
    })

    it('should return true for text with leading/trailing whitespace', () => {
      const state = new EditorState('  Hello  ', TEST_CONFIG)
      expect(state.hasContent).toBe(true)
    })
  })

  describe('metrics', () => {
    it('should count characters correctly', () => {
      const state = new EditorState('Hello World', TEST_CONFIG)
      expect(state.metrics.charCount).toBe(11)
    })

    it('should count images correctly', () => {
      const stateWithoutImages = new EditorState('No images here', TEST_CONFIG)
      expect(stateWithoutImages.metrics.imageCount).toBe(0)

      const stateWithImages = new EditorState(
        'Text ![alt](http://example.com/img.png) more',
        TEST_CONFIG
      )
      expect(stateWithImages.metrics.imageCount).toBe(1)

      const stateWithMultipleImages = new EditorState(
        '![img1](url1) text ![img2](url2) ![img3](url3)',
        TEST_CONFIG
      )
      expect(stateWithMultipleImages.metrics.imageCount).toBe(3)
    })

    it('should count attachments correctly', () => {
      const stateWithoutAttachments = new EditorState('No attachments here', TEST_CONFIG)
      expect(stateWithoutAttachments.metrics.attachmentCount).toBe(0)

      const stateWithAttachment = new EditorState(
        'Text [📎 file.pdf](http://example.com/file.pdf)',
        TEST_CONFIG
      )
      expect(stateWithAttachment.metrics.attachmentCount).toBe(1)
    })

    it('should use smart character count (excluding URLs)', () => {
      // A link with long URL should only count the link text
      const state = new EditorState(
        '[click here](https://example.com/very-long-url-path)',
        TEST_CONFIG
      )
      // "click here" = 10 characters (not including the URL)
      expect(state.metrics.charCount).toBe(10)
    })
  })

  describe('isOverCharacterLimit', () => {
    it('should return false for short text', () => {
      const state = new EditorState('Hello', { maxCharacters: 10 })
      expect(state.isOverCharacterLimit).toBe(false)
    })

    it('should return true when character limit is exceeded', () => {
      const state = new EditorState('123456', { maxCharacters: 5 })
      expect(state.isOverCharacterLimit).toBe(true)
    })

    it('should return false for text at exactly the limit', () => {
      const state = new EditorState('12345', { maxCharacters: 5 })
      expect(state.isOverCharacterLimit).toBe(false)
    })
  })

  describe('isOverImageLimit', () => {
    it('should return false when under image limit', () => {
      const state = new EditorState('![img](url)', { maxImages: 3 })
      expect(state.isOverImageLimit).toBe(false)
    })

    it('should return false at exactly the image limit', () => {
      const state = new EditorState('![1](u1) ![2](u2) ![3](u3)', { maxImages: 3 })
      expect(state.isOverImageLimit).toBe(false)
    })

    it('should return true when over image limit', () => {
      const state = new EditorState('![1](u1) ![2](u2) ![3](u3) ![4](u4)', { maxImages: 3 })
      expect(state.isOverImageLimit).toBe(true)
    })
  })

  describe('isOverAttachmentLimit', () => {
    it('should return false when under attachment limit', () => {
      const state = new EditorState('[📎 file.pdf](url)', { maxAttachments: 2 })
      expect(state.isOverAttachmentLimit).toBe(false)
    })

    it('should return false at exactly the attachment limit', () => {
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', { maxAttachments: 2 })
      expect(state.isOverAttachmentLimit).toBe(false)
    })

    it('should return true when over attachment limit', () => {
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2) [📎 f3](u3)', { maxAttachments: 2 })
      expect(state.isOverAttachmentLimit).toBe(true)
    })
  })

  describe('isValid', () => {
    it('should return false for empty content', () => {
      const state = new EditorState('', TEST_CONFIG)
      expect(state.isValid).toBe(false)
    })

    it('should return false for whitespace-only content', () => {
      const state = new EditorState('   \n   ', TEST_CONFIG)
      expect(state.isValid).toBe(false)
    })

    it('should return true for valid short text', () => {
      const state = new EditorState('Hello World', TEST_CONFIG)
      expect(state.isValid).toBe(true)
    })

    it('should return false when over character limit', () => {
      const state = new EditorState('123456', { maxCharacters: 5 })
      expect(state.isValid).toBe(false)
    })

    it('should return false when over image limit', () => {
      const state = new EditorState('![1](u1) ![2](u2)', { maxImages: 1 })
      expect(state.isValid).toBe(false)
    })

    it('should return false when over attachment limit', () => {
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', { maxAttachments: 1 })
      expect(state.isValid).toBe(false)
    })
  })

  describe('canAddMore', () => {
    describe('for images', () => {
      it('should return true when no images exist', () => {
        const state = new EditorState('Some text', { maxImages: 3 })
        expect(state.canAddMore('image')).toBe(true)
      })

      it('should return true when under image limit', () => {
        const state = new EditorState('![img1](url1) ![img2](url2)', { maxImages: 3 })
        expect(state.canAddMore('image')).toBe(true)
      })

      it('should return false when at image limit', () => {
        const state = new EditorState('![1](u1) ![2](u2) ![3](u3)', { maxImages: 3 })
        expect(state.canAddMore('image')).toBe(false)
      })

      it('should return false when over image limit', () => {
        const state = new EditorState('![1](u1) ![2](u2) ![3](u3) ![4](u4)', { maxImages: 3 })
        expect(state.canAddMore('image')).toBe(false)
      })
    })

    describe('for attachments', () => {
      it('should return true when no attachments exist', () => {
        const state = new EditorState('Some text', { maxAttachments: 2 })
        expect(state.canAddMore('attachment')).toBe(true)
      })

      it('should return true when under attachment limit', () => {
        const state = new EditorState('[📎 file.pdf](url)', { maxAttachments: 2 })
        expect(state.canAddMore('attachment')).toBe(true)
      })

      it('should return false when at attachment limit', () => {
        const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', { maxAttachments: 2 })
        expect(state.canAddMore('attachment')).toBe(false)
      })

      it('should return false when over attachment limit', () => {
        const state = new EditorState('[📎 f1](u1) [📎 f2](u2) [📎 f3](u3)', { maxAttachments: 2 })
        expect(state.canAddMore('attachment')).toBe(false)
      })
    })
  })

  describe('immutability', () => {
    it('should not change after construction', () => {
      const state = new EditorState('Hello', TEST_CONFIG)

      // All properties should remain the same
      expect(state.text).toBe('Hello')
      expect(state.hasContent).toBe(true)
      expect(state.isValid).toBe(true)

      // These should be consistently computed
      const metrics1 = state.metrics
      const metrics2 = state.metrics
      expect(metrics1).toBe(metrics2) // Same reference (computed once)
    })
  })
})
