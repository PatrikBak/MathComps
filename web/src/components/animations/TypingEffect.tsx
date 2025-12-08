'use client'

import { useEffect, useState } from 'react'

interface TypingEffectProps {
  text: string
  speed?: number
  delay?: number
  className?: string
}

const TypingEffect = ({ text, speed = 25, delay = 300, className = '' }: TypingEffectProps) => {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(
        () => {
          setDisplayText((prev) => prev + text.charAt(currentIndex))
          setCurrentIndex((prev) => prev + 1)
        },
        currentIndex === 0 ? delay : speed
      )

      return () => clearTimeout(timer)
    } else {
      setIsComplete(true)
    }
  }, [currentIndex, text, speed, delay])

  // Reset when text changes
  useEffect(() => {
    setDisplayText('')
    setCurrentIndex(0)
    setIsComplete(false)
  }, [text])

  return (
    <span className={className}>
      {displayText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  )
}

export default TypingEffect
