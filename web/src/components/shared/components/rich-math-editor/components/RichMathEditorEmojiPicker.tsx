'use client'

import EmojiPicker, { Categories, Theme } from 'emoji-picker-react'
import { Smile } from 'lucide-react'

import { RichMathEditorPicker } from './RichMathEditorPicker'

/**
 * Props for the {@link RichMathEditorEmojiPicker} component.
 */
type RichMathEditorEmojiPickerProps = {
  /** Callback when an emoji is selected */
  onEmojiClick: (emoji: string) => void
}

/**
 * A Slovak-localized emoji picker with Discord/Slack-style dark theme.
 */
export function RichMathEditorEmojiPicker({ onEmojiClick }: RichMathEditorEmojiPickerProps) {
  return (
    <RichMathEditorPicker triggerContent={<Smile size={14} />} triggerTitle="Emoji">
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
          searchPlaceHolder="Hľadať emoji..."
          categories={[
            { category: Categories.SUGGESTED, name: 'Často používané' },
            { category: Categories.SMILEYS_PEOPLE, name: 'Smajlíky a ľudia' },
            { category: Categories.ANIMALS_NATURE, name: 'Zvieratá a príroda' },
            { category: Categories.FOOD_DRINK, name: 'Jedlo a nápoje' },
            { category: Categories.TRAVEL_PLACES, name: 'Cestovanie a miesta' },
            { category: Categories.ACTIVITIES, name: 'Aktivity' },
            { category: Categories.OBJECTS, name: 'Predmety' },
            { category: Categories.SYMBOLS, name: 'Symboly' },
            { category: Categories.FLAGS, name: 'Vlajky' },
          ]}
        />
      )}
    </RichMathEditorPicker>
  )
}
