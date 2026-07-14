'use client'

import { useElementSize, useInViewport, useMergedRef, useReducedMotion } from '@mantine/hooks'
import { useEffect, useRef } from 'react'

import { useIsMobile } from '@/hooks/use-breakpoint'

/**
 * A single drifting glow particle in the hero field.
 */
type Particle = {
  /** Horizontal position in CSS pixels */
  x: number
  /** Vertical position in CSS pixels */
  y: number
  /** Horizontal velocity, tuned per {@link TUNED_FRAME_MS} tick */
  vx: number
  /** Vertical velocity, tuned per {@link TUNED_FRAME_MS} tick */
  vy: number
  /** Per-particle glow alpha */
  opacity: number
}

/** How many particles to render on desktop. */
const DESKTOP_COUNT = 42

/** How many particles to render on phones, kept lower so the animation stays smooth. */
const MOBILE_COUNT = 20

/**
 * The tick length (ms) the velocities are tuned against. Motion is scaled by the real frame delta
 * over this, so drift speed stays the same on 60Hz, 120Hz, or a stuttering frame.
 */
const TUNED_FRAME_MS = 30

/**
 * Clamp for the per-frame delta (ms) so a backgrounded-then-resumed tab doesn't teleport particles
 * forward by the whole hidden duration.
 */
const MAX_DELTA_MS = 50

/**
 * Seed a fresh particle field sized to the canvas.
 *
 * @param width - Canvas width in CSS pixels
 * @param height - Canvas height in CSS pixels
 * @param count - How many particles to create
 * @returns The randomized particle set
 */
function createParticles(width: number, height: number, count: number): Particle[] {
  // One randomly-seeded particle per requested count
  return Array.from({ length: count }, () => ({
    // Random spot across the width
    x: Math.random() * width,
    // Random spot across the height
    y: Math.random() * height,
    // Small signed horizontal drift (±0.15/tick)
    vx: (Math.random() - 0.5) * 0.3,
    // Small signed vertical drift (±0.15/tick)
    vy: (Math.random() - 0.5) * 0.3,
    // Base glow alpha in the 0.3–0.7 range
    opacity: 0.3 + Math.random() * 0.4,
  }))
}

/**
 * Pre-render the soft glow sprite once, so each particle is a cheap {@link CanvasRenderingContext2D.drawImage}
 * per frame. Returns null where {@link OffscreenCanvas} isn't available.
 *
 * @param glow - The color of the glow sprite.
 *
 * @returns The cached sprite, or null when the platform can't provide one
 */
function createParticleTemplate(glow: string): OffscreenCanvas | null {
  // Bail where OffscreenCanvas isn't supported
  if (typeof OffscreenCanvas === 'undefined') return null

  // Fixed 20px sprite
  const size = 20

  // The offscreen canvas the sprite is drawn onto
  const canvas = new OffscreenCanvas(size, size)

  // Its 2D drawing context
  const context = canvas.getContext('2d')

  // Bail if the context is unavailable
  if (!context) return null

  // A radial gradient running from the center out to the edge
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)

  // Full glow color at the center
  gradient.addColorStop(0, glow)

  // Fading to transparent at the rim
  gradient.addColorStop(1, 'transparent')

  // Lay the halo down at half strength
  context.globalAlpha = 0.5

  // Paint with the gradient
  context.fillStyle = gradient

  // Fill the sprite square with the halo
  context.fillRect(0, 0, size, size)

  // Back to full strength for the core
  context.globalAlpha = 1

  // Start a fresh path
  context.beginPath()

  // A 3px circle at the center
  context.arc(size / 2, size / 2, 3, 0, Math.PI * 2)

  // Solid glow color for the core
  context.fillStyle = glow

  // Fill the core dot
  context.fill()

  // Hand back the sprite to cache
  return canvas
}

/**
 * A drifting field of soft violet particles behind the hero. Sizes itself to its box via a
 * ResizeObserver, pauses when scrolled off-screen or in a hidden tab, and renders nothing at all
 * under a reduced-motion preference.
 */
