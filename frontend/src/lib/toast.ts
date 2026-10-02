import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

/** A button on the toast, like Undo. Clicking it also closes the toast. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  action?: ToastAction
}

export type ShowToast = (tone: ToastTone, message: string, action?: ToastAction) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
