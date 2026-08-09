import { describe, expect, it } from 'vitest'

import { resolveSideTabId } from '../defense-review-tabs'

describe('resolveSideTabId', () => {
  it('sends the reference elsewhere once it has a column of its own', () => {
    // A reader who picked the reference on a narrow screen, now looking at a wide one
    expect(resolveSideTabId('reference', true)).toBe('config')

    // And the conversation, which is never beside itself
    expect(resolveSideTabId('conversation', true)).toBe('config')
  })

  it('rests on the reference while it is still a tab', () => {
    // The narrow screen, where the reference is one of the parts read in turn
    expect(resolveSideTabId('reference', false)).toBe('reference')

    // And the conversation, which the reference stands beside
    expect(resolveSideTabId('conversation', false)).toBe('reference')
  })

  it('leaves a part that stands beside the conversation whatever the viewport gives', () => {
    // Neither of these ever stops being a tab, so the column changes nothing for them
    expect(resolveSideTabId('config', true)).toBe('config')
    expect(resolveSideTabId('notes', true)).toBe('notes')
    expect(resolveSideTabId('notes', false)).toBe('notes')
  })
})
