import React from 'react'

export function HandoutsHero() {
  return (
    <section className="relative mt-4 sm:mt-8 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-5 sm:p-8 md:p-10 mb-6 sm:mb-8 md:mb-10">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="relative">
        <h1 className="text-2xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-white">
          Prehľad materiálov
        </h1>
        <p className="mt-2.5 sm:mt-4 max-w-3xl text-sm sm:text-lg text-gray-300/90 leading-relaxed">
          Pripravujeme materiály určené pre riešiteľov začínajúcich so stredoškolskou Matematickou
          olympiádou. Cieľom je, aby boli zaujímavé aj pre skúsenejších riešiteľov vďaka postupne
          gradujúcim úlohám. Materiály sa budú tvoriť priebežne v&nbsp;školskom roku 2025/2026.
        </p>
      </div>
    </section>
  )
}
