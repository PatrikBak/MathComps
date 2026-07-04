'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
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
  /** Skip the entrance fade and render visible immediately */
  eager?: boolean
}

/**
 * Animated section component using Framer Motion.
 */
export default function AnimatedSection({ children, className, id, eager }: AnimatedSectionProps) {
  // The ref for the section element
  const ref = useRef(null)

  // Use Framer Motion to detect when the section is in view
  const isInView = useInView(ref, { once: true })

  // Whether the user asked to reduce motion
  const prefersReducedMotion = useReducedMotion()

  // Eager (above-the-fold) or reduced-motion sections render visible with no fade
  const immediate = eager || Boolean(prefersReducedMotion)

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
      initial={immediate ? 'visible' : 'hidden'}
      animate={immediate || isInView ? 'visible' : 'hidden'}
      transition={immediate ? { duration: 0 } : { duration: 1, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  )
}
