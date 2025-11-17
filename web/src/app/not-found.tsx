import { FileQuestion, Home } from 'lucide-react'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'
import Layout from '@/components/layout/Layout'
import ActionButton from '@/components/shared/components/ActionButton'
import GradientText from '@/components/shared/components/GradientText'

export default function NotFound() {
  return (
    <Layout centerMidscreen>
      <ParticleSystem />
      <FloatingMath />
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="mb-4 sm:mb-6 [&>svg]:w-16 [&>svg]:h-16 [&>svg]:sm:w-20 [&>svg]:sm:h-20">
          <FileQuestion className="mx-auto" size={64} />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black leading-tight sm:leading-none tracking-tight mb-4 sm:mb-6">
          <GradientText>Stránka sa nenašla</GradientText>
        </h1>

        <p className="text-base sm:text-lg text-slate-300/90 mb-6">
          Ups! Táto adresa neexistuje alebo bola presunutá.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center">
          <ActionButton
            href="/"
            variant="primary"
            size="large"
            className="inline-flex w-full sm:w-auto justify-center"
          >
            <Home className="mr-2" size={20} />
            Domov
          </ActionButton>
        </div>
      </div>
    </Layout>
  )
}
