import { ServerCrash } from 'lucide-react'
import { useTranslations } from 'next-intl'

export const EmptyState = () => {
  // Translations for section
  const t = useTranslations('problems.emptyState')

  return (
    <div className="flex flex-col items-center justify-center text-center bg-surface/50 border border-dashed border-foreground/10 rounded-lg py-20">
      <ServerCrash size={48} className="text-muted mb-4" />
      <h3 className="text-xl font-semibold text-foreground">{t('title')}</h3>
      <p className="mt-2 text-muted">{t('description')}</p>
    </div>
  )
}
