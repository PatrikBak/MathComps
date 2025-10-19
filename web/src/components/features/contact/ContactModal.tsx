'use client'

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'

import ContactForm from './ContactForm'
import { type ContactFormData, type ReasonOption } from './contactFormSchema'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  defaultReason?: ReasonOption
}

export default function ContactModal({ isOpen, onClose, defaultReason }: ContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFormSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Správu sa nepodarilo odoslať')
      }

      toast.success('Správa úspešne poslaná! Čoskoro sa vám ozveme.')
      onClose()
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Správu sa nepodarilo odoslať. Skúste znova neskôr.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <DialogTitle as="h3" className="text-xl font-bold text-white">
                    Napíšte nám
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors duration-200"
                  >
                    <X size={24} />
                  </button>
                </div>

                <ContactForm
                  defaultReason={defaultReason}
                  onSubmit={handleFormSubmit}
                  isSubmitting={isSubmitting}
                />
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