export default function ParticleSystem() {
  // Thin the field on small screens
  const isMobile = useIsMobile()

  // Whether the visitor asked for reduced motion
  const reducedMotion = useReducedMotion()

  // The measured canvas box
  const { ref: sizeRef, width, height } = useElementSize<HTMLCanvasElement>()

  // Whether the hero is on screen, so the loop can rest while scrolled away
  const { ref: inViewRef, inViewport } = useInViewport<HTMLCanvasElement>()

  // The drawing surface
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // One ref feeding drawing, sizing, and visibility
  const mergedRef = useMergedRef(canvasRef, sizeRef, inViewRef)

  // The current particle field, mutated in place each frame
  const particlesRef = useRef<Particle[]>([])

  // The cached glow sprite, created once
  const templateRef = useRef<OffscreenCanvas | null>(null)

  // Size the backing store and seed a fresh field whenever the box or device changes
  useEffect(() => {
    // The mounted canvas element
    const canvas = canvasRef.current

    // Wait until the canvas has been measured
    if (!canvas || width === 0 || height === 0) return

    // Grab the 2D context
    const context = canvas.getContext('2d', { alpha: true })

    // Bail if the context is unavailable
    if (!context) return

    // Device pixel ratio, defaulting to 1
    const dpr = window.devicePixelRatio || 1

    // Backing-store width at device resolution
    canvas.width = width * dpr

    // Backing-store height at device resolution
    canvas.height = height * dpr

    // Draw in CSS pixels regardless of DPR
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Seed the field for this size and device
    particlesRef.current = createParticles(width, height, isMobile ? MOBILE_COUNT : DESKTOP_COUNT)
  }, [width, height, isMobile])

  // Run the animation loop while on-screen and motion is welcome
  useEffect(() => {
    // Idle while motion is unwelcome, off-screen, or before the canvas is measured
    if (reducedMotion || !inViewport || width === 0 || height === 0) return

    // The mounted canvas element
    const canvas = canvasRef.current

    // Bail before it's mounted
    if (!canvas) return

    // Its 2D context
    const context = canvas.getContext('2d', { alpha: true })

    // Bail if the context is unavailable
    if (!context) return

    // Reuse the cached sprite, creating it (in the theme's glow color) on first need
    const template = (templateRef.current ??= createParticleTemplate(
      getComputedStyle(document.documentElement).getPropertyValue('--color-glow').trim()
    ))

    // Handle for the pending animation frame, so it can be cancelled
    let rafId = 0

    // Timestamp of the previous frame, null until the first one seeds it
    let previous: number | null = null

    // Draw one frame and queue the next
    const renderFrame = (now: number) => {
      // Seed the clock on the first frame without advancing
      if (previous === null) previous = now

      // Elapsed since the last frame, clamped against tab-resume jumps
      const delta = Math.min(now - previous, MAX_DELTA_MS)
      previous = now

      // Scale motion to the tuned tick so speed is refresh-rate independent
      const stepScale = delta / TUNED_FRAME_MS

      // Wipe the previous frame
      context.clearRect(0, 0, width, height)

      // Drift and stamp each particle
      particlesRef.current.forEach((particle) => {
        // Advance by velocity, time-scaled
        particle.x += particle.vx * stepScale
        particle.y += particle.vy * stepScale

        // Wrap across the horizontal edges
        if (particle.x < -10) particle.x = width + 10
        else if (particle.x > width + 10) particle.x = -10

        // Wrap across the vertical edges
        if (particle.y < -10) particle.y = height + 10
        else if (particle.y > height + 10) particle.y = -10

        // Stamp the glow sprite, once the cache exists
        if (template) {
          // Fade the stamp to this particle's alpha
          context.globalAlpha = particle.opacity

          // Draw the 20px sprite centered on the particle
          context.drawImage(template, particle.x - 10, particle.y - 10, 20, 20)
        }
      })

      // Queue the next frame
      rafId = requestAnimationFrame(renderFrame)
    }

    // Kick off the loop
    rafId = requestAnimationFrame(renderFrame)

    // Stop on unmount, resize, scroll-away, or a reduced-motion switch
    return () => cancelAnimationFrame(rafId)
  }, [inViewport, reducedMotion, width, height])

  // Draw nothing at all for reduced motion
  if (reducedMotion) return null

  // The canvas fills its positioned parent behind the hero content
  return (
    <canvas
      ref={mergedRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
