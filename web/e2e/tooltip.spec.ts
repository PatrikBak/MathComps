import { expect, test } from './support/test'

/** The dev page showing a tooltip whose content grows once open. */
const HARNESS_PATH = '/en/dev/tooltip'

/** A screen with room above the harness's trigger for the whole tooltip, and too little below it. */
const VIEWPORT = { width: 800, height: 600 }

test.describe('tooltip', () => {
  test('moves above its trigger, whole, once its content outgrows the room below', async ({
    page,
  }) => {
    // A screen with room above the trigger
    await page.setViewportSize(VIEWPORT)

    // The harness
    await page.goto(HARNESS_PATH)

    // The trigger
    const trigger = page.getByRole('button', { name: 'Show the tooltip' })

    // Hovered
    await trigger.hover()

    // The tooltip
    const tooltip = page.getByRole('tooltip')

    // Open
    await expect(tooltip).toBeVisible()

    // Above its trigger, with nothing of its content cut away
    await expect
      .poll(async () => {
        // The trigger's top edge
        const triggerTop = await trigger.evaluate((button) => button.getBoundingClientRect().top)

        // Whether the tooltip ends above that edge and shows the whole of its content
        return tooltip.evaluate(
          (element, edge) =>
            element.getBoundingClientRect().bottom <= edge &&
            element.scrollHeight <= element.clientHeight,
          triggerTop
        )
      })
      .toBe(true)
  })
})
