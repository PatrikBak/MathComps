'use client'

import { useMediaQuery, useWindowEvent } from '@mantine/hooks'
import React, { useCallback, useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

export default function ParticleSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)
  const canvasDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  // Detect mobile devices to reduce particle count for better performance
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Initialize particles
  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = []

      // Use fewer particles on mobile devices for better performance
      const particleCount = isMobile ? 20 : 42

      // Pre-calculate random values
      const randomValues = new Array(particleCount * 6).fill(0).map(() => Math.random())

      // Initialize initial position
      for (let i = 0; i < particleCount; i++) {
        const baseIndex = i * 6
        particles.push({
          x: randomValues[baseIndex] * width,
          y: randomValues[baseIndex + 1] * height,
          vx: (randomValues[baseIndex + 2] - 0.5) * 0.3,
          vy: (randomValues[baseIndex + 3] - 0.5) * 0.3,
          size: 1.5 + randomValues[baseIndex + 4],
          opacity: 0.3 + randomValues[baseIndex + 5] * 0.4,
        })
      }

      // Particles done
      particlesRef.current = particles
    },
    [isMobile]
  )

  // Create pre-rendered particle template (cached to avoid recreation)
  const particleTemplateRef = useRef<OffscreenCanvas | null>(null)

  const createParticleTemplate = useCallback(() => {
    // Return cached template if already created
    if (particleTemplateRef.current) return particleTemplateRef.current

    if (typeof OffscreenCanvas === 'undefined') return null

    const size = 20
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext('2d')
    if (!context) return null

    // Draw glow
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    )
    gradient.addColorStop(0, 'rgba(167, 139, 250, 0.5)')
    gradient.addColorStop(1, 'transparent')

    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    // Draw particle
    context.beginPath()
    context.arc(size / 2, size / 2, 3, 0, Math.PI * 2)
    context.fillStyle = 'rgba(167, 139, 250, 1)'
    context.fill()

    // Cache the template
    particleTemplateRef.current = canvas
    return canvas
  }, [])

  // Set canvas size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Only resize if dimensions actually changed
    const newWidth = rect.width
    const newHeight = rect.height

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    // Cache dimensions to avoid expensive getBoundingClientRect calls
    canvasDimensionsRef.current = { width: newWidth, height: newHeight }

    // Set actual size in memory
    canvas.width = newWidth * dpr
    canvas.height = newHeight * dpr

    // Scale the context to ensure correct drawing
    context.scale(dpr, dpr)

    // Set CSS size
    canvas.style.width = newWidth + 'px'
    canvas.style.height = newHeight + 'px'

    // Reinitialize particles on resize
    initParticles(newWidth, newHeight)
  }, [initParticles])

  // Handle resize with debouncing
  const resizeTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  // Redraw this often
  const frameInterval = 30

  useWindowEvent(
    'resize',
    useCallback(() => {
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current)
      resizeTimeout.current = setTimeout(resizeCanvas, 150)
    }, [resizeCanvas])
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d', {
      alpha: true,
    })
    if (!context) return

    // Pre-cCreate particle template for performance
    const particleTemplate = createParticleTemplate()

    // Animation loop using setTimeout for true frame rate control
    const animate = () => {
      // Check if still mounted and valid
      if (!canvasRef.current || !context) {
        // Ensure more animations are not accidentally run at the same time
        if (animationFrameRef.current) {
          clearTimeout(animationFrameRef.current)
          animationFrameRef.current = undefined
        }
        return
      }

      // Use cached dimensions
      const width = canvasDimensionsRef.current.width
      const height = canvasDimensionsRef.current.height

      // Clear canvas
      context.clearRect(0, 0, width, height)

      // Batch particle rendering
      context.save()

      // Animate each particle
      particlesRef.current.forEach((particle) => {
        // Update position
        particle.x += particle.vx
        particle.y += particle.vy

        // Wrap around edges X
        if (particle.x < -10) particle.x = width + 10
        else if (particle.x > width + 10) particle.x = -10

        // Wrap around edges Z
        if (particle.y < -10) particle.y = height + 10
        else if (particle.y > height + 10) particle.y = -10

        // Draw particle
        if (particleTemplate) {
          context.globalAlpha = particle.opacity
          context.drawImage(particleTemplate, particle.x - 10, particle.y - 10, 20, 20)
        }
      })

      // No idea why?
      context.restore()

      // Schedule next frame
      animationFrameRef.current = setTimeout(animate, frameInterval) as unknown as number
    }

    // Initialize
    resizeCanvas()
    animationFrameRef.current = setTimeout(animate, frameInterval) as unknown as number

    // The cleanup cleans up timers
    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current)
      }
    }
  }, [resizeCanvas, isMobile, createParticleTemplate])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  )
}
