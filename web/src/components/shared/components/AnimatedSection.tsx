'use client'

import { motion, useInView } from 'framer-motion'
import React, { useRef } from 'react'

type AnimatedSectionProps = {
  children: React.ReactNode
  className?: string
  anchorId?: string
}

export default function AnimatedSection({ children, className, anchorId }: AnimatedSectionProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  }

  return (
    <motion.section
      ref={ref}
      id={anchorId}
      className={className}
      data-scroll-section
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  )
}
