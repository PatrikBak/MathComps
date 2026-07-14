'use client'

import { useMounted, useReducedMotion } from '@mantine/hooks'
import { createPortal } from 'react-dom'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Global keyframes and per-layer styles for the floating-math field.
 */
const FloatingMathStyles = () => (
  <style jsx global>{`
    @keyframes containerPulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.95;
      }
    }

    @keyframes floatPrimary {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.8);
        opacity: 0;
      }
      5% {
        transform: translateY(90vh) translateX(0px) rotate(10deg) scale(1);
        opacity: 1;
      }
      25% {
        transform: translateY(70vh) translateX(20px) rotate(90deg) scale(1.1);
      }
      50% {
        transform: translateY(45vh) translateX(-15px) rotate(180deg) scale(0.9);
      }
      75% {
        transform: translateY(20vh) translateX(25px) rotate(270deg) scale(1.05);
      }
      95% {
        transform: translateY(0vh) translateX(-10px) rotate(350deg) scale(0.8);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(360deg) scale(0.6);
        opacity: 0;
      }
    }

    @keyframes floatSecondary {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.7);
        opacity: 0;
      }
      8% {
        transform: translateY(88vh) translateX(0px) rotate(-15deg) scale(1);
        opacity: 1;
      }
      30% {
        transform: translateY(65vh) translateX(-30px) rotate(-120deg) scale(1.2);
      }
      50% {
        transform: translateY(45vh) translateX(20px) rotate(-180deg) scale(0.85);
      }
      70% {
        transform: translateY(25vh) translateX(-25px) rotate(-240deg) scale(1.1);
      }
      92% {
        transform: translateY(3vh) translateX(15px) rotate(-345deg) scale(0.75);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(-360deg) scale(0.5);
        opacity: 0;
      }
    }

    @keyframes floatTertiary {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.6);
        opacity: 0;
      }
      6% {
        transform: translateY(90vh) translateX(0px) rotate(20deg) scale(1);
        opacity: 1;
      }
      20% {
        transform: translateY(75vh) translateX(15px) rotate(80deg) scale(1.3);
      }
      40% {
        transform: translateY(55vh) translateX(-20px) rotate(160deg) scale(0.8);
      }
      60% {
        transform: translateY(35vh) translateX(25px) rotate(240deg) scale(1.15);
      }
      80% {
        transform: translateY(15vh) translateX(-15px) rotate(320deg) scale(0.9);
      }
      94% {
        transform: translateY(1vh) translateX(10px) rotate(380deg) scale(0.65);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(400deg) scale(0.4);
        opacity: 0;
      }
    }

    @keyframes floatQuaternary {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.5);
        opacity: 0;
      }
      7% {
        transform: translateY(88vh) translateX(0px) rotate(-25deg) scale(1);
        opacity: 1;
      }
      35% {
        transform: translateY(60vh) translateX(-35px) rotate(-140deg) scale(1.4);
      }
      50% {
        transform: translateY(45vh) translateX(30px) rotate(-200deg) scale(0.7);
      }
      65% {
        transform: translateY(30vh) translateX(-20px) rotate(-260deg) scale(1.2);
      }
      93% {
        transform: translateY(2vh) translateX(12px) rotate(-355deg) scale(0.6);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(-380deg) scale(0.3);
        opacity: 0;
      }
    }

    @keyframes floatHighlight {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.8);
        opacity: 0;
      }
      5% {
        transform: translateY(90vh) translateX(0px) rotate(15deg) scale(1);
        opacity: 1;
      }
      25% {
        transform: translateY(70vh) translateX(30px) rotate(105deg) scale(1.3);
      }
      50% {
        transform: translateY(45vh) translateX(-20px) rotate(195deg) scale(0.9);
      }
      75% {
        transform: translateY(20vh) translateX(35px) rotate(285deg) scale(1.2);
      }
      95% {
        transform: translateY(0vh) translateX(-15px) rotate(375deg) scale(0.8);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(390deg) scale(0.6);
        opacity: 0;
      }
    }

    @keyframes floatGeometric {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.7);
        opacity: 0;
      }
      5% {
        transform: translateY(90vh) translateX(0px) rotate(-20deg) scale(1);
        opacity: 1;
      }
      20% {
        transform: translateY(75vh) translateX(25px) rotate(-80deg) scale(1.4);
      }
      40% {
        transform: translateY(55vh) translateX(-30px) rotate(-160deg) scale(0.8);
      }
      60% {
        transform: translateY(35vh) translateX(40px) rotate(-240deg) scale(1.3);
      }
      80% {
        transform: translateY(15vh) translateX(-25px) rotate(-320deg) scale(0.9);
      }
      95% {
        transform: translateY(0vh) translateX(15px) rotate(-380deg) scale(0.7);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(-400deg) scale(0.5);
        opacity: 0;
      }
    }

    @keyframes floatMagnetic {
      0% {
        transform: translateY(100vh) translateX(0px) rotate(0deg) scale(0.8);
        opacity: 0;
      }
      5% {
        transform: translateY(90vh) translateX(0px) rotate(10deg) scale(1);
        opacity: 1;
      }
      25% {
        transform: translateY(70vh) translateX(60px) rotate(90deg) scale(1.1);
      }
      35% {
        transform: translateY(60vh) translateX(20px) rotate(130deg) scale(1.2);
      }
      50% {
        transform: translateY(45vh) translateX(-40px) rotate(180deg) scale(0.9);
      }
      65% {
        transform: translateY(30vh) translateX(50px) rotate(230deg) scale(1.15);
      }
      75% {
        transform: translateY(20vh) translateX(10px) rotate(270deg) scale(1.05);
      }
      95% {
        transform: translateY(0vh) translateX(-10px) rotate(350deg) scale(0.8);
        opacity: 1;
      }
      100% {
        transform: translateY(-10vh) translateX(0px) rotate(360deg) scale(0.6);
        opacity: 0;
      }
    }

    /* Component Styles */
    .floating-math-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 1;
      animation: containerPulse 8s ease-in-out infinite;
      transition: opacity 0.3s ease-in-out;
    }

    .floating-math {
      position: absolute;
      font-family: 'Times New Roman', serif;
      font-weight: 400;
      pointer-events: none;
      user-select: none;
      will-change: transform;
      transform: translateY(90vh);
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    .floating-math.layer-1 {
      font-size: 2.5rem;
      color: color-mix(in srgb, var(--color-brand) 25%, transparent);
      animation-name: floatPrimary;
      animation-duration: 10s;
      animation-iteration-count: infinite;
      z-index: 4;
    }
    .floating-math.layer-2 {
      font-size: 2rem;
      color: color-mix(in srgb, var(--color-glow) 15%, transparent);
      animation-name: floatSecondary;
      animation-duration: 12s;
      animation-iteration-count: infinite;
      z-index: 3;
    }
    .floating-math.layer-3 {
      font-size: 1.5rem;
      color: color-mix(in srgb, var(--color-brand-light) 12%, transparent);
      animation-name: floatTertiary;
      animation-duration: 14s;
      animation-iteration-count: infinite;
      z-index: 2;
    }
    .floating-math.layer-4 {
      font-size: 1.8rem;
      color: color-mix(in srgb, var(--color-brand) 8%, transparent);
      animation-name: floatQuaternary;
      animation-duration: 13s;
      animation-iteration-count: infinite;
      z-index: 1;
    }

    .floating-math.highlight-number {
      color: color-mix(in srgb, var(--color-glow-warm) 15%, transparent) !important;
      font-weight: 600;
      text-shadow: 0 0 10px color-mix(in srgb, var(--color-glow-warm) 30%, transparent);
      animation-name: floatHighlight !important;
    }
    .floating-math.geometric {
      color: color-mix(in srgb, var(--color-glow-cool) 12%, transparent) !important;
      font-size: 1.2em !important;
      text-shadow: 0 0 8px color-mix(in srgb, var(--color-glow-cool) 20%, transparent);
      animation-name: floatGeometric !important;
    }

    .floating-math.magnetic {
      animation-name: floatMagnetic !important;
    }

    @media (max-width: 768px) {
      .floating-math.layer-1 {
        font-size: 1.8rem;
      }
      .floating-math.layer-2 {
        font-size: 1.4rem;
      }
      .floating-math.layer-3 {
        font-size: 1.1rem;
      }
      .floating-math.layer-4 {
        font-size: 1.3rem;
      }
    }

    @media (max-width: 480px) {
      .floating-math.layer-1 {
        font-size: 1.5rem;
      }
      .floating-math.layer-2 {
        font-size: 1.2rem;
      }
      .floating-math.layer-3 {
        font-size: 0.9rem;
      }
      .floating-math.layer-4 {
        font-size: 1.1rem;
      }
    }
  `}</style>
)

