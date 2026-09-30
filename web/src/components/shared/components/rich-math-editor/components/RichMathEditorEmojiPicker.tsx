'use client'

import EmojiPicker, { Categories, Theme } from 'emoji-picker-react'
import { Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RichMathEditorPicker } from './RichMathEditorPicker'

/**
 * Props for the {@link RichMathEditorEmojiPicker} component.
 */
type RichMathEditorEmojiPickerProps = {
  /** Whether the picker's button is a row of a list */
  isRow: boolean
  /** Callback when an emoji is selected */
  onEmojiClick: (emoji: string) => void
}

/**
 * A tool of the editor's toolbar picking an emoji to write into the text, its categories named in the
 * reader's language.
 */
export function RichMathEditorEmojiPicker({ isRow, onEmojiClick }: RichMathEditorEmojiPickerProps) {
  // The picker's translations, and its categories'
  const tEmojiPicker = useTranslations('ui.editor.emojiPicker')
  const tCategories = useTranslations('ui.editor.emojiPicker.categories')

  return (
    <RichMathEditorPicker
      mark={<Smile />}
      title={tEmojiPicker('title')}
      isRow={isRow}
      popupClassName="w-80 overflow-hidden"
    >
      {(close) => (
        <EmojiPicker
          theme={Theme.DARK}
          onEmojiClick={(data) => {
            // The panel closes first
            close()

            // And the picked emoji is handed over
            onEmojiClick(data.emoji)
          }}
          searchDisabled={true}
          skinTonesDisabled={true}
          lazyLoadEmojis={true}
          // As wide as its panel, which a screen narrower than the panel cuts down
          width="100%"
          height={400}
          previewConfig={{ showPreview: false }}
          categories={[
            { category: Categories.SUGGESTED, name: tCategories('suggested') },
            { category: Categories.SMILEYS_PEOPLE, name: tCategories('smileys') },
            { category: Categories.ANIMALS_NATURE, name: tCategories('animals') },
            { category: Categories.FOOD_DRINK, name: tCategories('food') },
            { category: Categories.TRAVEL_PLACES, name: tCategories('travel') },
            { category: Categories.ACTIVITIES, name: tCategories('activities') },
            { category: Categories.OBJECTS, name: tCategories('objects') },
            { category: Categories.SYMBOLS, name: tCategories('symbols') },
            { category: Categories.FLAGS, name: tCategories('flags') },
          ]}
        />
      )}
    </RichMathEditorPicker>
  )
}
