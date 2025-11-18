import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

import { generatePageMetadata } from '@/lib/metadata'

export const metadata = {
  ...generatePageMetadata({
    title: 'SSO Callback',
    description: 'Interná stránka na dokončenie SSO',
    path: '/sso-callback',
  }),
  // No reason to index
  robots: {
    index: false,
    follow: false,
  },
}

export default function SSOCallbackPage() {
  // Coppied from the Clerk docs
  return (
    <>
      {/* Prebuilt component handling redirect flow */}
      <AuthenticateWithRedirectCallback />

      {/* Required for sign-up flows */}
      <div id="clerk-captcha" />
    </>
  )
}
