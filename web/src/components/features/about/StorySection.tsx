import { AppLink } from '@/components/shared/components/AppLink'
import AboutPanelSection from './layout/AboutPanelSection'

export const StorySection = () => (
  <AboutPanelSection
    id="mathcomps-story"
    title="Prečo MathComps vznikol"
    description={
      <>
        Svet matematických súťaží je veľký, plný príkladov, zdrojov, materiálov. Nie je však žiadne
        miesto, ktoré by príjemne zjednocovalo to najlepšie a najmä začiatočníkom poskytovalo ľahkú
        cestu ako do sveta súťaží preniknúť a nestratiť sa.
        <br />
        <br />
        Projekt <strong>MathComps</strong> sa zrodil s cieľom tento stav zmeniť – vytvoriť jedno
        miesto pre celú komunitu, kde bude všetko potrebné: prehľadný archív úloh, študijné
        materiály, diskusie k úlohám a súťažiam, personalizované učenie a podobne, fantázii sa medze
        nekladú.
        <br />
        <br />
        Aktuálna verzia si vyžadovala veľa času a full-time zanietenie, ktoré by nebolo možné bez
        podpory nášho hlavného sponzora, firmy{' '}
        <AppLink
          href="https://www.wincent.com/"
          newTab
          className="text-slate-300 hover:text-white hover:underline transition-colors duration-300"
        >
          Wincent
        </AppLink>
        . Založená bývalými mimoriadne úspešnými riešiteľmi Matematickej olympiády, má veľmi blízko
        k myšlienkam všestrannej podpory rozvoja matematických talentov. Týmto im patrí veľká vďaka.
      </>
    }
  ></AboutPanelSection>
)
