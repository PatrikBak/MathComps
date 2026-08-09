import { describe, expect, it } from 'vitest'

import { shortenYouTubeUrls, toPlainTextPreview } from '../string-utils'

describe('shortenYouTubeUrls', () => {
  describe('YouTube.com URLs', () => {
    it('should shorten @channel URLs to just the channel name', () => {
      expect(shortenYouTubeUrls('youtube.com/@SomeChannel')).toBe('SomeChannel')
      expect(shortenYouTubeUrls('youtube.com/@3Blue1Brown')).toBe('3Blue1Brown')
      expect(shortenYouTubeUrls('youtube.com/@mathematics')).toBe('mathematics')
      expect(shortenYouTubeUrls('youtube.com/@Channel-Name_123')).toBe('Channel-Name_123')
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
      expect(shortenYouTubeUrls('youtu.be/abc-123_def')).toBe('abc-123_def')
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
  })
})

describe('toPlainTextPreview', () => {
  it('strips math markup so a formula reads as plain text', () => {
    // A message whose content is mostly LaTeX
    const preview = toPlainTextPreview('Take $\\frac{a}{b} \\leq 1$ and square it.')

    // The fraction reads as a division, the comparison keeps its glyph, the words survive
    expect(preview).toBe('Take a/b ≤ 1 and square it.')
  })

  it('keeps the glyph for a command that carries meaning', () => {
    // An opener of the shape students actually write
    const preview = toPlainTextPreview('Let $\\triangle ABC$ have $\\angle A = 60^\\circ$')

    // Each command reads as the character it stands for, and the degree marker loses its script caret
    expect(preview).toBe('Let △ ABC have ∠ A = 60°')
  })

  it('leaves an exponent readable as an exponent', () => {
    // The degree sign is the only script worth resolving; a power is not one
    const preview = toPlainTextPreview('if $P$ were their product, $P^2 + 1$ would be new')

    // The caret survives, so the power does not read as a two-digit number
    expect(preview).toBe('if P were their product, P^2 + 1 would be new')
  })

  it('keeps a degree sign apart from the word behind it', () => {
    // The bare spelling, whose sign is followed by a word rather than by the end of the input
    const bare = toPlainTextPreview('Uhol $60^\\circ$ je ostrý')

    // The braced spelling of the same thing
    const braced = toPlainTextPreview('Uhol $60^{\\circ}$ je ostrý')

    // Both resolve the sign without eating the space behind it
    expect(bare).toBe('Uhol 60° je ostrý')
    expect(braced).toBe('Uhol 60° je ostrý')
  })

  it('reads a fraction whose side holds a group of its own', () => {
    // A denominator carrying a group, which no flat pattern can cross
    const preview = toPlainTextPreview('$\\frac{1}{\\sqrt{2}}$')

    // It still reads as a division, rather than as the product a root beside a digit would be
    expect(preview).toBe('1/√2')
  })

  it('brackets a nested numerator the slash would otherwise read into', () => {
    // A sum standing beside the braces of an exponent
    const preview = toPlainTextPreview('$\\frac{x^{2}+1}{x}$')

    // The whole sum is held together, so the slash cannot take only its last term
    expect(preview).toBe('(x^2+1)/x')
  })

  it('reads a fraction side standing for a single character', () => {
    // A constant whose whole side is one command
    const preview = toPlainTextPreview('$\\frac{\\pi}{2}$ radiánov')

    // The side reads as its glyph, so the division has both of its sides
    expect(preview).toBe('π/2 radiánov')
  })

  it('drops a fraction whose side reads as nothing at all', () => {
    // A numerator that is one command the preview has no character for
    const preview = toPlainTextPreview('$\\frac{\\lambda}{2}$ zostáva')

    // The fraction goes whole, rather than opening the preview with a bare slash
    expect(preview).toBe('zostáva')
  })

  it('keeps an elision readable between its operators', () => {
    // A sum with an elision standing between two operators
    const preview = toPlainTextPreview('$1 + 2 + \\dotsb + n = \\frac{n(n+1)}{2}$')

    // The elision reads as one, and the fraction as a division
    expect(preview).toBe('1 + 2 + … + n = n(n+1)/2')
  })

  it('brackets a fraction the slash would otherwise read into', () => {
    // A sum over a number, where a bare slash would take only the last term
    const preview = toPlainTextPreview('$\\frac{a+b}{2}$ and $\\frac{1}{n-1}$')

    // Each loose side is held together, so neither reads as a different formula
    expect(preview).toBe('(a+b)/2 and 1/(n-1)')
  })

  it('leaves a fraction alone when a slash cannot change what it means', () => {
    // A leading sign belongs to its term, and an operator inside brackets is already held
    const preview = toPlainTextPreview('$\\frac{-a}{2}$ and $\\frac{n(n+1)}{2}$')

    // Nothing gained a bracket it did not need
    expect(preview).toBe('-a/2 and n(n+1)/2')
  })

  it('brackets a nested fraction so the two slashes cannot merge', () => {
    // A fraction over a fraction, where two bare slashes in a row read as one denominator
    const preview = toPlainTextPreview('$\\frac{a}{\\frac{b}{c}}$ and $\\frac{\\frac{a}{b}}{c}$')

    // The inner division is held together, so ac/b does not read as a/(bc)
    expect(preview).toBe('a/(b/c) and (a/b)/c')
  })

  it('spaces an operator glyph off both of its terms', () => {
    // The spelling that leans on the space closing the command name, which the name takes with it
    const preview = toPlainTextPreview('$n\\ge 3$ and $a\\cdot b$')

    // Each operator stands clear of the terms on either side
    expect(preview).toBe('n ≥ 3 and a · b')
  })

  it('reads the smaller fraction commands as divisions too', () => {
    // The inline and continued forms, which the generic pass would flatten into a digit run
    const preview = toPlainTextPreview('$\\tfrac{1}{2}$ and $\\cfrac{3}{4}$')

    // Both read as divisions
    expect(preview).toBe('1/2 and 3/4')
  })

  it('drops a command named like a prototype member', () => {
    // A command whose name a bare lookup would resolve to an inherited member
    const preview = toPlainTextPreview('a \\constructor b')

    // It is dropped like any other command that stands for nothing
    expect(preview).toBe('a b')
  })

  it('drops a formatting command without fusing the words around it', () => {
    // Emphasis carries no meaning in a one-line preview
    const preview = toPlainTextPreview('the \\textbf{second} player wins')

    // The word survives, the command does not, and nothing runs together
    expect(preview).toBe('the second player wins')
  })

  it('collapses whitespace and trims', () => {
    // A message broken over lines
    const preview = toPlainTextPreview('  first line\n\n  second   line  ')

    // One line, single-spaced
    expect(preview).toBe('first line second line')
  })
})
