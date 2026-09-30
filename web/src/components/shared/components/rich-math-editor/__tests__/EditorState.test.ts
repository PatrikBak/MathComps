import { describe, expect, it } from 'vitest'

import { type EditorConfig, EditorState } from '../model/EditorState'
import { EDITOR_UPLOADS } from '../utils/attachment-utils'

/**
 * The limits each case starts from, loose enough that only the one a case overrides can trip.
 */
const TEST_CONFIG: EditorConfig = {
  maxCharacters: 5000,
  maxImages: 3,
  maxAttachments: 2,
}

describe('EditorState', () => {
  describe('hasContent', () => {
    it('should return false for whitespace-only string', () => {
      // Spaces, a newline and a tab, and nothing else
      const state = new EditorState('   \n\t  ', TEST_CONFIG)

      // Which is no content
      expect(state.hasContent).toBe(false)
    })

    it('should return true for text with leading/trailing whitespace', () => {
      // A word with spaces on both sides
      const state = new EditorState('  Hello  ', TEST_CONFIG)

      // Which is content, spaces and all
      expect(state.hasContent).toBe(true)
    })
  })

  describe('metrics', () => {
    it('should count characters correctly', () => {
      // Two words and the space between them
      const state = new EditorState('Hello World', TEST_CONFIG)

      // Eleven characters, the space among them
      expect(state.metrics.charCount).toBe(11)
    })

    it('should count images correctly', () => {
      // Text with no image in it
      const stateWithoutImages = new EditorState('No images here', TEST_CONFIG)

      // Which counts none
      expect(stateWithoutImages.metrics.imageCount).toBe(0)

      // One image between two words
      const stateWithImages = new EditorState(
        'Text ![alt](http://example.com/img.png) more',
        TEST_CONFIG
      )

      // Which counts one
      expect(stateWithImages.metrics.imageCount).toBe(1)

      // Three images, with text beside them
      const stateWithMultipleImages = new EditorState(
        '![img1](url1) text ![img2](url2) ![img3](url3)',
        TEST_CONFIG
      )

      // Which counts all three
      expect(stateWithMultipleImages.metrics.imageCount).toBe(3)
    })

    it('should count attachments correctly', () => {
      // Text with no attachment in it
      const stateWithoutAttachments = new EditorState('No attachments here', TEST_CONFIG)

      // Which counts none
      expect(stateWithoutAttachments.metrics.attachmentCount).toBe(0)

      // One attachment after a word
      const stateWithAttachment = new EditorState(
        'Text [📎 file.pdf](http://example.com/file.pdf)',
        TEST_CONFIG
      )

      // Which counts one
      expect(stateWithAttachment.metrics.attachmentCount).toBe(1)
    })

    it('should count an uploaded file once when its name holds a bracketed word', () => {
      // An image whose name holds a bracketed word
      const image = EDITOR_UPLOADS.image.toMarkdown('plot [v2]', 'key-1')

      // And an attachment whose name holds another
      const attachment = EDITOR_UPLOADS.attachment.toMarkdown('HW [solutions].pdf', 'key-2')

      // Both in one text
      const state = new EditorState(`${image} and ${attachment}`, TEST_CONFIG)

      // The image counted once
      expect(state.metrics.imageCount).toBe(1)

      // And the attachment once
      expect(state.metrics.attachmentCount).toBe(1)
    })

    it('should not count the whitespace around the content', () => {
      // A word with spaces around it and a newline after
      const state = new EditorState('  Hello  \n', TEST_CONFIG)

      // Only the word's five characters count
      expect(state.metrics.charCount).toBe(5)
    })

    it('should count a link whole, URL and all', () => {
      // A link whose URL runs far longer than its text
      const link = '[click here](https://example.com/very-long-url-path)'

      // The link as the whole of the text
      const state = new EditorState(link, TEST_CONFIG)

      // Every character of the link counts, URL included
      expect(state.metrics.charCount).toBe(link.length)
    })
  })

  describe('isOverCharacterLimit', () => {
    it('should return true when character limit is exceeded', () => {
      // Six characters against a limit of five
      const state = new EditorState('123456', { ...TEST_CONFIG, maxCharacters: 5 })

      // One past the limit is over it
      expect(state.isOverCharacterLimit).toBe(true)
    })

    it('should return false for text at exactly the limit', () => {
      // Five characters against a limit of five
      const state = new EditorState('12345', { ...TEST_CONFIG, maxCharacters: 5 })

      // Reaching the limit is still within it
      expect(state.isOverCharacterLimit).toBe(false)
    })

    it("should return true when only a link's URL pushes the text over the limit", () => {
      // A link reading as ten characters, against a limit of twenty. The server counts what was typed
      const state = new EditorState('[click here](https://example.com/pad)', {
        ...TEST_CONFIG,
        maxCharacters: 20,
      })

      // Over, the URL counting like any other characters
      expect(state.isOverCharacterLimit).toBe(true)
    })

    it('should return false where there is no limit', () => {
      // Six characters, with no limit to hold them to
      const state = new EditorState('123456', { ...TEST_CONFIG, maxCharacters: null })

      // Which no text can be over
      expect(state.isOverCharacterLimit).toBe(false)
    })
  })

  describe('isOverImageLimit', () => {
    it('should return false at exactly the image limit', () => {
      // Three images against a limit of three
      const state = new EditorState('![1](u1) ![2](u2) ![3](u3)', { ...TEST_CONFIG, maxImages: 3 })

      // Reaching the limit is still within it
      expect(state.isOverImageLimit).toBe(false)
    })

    it('should return true when over image limit', () => {
      // Four images against a limit of three
      const state = new EditorState('![1](u1) ![2](u2) ![3](u3) ![4](u4)', {
        ...TEST_CONFIG,
        maxImages: 3,
      })

      // One past the limit is over it
      expect(state.isOverImageLimit).toBe(true)
    })
  })

  describe('isOverAttachmentLimit', () => {
    it('should return false at exactly the attachment limit', () => {
      // Two attachments against a limit of two
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', {
        ...TEST_CONFIG,
        maxAttachments: 2,
      })

      // Reaching the limit is still within it
      expect(state.isOverAttachmentLimit).toBe(false)
    })

    it('should return true when over attachment limit', () => {
      // Three attachments against a limit of two
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2) [📎 f3](u3)', {
        ...TEST_CONFIG,
        maxAttachments: 2,
      })

      // One past the limit is over it
      expect(state.isOverAttachmentLimit).toBe(true)
    })
  })

  describe('isValid', () => {
    it('should return false for whitespace-only content', () => {
      // Spaces and a newline, and nothing else
      const state = new EditorState('   \n   ', TEST_CONFIG)

      // Nothing there to send
      expect(state.isValid).toBe(false)
    })

    it('should return true for valid short text', () => {
      // Two words, far inside every limit
      const state = new EditorState('Hello World', TEST_CONFIG)

      // Ready to send
      expect(state.isValid).toBe(true)
    })

    it('should return false when over character limit', () => {
      // Six characters against a limit of five
      const state = new EditorState('123456', { ...TEST_CONFIG, maxCharacters: 5 })

      // Held back
      expect(state.isValid).toBe(false)
    })

    it('should return true where there is no character limit', () => {
      // Two words, with no character limit
      const state = new EditorState('Hello World', { ...TEST_CONFIG, maxCharacters: null })

      // Ready to send, there being no limit for them to pass
      expect(state.isValid).toBe(true)
    })

    it('should return false when over image limit', () => {
      // Two images against a limit of one
      const state = new EditorState('![1](u1) ![2](u2)', { ...TEST_CONFIG, maxImages: 1 })

      // Held back
      expect(state.isValid).toBe(false)
    })

    it('should return false when over attachment limit', () => {
      // Two attachments against a limit of one
      const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', {
        ...TEST_CONFIG,
        maxAttachments: 1,
      })

      // Held back
      expect(state.isValid).toBe(false)
    })
  })

  describe('canAddMore', () => {
    describe('for images', () => {
      it('should return true when under image limit', () => {
        // Two images against a limit of three
        const state = new EditorState('![img1](url1) ![img2](url2)', {
          ...TEST_CONFIG,
          maxImages: 3,
        })

        // Room for a third
        expect(state.canAddMore('image')).toBe(true)
      })

      it('should return false when at image limit', () => {
        // Three images against a limit of three
        const state = new EditorState('![1](u1) ![2](u2) ![3](u3)', {
          ...TEST_CONFIG,
          maxImages: 3,
        })

        // No room for a fourth
        expect(state.canAddMore('image')).toBe(false)
      })
    })

    describe('for attachments', () => {
      it('should return true when under attachment limit', () => {
        // One attachment against a limit of two
        const state = new EditorState('[📎 file.pdf](url)', { ...TEST_CONFIG, maxAttachments: 2 })

        // Room for a second
        expect(state.canAddMore('attachment')).toBe(true)
      })

      it('should return false when at attachment limit', () => {
        // Two attachments against a limit of two
        const state = new EditorState('[📎 f1](u1) [📎 f2](u2)', {
          ...TEST_CONFIG,
          maxAttachments: 2,
        })

        // No room for a third
        expect(state.canAddMore('attachment')).toBe(false)
      })
    })
  })
})
