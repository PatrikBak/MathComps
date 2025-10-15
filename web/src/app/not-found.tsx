import { FileQuestion, Home } from 'lucide-react'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'
import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import ActionButton from '@/components/shared/components/ActionButton'
import GradientText from '@/components/shared/components/GradientText'

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col text-slate-300 antialiased overflow-hidden">
      <Header />
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        <ParticleSystem />
        <FloatingMath />
        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <div className="mb-6 [&>svg]:w-16 [&>svg]:h-16">
            <FileQuestion className="mx-auto" size={64} />
          </div>

          <h1 className="text-6xl font-black leading-none tracking-tight mb-6">
            <GradientText>Stránka sa nenašla</GradientText>
          </h1>

          <p className="text-lg text-slate-300/90 mb-6">
            Ups! Táto adresa neexistuje alebo bola presunutá.
          </p>

          <div className="flex flex-col sm:flex-row gap-8 justify-center">
            <ActionButton href="/" variant="primary" size="large" className="inline-flex">
              <Home className="mr-2" size={20} />
              Domov
            </ActionButton>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
