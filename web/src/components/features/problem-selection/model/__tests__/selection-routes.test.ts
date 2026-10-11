import { describe, expect, it } from 'vitest'

import {
  detailHref,
  detailOf,
  detailQuery,
  PAPER_TABS,
  PROPOSAL_TABS,
  tabOf,
} from '../selection-routes'

describe('detailOf', () => {
  it('opens a problem, and a paper the address names beside it waits', () => {
    // An address naming both
    const params = new URLSearchParams('problem=p4&paper=e1')

    // The page it opens
    const detail = detailOf(params)

    // The problem's
    expect(detail).toEqual({ kind: 'proposal', id: 'p4' })
  })

  it('reads back the paper page an address was written for', () => {
    // A paper's page on its comments, written out as an address
    const query = detailQuery({ kind: 'paper', id: 'e1', tab: 'comments' })

    // The page the address opens
    const detail = detailOf(new URLSearchParams(query))

    // The same paper
    expect(detail).toEqual({ kind: 'paper', id: 'e1' })
  })
})

describe('tabOf', () => {
  it('opens the tab the address names, where the page has it', () => {
    // A paper's address naming its comments
    const params = new URLSearchParams('paper=e1&tab=comments')

    // The tab the paper opens on
    const tab = tabOf(params, PAPER_TABS)

    // The comments
    expect(tab).toBe('comments')
  })

  it('opens the first tab for a tab only another page has', () => {
    // A paper's address naming a problem page's tab
    const params = new URLSearchParams('paper=e1&tab=conversations')

    // The tab the paper opens on
    const paperTab = tabOf(params, PAPER_TABS)

    // The tab a problem would open on
    const proposalTab = tabOf(params, PROPOSAL_TABS)

    // The paper's first tab, while a problem keeps the one named
    expect(paperTab).toBe('problems')
    expect(proposalTab).toBe('conversations')
  })
})

describe('detailHref', () => {
  it('opens a problem over the paper the address names, and a paper alone', () => {
    // A problem's link, on a page whose address names the paper e1
    const problemHref = detailHref({ kind: 'proposal', id: 'p4', tab: 'comments' }, 'e1')

    // Another paper's link, on the same page
    const paperHref = detailHref({ kind: 'paper', id: 'i1', tab: undefined }, 'e1')

    // The problem over e1, and the other paper with nothing beneath it
    expect(problemHref.query).toEqual({ problem: 'p4', tab: 'comments', paper: 'e1' })
    expect(paperHref.query).toEqual({ paper: 'i1' })
  })
})
