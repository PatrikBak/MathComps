import React from 'react'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'

export default function PrivacyPage() {
  // Generic contact email
  const contactEmail = getRequiredEnv('CONTACT_EMAIL')
  const emailLink = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>

  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-white">
        Ochrana súkromia a podmienky
      </h1>

      <p className="text-slate-400 mb-8 italic">
        Posledná aktualizácia: {new Date().toLocaleDateString('sk-SK')}
      </p>

      <div className="space-y-8 text-slate-300 leading-relaxed [&_section]:space-y-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_a]:text-blue-400 [&_a]:hover:text-blue-300 [&_a]:hover:underline [&_a]:transition-colors [&_a]:duration-300">
        {/* Section 1: Intro & Age */}
        <section>
          <h2>1. Kto sme a pre koho je web</h2>
          <p>
            Prevádzkovateľom je <strong>Patrik Bak</strong>, kontakt: {emailLink}
          </p>
          <p>
            Platforma je určená pre všetkých od 16 rokov. Ak máš menej, potrebuješ na používanie
            súhlas rodiča. Vytvorením účtu potvrdzuješ, že tieto podmienky spĺňaš.
          </p>
        </section>

        {/* Section 2: Data Collection */}
        <section>
          <h2>2. Tvoje údaje</h2>
          <p>Používame a ukladáme nasledujúce údaje:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Login:</strong> Email, meno, profilová fotka, prípadne prepojenie s
              Google/Discord/GitHub, ak sa prihlásiš cez ne.
            </li>
            <li>
              <strong>Obsah:</strong> Všetok tvoj obsah, ktorý vkladáš na stránku.
            </li>
          </ul>
        </section>

        {/* Section 3: Cookies & Storage */}
        <section>
          <h2>3. Cookies</h2>
          <p>
            Súbory cookies sú používané výhradne na funkcionality stránky (napr. udržanie
            prihlásenia). Nie sú postupované tretím stranám.
          </p>
        </section>

        {/* Section 4: Deletion */}
        <section>
          <h2>4. Zmazanie účtu</h2>
          <p>Kedykoľvek je možné požiadať o zmazanie účtu, stačí napísať na {emailLink}.</p>
        </section>
      </div>
    </div>
  )
}