/**
 * The data for a single symbol being animated
 */
type FloatingMathSymbolDef = {
  /** The symbol to display */
  symbol: string
  /** Which depth layer (1-4) the symbol sits in. */
  layer: 1 | 2 | 3 | 4
  /** The left position of the symbol, as a CSS value */
  left: string
  /** The animation delay of the symbol, as a CSS value */
  animationDelay?: string
  /** Custom class to apply to the symbol */
  className?: string
}

/**
 * The symbols being animated
 */
const mathSymbols: FloatingMathSymbolDef[] = [
  { symbol: '∫', layer: 1, left: '8%', animationDelay: '0.05s' },
  {
    symbol: '42',
    layer: 1,
    left: '25%',
    className: 'highlight-number',
    animationDelay: '0.1s',
  },
  { symbol: 'π', layer: 1, left: '45%', animationDelay: '0.15s' },
  { symbol: '∞', layer: 1, left: '65%', animationDelay: '0.2s' },
  { symbol: '∑', layer: 1, left: '85%', animationDelay: '0.25s' },

  { symbol: '∃', layer: 2, left: '15%', animationDelay: '0.1s' },
  {
    symbol: '42',
    layer: 2,
    left: '35%',
    className: 'highlight-number',
    animationDelay: '0.15s',
  },
  {
    symbol: '◊',
    layer: 2,
    left: '55%',
    className: 'geometric',
    animationDelay: '0.2s',
  },
  { symbol: '∈', layer: 2, left: '75%', animationDelay: '0.25s' },
  { symbol: '∀', layer: 2, left: '90%', animationDelay: '0.3s' },

  {
    symbol: '△',
    layer: 3,
    left: '20%',
    className: 'geometric',
    animationDelay: '0.15s',
  },
  { symbol: 'β', layer: 3, left: '40%', animationDelay: '0.2s' },
  {
    symbol: '42',
    layer: 3,
    left: '60%',
    className: 'highlight-number',
    animationDelay: '0.25s',
  },
  { symbol: 'θ', layer: 3, left: '80%', animationDelay: '0.3s' },

  { symbol: 'e', layer: 4, left: '12%', animationDelay: '0.2s' },
  {
    symbol: '□',
    layer: 4,
    left: '28%',
    className: 'geometric',
    animationDelay: '0.25s',
  },
  {
    symbol: '42',
    layer: 4,
    left: '52%',
    className: 'highlight-number',
    animationDelay: '0.3s',
  },
  {
    symbol: '⬟',
    layer: 4,
    left: '72%',
    className: 'geometric',
    animationDelay: '0.35s',
  },
  {
    symbol: '42',
    layer: 4,
    left: '88%',
    className: 'highlight-number',
    animationDelay: '0.4s',
  },
]

