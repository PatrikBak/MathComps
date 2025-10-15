import { Github, Linkedin } from 'lucide-react'
import Image from 'next/image'

import { AppLink } from '@/components/shared/components/AppLink'

import AboutPanelSection from './layout/AboutPanelSection'

export const AuthorSection = () => {
  return (
    <AboutPanelSection id="aboutAuthor" title="O autorovi">
      <div className="flex flex-col sm:flex-row items-start gap-8">
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <Image
            src="/foto.jpg"
            alt="Profilová fotka Patrika Baka"
            width={128}
            height={128}
            className="w-full h-full object-cover rounded-full"
            priority
          />
        </div>

        <div className="text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed space-y-4 sm:pr-2">
          <p>
            Volám sa <strong>Patrik Bak</strong>. Ako bývalý trojnásobný účastník a dvojnásobný
            medailista na Medzinárodných matematických olympiádach (IMO), ale aj autor množstva
            súťažných úloh (vrátane dvoch pre IMO), mám k olympiádnej matematike hlboký vzťah. Už
            dlhšie ma baví spájať matematiku s programovaním. Tento záujem v minulosti viedol k
            projektu <strong>GeoGen</strong>, nástroju na automatické generovanie geometrických
            úloh. <strong>MathComps</strong> je ďalším logickým krokom na tejto ceste – snahou
            vytvoriť komplexnú a modernú platformu pre komunitu matematickej olympiády. Pri jej
            budovaní sa opieram nielen o vlastné poznatky a skúsenosti, ale vďaka porozumeniu a
            podpore viacerých skvelých ľudí z komunity MO aj o ich pripomienky a nápady.
          </p>

          <div className="flex items-center gap-4 sm:gap-6 pt-2">
            <AppLink
              href="https://www.linkedin.com/in/patrik-bak-113385139"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              title="LinkedIn"
            >
              <Linkedin size={20} />
              <span>LinkedIn</span>
            </AppLink>

            <AppLink
              href="https://github.com/patrikbak"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              title="GitHub"
            >
              <Github size={20} />
              <span>GitHub</span>
            </AppLink>
          </div>
        </div>
      </div>
    </AboutPanelSection>
  )
}
