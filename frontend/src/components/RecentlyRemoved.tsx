import { ChevronDown, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage, type Benefit, type RemovedBenefit } from '../lib/api'
import { cn } from '../lib/cn'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'
import { Card, CountChip } from './ui/Card'

interface RecentlyRemovedProps {
  /** Changes whenever a benefit is removed or comes back, so the list reloads. */
  activeCount: number | undefined
  onRestored: (benefit: Benefit) => void
}

/** Benefits removed in the last 30 days, each with Restore. Older ones are deleted for good by the server. */
export function RecentlyRemoved({ activeCount, onRestored }: RecentlyRemovedProps) {
  const toast = useToast()
  const [removed, setRemoved] = useState<RemovedBenefit[]>([])
  const [open, setOpen] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.removedBenefits().then(
      (list) => !cancelled && setRemoved(list),
      () => {}, // The list is extra; the page works without it.
    )
    return () => {
      cancelled = true
    }
  }, [activeCount])

  async function restore(b: RemovedBenefit) {
    setRestoring(b.id)
    try {
      onRestored(await api.restoreBenefit(b.id))
      setRemoved((list) => list.filter((x) => x.id !== b.id))
      toast('success', `Restored “${b.benefit_name || 'Untitled benefit'}”.`)
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setRestoring(null)
    }
  }

  if (!removed.length) return null
  return (
    <Card as="section" aria-label="Recently removed">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="removed-list"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[20px] px-5 py-3 text-left font-semibold transition-colors duration-150 hover:bg-surface-2/60"
        >
          <ChevronDown
            className={cn('size-4 text-ink-muted transition-transform duration-200', !open && '-rotate-90')}
            aria-hidden
          />
          Recently removed
          <CountChip>{removed.length}</CountChip>
        </button>
      </h3>
      <div id="removed-list" hidden={!open} className="border-t border-line">
        <p className="px-5 pt-3 text-sm text-ink-muted">
          Removed benefits stay here for 30 days, then they’re deleted for good.
        </p>
        <ul className="divide-y divide-line">
          {removed.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-ink-muted">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink [overflow-wrap:anywhere]">{b.benefit_name || 'Untitled benefit'}</p>
                <p className="text-sm">
                  {b.provider ? `${b.provider} · ` : ''}Removed {formatDate(b.removed_at.slice(0, 10))} · Deleted on{' '}
                  {formatDate(b.delete_on.slice(0, 10))}
                </p>
              </div>
              <Button
                icon={<RotateCcw className="size-4" aria-hidden />}
                loading={restoring === b.id}
                loadingLabel="Restoring…"
                onClick={() => restore(b)}
              >
                Restore<span className="sr-only"> {b.benefit_name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
