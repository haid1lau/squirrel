import { ChevronDown, CircleCheck, Inbox, ListFilter, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { BenefitRow } from '../components/BenefitRow'
import { EditBenefitForm } from '../components/EditBenefitForm'
import { Link } from '../components/Link'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CountChip } from '../components/ui/Card'
import { Message } from '../components/ui/Message'
import { Skeleton } from '../components/ui/Skeleton'
import { useArmedAction } from '../hooks/useArmedAction'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { api, CATEGORIES, errorMessage, TYPES, type Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { capitalize } from '../lib/format'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'

const STATUSES = {
  all: 'Any status',
  soon: 'Expiring in 30 days',
  later: 'Expiring later',
  none: 'No expiry',
  expired: 'Expired',
  review: 'Needs review',
} as const
type Status = keyof typeof STATUSES

const SORTS = { expiry: 'Expiry, soonest first', name: 'Name, A to Z', provider: 'Provider, A to Z' } as const
type Sort = keyof typeof SORTS

interface Filters {
  query: string
  type: string
  category: string
  source: string
  status: Status
  sort: Sort
}

const NO_FILTERS: Filters = { query: '', type: 'all', category: 'all', source: 'all', status: 'all', sort: 'expiry' }

function matchesStatus(b: Benefit, status: Status) {
  const days = b.days_until_expiry
  switch (status) {
    case 'all':
      return true
    case 'review':
      return b.needs_review
    case 'soon':
      return !b.needs_review && days != null && days >= 0 && days <= 30
    case 'later':
      return !b.needs_review && days != null && days > 30
    case 'none':
      return !b.needs_review && days == null
    case 'expired':
      return !b.needs_review && days != null && days < 0
  }
}

function applyFilters(benefits: Benefit[], f: Filters) {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  return benefits
    .filter((b) => {
      if (f.type !== 'all' && b.type !== f.type) return false
      if (f.category !== 'all' && b.category !== f.category) return false
      if (f.source !== 'all' && b.source !== f.source) return false
      if (!matchesStatus(b, f.status)) return false
      const text = [b.benefit_name, b.provider, b.value, b.terms_summary, b.source_label].join(' ').toLowerCase()
      return words.every((w) => text.includes(w))
    })
    .toSorted((a, b) => {
      if (f.sort === 'name') return byName(a.benefit_name, b.benefit_name)
      if (f.sort === 'provider') return byName(a.provider, b.provider) || byName(a.benefit_name, b.benefit_name)
      return (a.days_until_expiry ?? Infinity) - (b.days_until_expiry ?? Infinity)
    })
}

interface RowActionsProps {
  benefit: Benefit
  onEdit: () => void
  onRemoved: (id: string) => void
}

function RowActions({ benefit, onEdit, onRemoved }: RowActionsProps) {
  const toast = useToast()
  const [armed, click, reset] = useArmedAction()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = benefit.benefit_name || 'Untitled benefit'
  // A used card credit only disappears until it resets; other benefits are gone for good.
  const isCard = benefit.source === 'card'

  async function remove() {
    if (!click()) return
    setBusy(true)
    setError(null)
    try {
      await api.dismiss(benefit.id)
      onRemoved(benefit.id)
      toast('info', isCard ? `Marked “${name}” as used. It comes back when the credit resets.` : `Removed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
      reset()
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button icon={<Pencil className="size-4" aria-hidden />} onClick={onEdit}>
          Edit<span className="sr-only"> {name}</span>
        </Button>
        <Button
          variant="danger"
          icon={isCard ? <CircleCheck className="size-4" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          loading={busy}
          loadingLabel={isCard ? 'Saving…' : 'Removing…'}
          onClick={remove}
          className={armed ? 'border-danger bg-danger-soft' : undefined}
        >
          {armed ? 'Click again to confirm' : isCard ? 'Mark as used' : 'Remove'}
          <span className="sr-only"> {name}</span>
        </Button>
      </div>
      {error ? <Message tone="error">{error}</Message> : null}
    </div>
  )
}

interface BenefitsPageProps {
  benefits: Benefit[] | null
  error: string | null
  onRetry: () => void
  onUpdated: (benefit: Benefit) => void
  onRemoved: (id: string) => void
}

export function BenefitsPage({ benefits, error, onRetry, onUpdated, onRemoved }: BenefitsPageProps) {
  const toast = useToast()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts({
    '/': () => {
      setFiltersOpen(true)
      requestAnimationFrame(() => searchRef.current?.focus())
    },
  })

  const shown = useMemo(() => (benefits ? applyFilters(benefits, filters) : null), [benefits, filters])
  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => k !== 'sort' && v !== NO_FILTERS[k as keyof Filters],
  ).length
  const filtered = activeFilters > 0

  const set =
    <K extends keyof Filters>(key: K) =>
    (e: { target: { value: string } }) =>
      setFilters((f) => ({ ...f, [key]: e.target.value as Filters[K] }))

  const selectClass = cn(fieldClass, 'border-line')

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none sm:text-3xl">
          All Benefits
        </h1>
        {!adding ? (
          <Button
            ref={addButtonRef}
            variant="primary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add a benefit
          </Button>
        ) : null}
      </div>

      {adding ? (
        <Card as="section" aria-labelledby="add-title">
          <CardHeader icon={Plus} title="Add a benefit" titleId="add-title" />
          <p className="px-5 pt-4 text-sm text-ink-muted">
            For vouchers, memberships and points that aren’t in your email, like a paper gift card or your hotel points balance.
          </p>
          <EditBenefitForm
            as="div"
            onCancel={() => {
              setAdding(false)
              requestAnimationFrame(() => addButtonRef.current?.focus())
            }}
            onSaved={(saved) => {
              onUpdated(saved)
              setAdding(false)
              requestAnimationFrame(() => addButtonRef.current?.focus())
              toast('success', `Added “${saved.benefit_name}”.`)
            }}
          />
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="filters-title">
        {/* Collapsed until opened; filters still apply while it's closed, and the chip says how many. */}
        <h2 id="filters-title" className="text-lg font-semibold tracking-tight">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(
              'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-2xl px-5 py-4 text-left transition-colors duration-150 hover:bg-surface-2/60',
              filtersOpen && 'rounded-b-none border-b border-line',
            )}
          >
            <ListFilter className="size-5 text-ink-muted" aria-hidden />
            <span className="flex-1">Search and filter</span>
            {activeFilters ? (
              <CountChip>
                {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'} on
              </CountChip>
            ) : null}
            <ChevronDown
              className={cn('size-5 text-ink-muted transition-transform duration-200', filtersOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
        </h2>
        <div id="filters-panel" hidden={!filtersOpen} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <label htmlFor="benefit-search" className="text-sm font-semibold">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                id="benefit-search"
                ref={searchRef}
                type="search"
                value={filters.query}
                onChange={set('query')}
                placeholder="Name, provider, terms…"
                autoComplete="off"
                className={cn(fieldClass, 'border-line pl-9')}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="filter-type" className="text-sm font-semibold">
              Type
            </label>
            <select id="filter-type" value={filters.type} onChange={set('type')} className={selectClass}>
              <option value="all">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {capitalize(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="filter-category" className="text-sm font-semibold">
              Category
            </label>
            <select id="filter-category" value={filters.category} onChange={set('category')} className={selectClass}>
              <option value="all">All categories</option>
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="filter-source" className="text-sm font-semibold">
              Source
            </label>
            <select id="filter-source" value={filters.source} onChange={set('source')} className={selectClass}>
              <option value="all">All sources</option>
              <option value="gmail">From Gmail</option>
              <option value="imap">Other email</option>
              <option value="loyalty">Memberships found</option>
              <option value="card">Card perks</option>
              <option value="manual">Added by you</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="filter-status" className="text-sm font-semibold">
              Status
            </label>
            <select id="filter-status" value={filters.status} onChange={set('status')} className={selectClass}>
              {Object.entries(STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <label htmlFor="filter-sort" className="text-sm font-semibold">
              Sort by
            </label>
            <select id="filter-sort" value={filters.sort} onChange={set('sort')} className={selectClass}>
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card as="section" aria-labelledby="list-title">
        <CardHeader
          icon={Inbox}
          title="Your benefits"
          titleId="list-title"
          action={
            shown && benefits ? (
              <CountChip>
                <span aria-live="polite">
                  {filtered ? `${shown.length} of ${benefits.length}` : `${benefits.length} total`}
                </span>
              </CountChip>
            ) : null
          }
        />
        {error ? (
          <div className="grid gap-3 p-5">
            <Message tone="error">Couldn’t load your benefits: {error}</Message>
            <div>
              <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={onRetry}>
                Try again
              </Button>
            </div>
          </div>
        ) : !shown || !benefits ? (
          <ul aria-busy="true" aria-label="Loading benefits" className="divide-y divide-line">
            {['w-3/5', 'w-2/5', 'w-1/2'].map((width) => (
              <li key={width} className="grid gap-2 px-5 py-5">
                <Skeleton className={width} />
                <Skeleton className="w-1/3" />
              </li>
            ))}
          </ul>
        ) : benefits.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-5 py-10 text-center text-ink-muted">
            <Inbox className="size-7" aria-hidden />
            <p className="font-semibold text-ink">Nothing tracked yet</p>
            <p>Add one yourself above, or connect your email or a credit card on the dashboard.</p>
            <Link href="/" className="mt-1 font-semibold text-primary-text underline-offset-4 hover:underline">
              Go to the dashboard
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <div className="grid justify-items-center gap-3 px-5 py-10 text-center text-ink-muted">
            <Search className="size-7" aria-hidden />
            <p className="font-semibold text-ink">No benefits match these filters</p>
            <Button onClick={() => setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }))}>Clear filters</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((b) =>
              editing === b.id ? (
                <EditBenefitForm
                  key={b.id}
                  benefit={b}
                  onCancel={() => setEditing(null)}
                  onSaved={(saved) => {
                    onUpdated(saved)
                    setEditing(null)
                    toast('success', `Saved “${saved.benefit_name}”.`)
                  }}
                />
              ) : (
                <BenefitRow key={b.id} benefit={b}>
                  <RowActions benefit={b} onEdit={() => setEditing(b.id)} onRemoved={onRemoved} />
                </BenefitRow>
              ),
            )}
          </ul>
        )}
      </Card>
    </div>
  )
}
