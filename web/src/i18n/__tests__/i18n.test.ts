import { describe, expect, it } from 'vitest'

import { translateFragment } from '../i18n'

describe('translateFragment', () => {
  // A route's own anchors: one Slovak and English both name, one only English names
  const routeAnchors = [
    { sk: 'env-veza-z-hanoja', en: 'env-tower-of-hanoi' },
    { en: 'env-english-only' },
  ]

  it('re-spells a site anchor, on a route naming anchors of its own too', () => {
    // English into Slovak, on a route naming none
    expect(translateFragment('comments', 'en', 'sk', undefined)).toBe('komentare')

    // And back, on a route naming its own
    expect(translateFragment('komentare', 'sk', 'en', routeAnchors)).toBe('comments')
  })

  it("re-spells the route's own anchor, dropping one the other locale lacks", () => {
    // An anchor both locales name
    expect(translateFragment('env-tower-of-hanoi', 'en', 'sk', routeAnchors)).toBe(
      'env-veza-z-hanoja'
    )

    // An anchor Slovak doesn't name
    expect(translateFragment('env-english-only', 'en', 'sk', routeAnchors)).toBe('')
  })

  it('keeps any other fragment, unless the route names anchors of its own', () => {
    // On a route naming none, kept as it is
    expect(translateFragment('techniques', 'en', 'sk', undefined)).toBe('techniques')

    // On a route naming its own, dropped
    expect(translateFragment('techniques', 'en', 'sk', routeAnchors)).toBe('')
  })
})
