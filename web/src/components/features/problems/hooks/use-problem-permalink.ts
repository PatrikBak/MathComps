import { useClipboard } from '@mantine/hooks'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

export const useProblemPermalink = () => {
  const clipboard = useClipboard()

  const copyPermalink = useCallback(
    (slug: string) => {
      const url = `${window.location.origin}/${ROUTES.PROBLEMS}?id=${slug}`
      clipboard.copy(url)
      toast.success('Odkaz na úlohu bol skopírovaný do schránky')
    },
    [clipboard]
  )

  return { copyPermalink }
}
