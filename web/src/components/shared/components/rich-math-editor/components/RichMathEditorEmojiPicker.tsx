'use client'

import EmojiPicker, { Categories, Theme } from 'emoji-picker-react'
import { Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RichMathEditorPicker } from './RichMathEditorPicker'

/**
 * Props for the {@link RichMathEditorEmojiPicker} component.
 */
type RichMathEditorEmojiPickerProps = {
  /** Callback when an emoji is selected */
  onEmojiClick: (emoji: string) => void
}

/**
 * A localized emoji picker with Discord/Slack-style dark theme.
 */
export function RichMathEditorEmojiPicker({ onEmojiClick }: RichMathEditorEmojiPickerProps) {
  // Get translations
  const tEmojiPicker = useTranslations('ui.editor.emojiPicker')
  const tCategories = useTranslations('ui.editor.emojiPicker.categories')

  return (
    <RichMathEditorPicker triggerContent={<Smile size={14} />} triggerTitle={tEmojiPicker('title')}>
      {({ close }) => (
        <EmojiPicker
          theme={Theme.DARK}
          onEmojiClick={(data) => {
            onEmojiClick(data.emoji)
            close()
          }}
          searchDisabled={true}
          skinTonesDisabled={true}
          lazyLoadEmojis={true}
          width={320}
          height={400}
          previewConfig={{ showPreview: false }}
          searchPlaceHolder={tEmojiPicker('searchPlaceholder')}
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
