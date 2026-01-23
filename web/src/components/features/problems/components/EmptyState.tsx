import { ServerCrash } from 'lucide-react'
import { useTranslations } from 'next-intl'

export const EmptyState = () => {
  // Translations for section
  const t = useTranslations('problems.emptyState')

  return (
    <div className="flex flex-col items-center justify-center text-center bg-gray-800/50 border border-dashed border-gray-700 rounded-lg py-20">
      <ServerCrash size={48} className="text-gray-500 mb-4" />
      <h3 className="text-xl font-semibold text-white">{t('title')}</h3>
      <p className="mt-2 text-gray-400">{t('description')}</p>
    </div>
  )
}