/**
 * A single symbol in this floating math component
 */
const FloatingMathSymbol = ({
  symbol,
  layer,
  left,
  className = '',
  index,
}: FloatingMathSymbolDef & { index: number }) => {
  return (
    <div
      className={cn(
        // The main class
        `floating-math`,
        // Layer-specific class
        `layer-${layer}`,
        // Add magnetic class every 3rd symbol
        index % 3 === 0 ? 'magnetic' : '',
        // Custom class
        className
      )}
      style={{
        left,
        // This needs to be here and not in the JSX styles so it's applied right when
        // the symbol is in the DOM. With this just in the class, it would initially be visible unstyled
        opacity: 0,
      }}
      data-symbol={symbol}
      aria-hidden="true"
    >
      {symbol}
    </div>
  )
}

/**
 * A fancy animation with symbols floating and flying and stuff.
 */
export default function FloatingMath() {
  // True once mounted on the client (false during SSR)
  const mounted = useMounted()

  // Whether the visitor asked for reduced motion
  const reducedMotion = useReducedMotion()

  // Render nothing during SSR or under reduced motion
  if (!mounted || reducedMotion) return null

  // Portal to the document body so the symbols stay out of the layout flow; an in-flow overlay throws
  // off hash-anchor scroll-position math
  return createPortal(
    <>
      <FloatingMathStyles />
      <div className="floating-math-container" aria-hidden="true">
        {mathSymbols.map((symbolData, index) => (
          <FloatingMathSymbol
            key={`${symbolData.symbol}-${symbolData.layer}-${index}`}
            {...symbolData}
            index={index}
          />
        ))}
      </div>
    </>,
    document.body
  )
}
