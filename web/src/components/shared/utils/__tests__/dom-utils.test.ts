import { describe, expect, it } from 'vitest'

import { scrollTopShowing } from '../dom-utils'

describe('scrollTopShowing', () => {
  // A view scrolled 100px down, showing 300px of the content
  const view = { scrollTop: 100, viewHeight: 300 }

  it.each([
    ['in the view leaves it where it is', 250, 250, 100],
    ['above the view brings it just under the top edge', 90, 90, 70],
    ['in the room by the top edge brings it out of the room', 110, 110, 90],
    ['under the view brings it just over the bottom edge', 420, 420, 140],
    ['in the room by the bottom edge brings it out of the room', 390, 390, 110],
    ['reaching above the view brings its top just under the top edge', 80, 120, 60],
    ['reaching under the view brings its bottom just over the bottom edge', 380, 420, 140],
  ])('a stretch %s', (_description, top, bottom, scrollTop) => {
    // Where the view goes for the stretch, with 20px of room
    const next = scrollTopShowing(view, { top, bottom }, 20)

    // At the expected scroll position
    expect(next).toBe(scrollTop)
  })

  it('keeps a short view from swinging between its two edges', () => {
    // A view too short for the room at both its edges, and a spot under it
    const shortView = { scrollTop: 0, viewHeight: 30 }
    const spot = { top: 100, bottom: 100 }

    // Where the view goes for the spot
    const scrollTop = scrollTopShowing(shortView, spot, 20)

    // The view asked again for the same spot, from where it went
    const again = scrollTopShowing({ ...shortView, scrollTop }, spot, 20)

    // The view stays where it went
    expect(again).toBe(scrollTop)
  })
})
