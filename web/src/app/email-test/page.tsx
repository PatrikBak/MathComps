'use client'

import { useEffect, useState } from 'react'

import { generateContactEmail } from '@/lib/email/notification-emails'
import {
  generatePasswordResetEmail,
  generateSignupVerificationEmail,
} from '@/lib/email/verification-emails'

type EmailType = 'contact' | 'signup' | 'reset'

export default function EmailTestPage() {
  const [activeEmail, setActiveEmail] = useState<EmailType>('signup')
  const [htmlContent, setHtmlContent] = useState('')

  useEffect(() => {
    let html = ''
    switch (activeEmail) {
      case 'contact':
        html = generateContactEmail({
          name: 'Janko Hraško',
          email: 'janko@example.com',
          reason: 'Spolupráca',
          message:
            'Dobrý deň,\n\nmám záujem o spoluprácu na vašom projekte MathComps. Videl som vašu prácu a veľmi sa mi páči.\n\nS pozdravom,\nJanko',
        })
        break
      case 'signup':
        html = generateSignupVerificationEmail({
          code: '123456',
          email: 'janko@example.com',
        })
        break
      case 'reset':
        html = generatePasswordResetEmail({
          code: '987654',
          email: 'janko@example.com',
        })
        break
    }
    setHtmlContent(html)
  }, [activeEmail])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Email Template Tester</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveEmail('signup')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeEmail === 'signup'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Signup Verification
          </button>
          <button
            onClick={() => setActiveEmail('reset')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeEmail === 'reset'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Password Reset
          </button>
          <button
            onClick={() => setActiveEmail('contact')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeEmail === 'contact'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Contact Form
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-[800px] bg-white shadow-lg rounded-lg overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 text-xs text-gray-500 flex justify-between">
            <span>Preview</span>
            <span>800px max-width</span>
          </div>
          <iframe
            srcDoc={htmlContent}
            className="w-full flex-1 border-none"
            title="Email Preview"
          />
        </div>
      </main>
    </div>
  )
}
