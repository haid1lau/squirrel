import { Sparkles } from 'lucide-react'

/** Marks text written by the AI model, so it's never mistaken for your own data. */
export function AiLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">
      <Sparkles className="size-3" aria-hidden />
      AI-generated
    </span>
  )
}
