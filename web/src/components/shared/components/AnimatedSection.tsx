'use client'

import { motion, useInView } from 'framer-motion'
import React, { useRef } from 'react'

/**
 * The props for the {@link AnimatedSection} component.
 */
type AnimatedSectionProps = {
  /** The children to render inside the section */
  children: React.ReactNode
  /** Optional additional className for the section */
  className?: string
  /** Optional anchor ID for scroll navigation */
  id?: string
}

/**
 * Animated section component using Framer Motion.
 */
export default function AnimatedSection({ children, className, id }: AnimatedSectionProps) {
  // The ref for the section element
  const ref = useRef(null)

  // Use Framer Motion to detect when the section is in view
  const isInView = useInView(ref, { once: true })

  // The section will be told to be hidden or visible based on whether in view
  const variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  }

  // Return the fade-in-animated section
  return (
    <motion.section
      ref={ref}
      className={className}
      id={id}
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
