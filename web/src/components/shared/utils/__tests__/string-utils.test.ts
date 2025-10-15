import { describe, expect, it } from 'vitest'

import { shortenYouTubeUrls } from '../string-utils'

describe('shortenYouTubeUrls', () => {
  describe('YouTube.com URLs', () => {
    it('should shorten @channel URLs to just the channel name', () => {
      expect(shortenYouTubeUrls('youtube.com/@SomeChannel')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('youtube.com/@3Blue1Brown')).toBe('3Blue1Brown')
      expect(shortenYouTubeUrls('youtube.com/@mathematics')).toBe('mathematics')
    })

    it('should shorten /c/ URLs to just the channel name', () => {
      expect(shortenYouTubeUrls('youtube.com/c/ChannelName')).toBe('ChannelName')
      expect(shortenYouTubeUrls('youtube.com/c/MyMathChannel')).toBe('MyMathChannel')
    })

    it('should shorten /channel/ URLs to just the channel ID', () => {
      expect(shortenYouTubeUrls('youtube.com/channel/UC123456789')).toBe('UC123456789')
      expect(shortenYouTubeUrls('youtube.com/channel/UCabcdefghijklmnop')).toBe(
        'UCabcdefghijklmnop'
      )
    })

    it('should shorten watch?v= URLs to just the video ID', () => {
      expect(shortenYouTubeUrls('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(shortenYouTubeUrls('youtube.com/watch?v=abc123def456')).toBe('abc123def456')
    })

    it('should shorten playlist URLs to just the playlist ID', () => {
      expect(shortenYouTubeUrls('youtube.com/playlist?list=PL123456789')).toBe('PL123456789')
      expect(shortenYouTubeUrls('youtube.com/playlist?list=PLabcdefghijklmnop')).toBe(
        'PLabcdefghijklmnop'
      )
    })

    it('should handle URLs with additional parameters', () => {
      expect(shortenYouTubeUrls('youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ')
      expect(shortenYouTubeUrls('youtube.com/@SomeChannel/videos')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('youtube.com/c/ChannelName/about')).toBe('ChannelName')
    })

    it('should handle URLs with trailing slashes', () => {
      expect(shortenYouTubeUrls('youtube.com/@SomeChannel/')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('youtube.com/c/ChannelName/')).toBe('ChannelName')
    })
  })

  describe('Youtu.be URLs', () => {
    it('should shorten youtu.be URLs to just the video ID', () => {
      expect(shortenYouTubeUrls('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(shortenYouTubeUrls('youtu.be/abc123def456')).toBe('abc123def456')
    })

    it('should handle youtu.be URLs with additional parameters', () => {
      expect(shortenYouTubeUrls('youtu.be/dQw4w9WgXcQ?t=30s')).toBe('dQw4w9WgXcQ')
      expect(shortenYouTubeUrls('youtu.be/abc123def456&feature=share')).toBe('abc123def456')
    })

    it('should handle youtu.be URLs with trailing slashes', () => {
      expect(shortenYouTubeUrls('youtu.be/dQw4w9WgXcQ/')).toBe('dQw4w9WgXcQ')
    })
  })

  describe('Non-YouTube URLs', () => {
    it('should return non-YouTube URLs unchanged', () => {
      expect(shortenYouTubeUrls('example.com')).toBe('example.com')
      expect(shortenYouTubeUrls('github.com/user/repo')).toBe('github.com/user/repo')
      expect(shortenYouTubeUrls('stackoverflow.com/questions/123')).toBe(
        'stackoverflow.com/questions/123'
      )
    })

    it('should return text without URLs unchanged', () => {
      expect(shortenYouTubeUrls('Just some text')).toBe('Just some text')
      expect(shortenYouTubeUrls('Math is fun!')).toBe('Math is fun!')
    })

    it('should return empty string unchanged', () => {
      expect(shortenYouTubeUrls('')).toBe('')
    })
  })

  describe('Edge cases', () => {
    it('should handle malformed YouTube URLs gracefully', () => {
      expect(shortenYouTubeUrls('youtube.com/')).toBe('youtube.com/')
      expect(shortenYouTubeUrls('youtube.com/invalid')).toBe('youtube.com/invalid')
      expect(shortenYouTubeUrls('youtu.be/')).toBe('youtu.be/')
    })

    it('should handle URLs with protocol prefixes', () => {
      expect(shortenYouTubeUrls('https://youtube.com/@SomeChannel')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('http://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should handle mixed case YouTube domains', () => {
      expect(shortenYouTubeUrls('YouTube.com/@SomeChannel')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('YOUTU.BE/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs with special characters in identifiers', () => {
      expect(shortenYouTubeUrls('youtube.com/@Channel-Name_123')).toBe('Channel-Name_123')
      expect(shortenYouTubeUrls('youtu.be/abc-123_def')).toBe('abc-123_def')
    })
  })

  describe('Real-world examples', () => {
    it('should handle common YouTube URL patterns', () => {
      // Channel URLs
      expect(shortenYouTubeUrls('youtube.com/@3blue1brown')).toBe('3blue1brown')
      expect(shortenYouTubeUrls('youtube.com/@KhanAcademy')).toBe('KhanAcademy')

      // Video URLs
      expect(shortenYouTubeUrls('youtube.com/watch?v=jNQXAC9IVRw')).toBe('jNQXAC9IVRw')
      expect(shortenYouTubeUrls('youtu.be/jNQXAC9IVRw')).toBe('jNQXAC9IVRw')

      // Playlist URLs
      expect(
        shortenYouTubeUrls('youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr')
      ).toBe('PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr')
    })
  })
})
