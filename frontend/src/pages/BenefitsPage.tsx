import { ChevronDown, CircleCheck, Inbox, ListFilter, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { BenefitActions } from '../components/BenefitActions'
import { BenefitRow } from '../components/BenefitRow'
import { EditBenefitForm } from '../components/EditBenefitForm'
import { Link } from '../components/Link'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CountChip } from '../components/ui/Card'
import { Message } from '../components/ui/Message'
import { Skeleton } from '../components/ui/Skeleton'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { api, CATEGORIES, errorMessage, TYPES, type Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { capitalize, formatDate } from '../lib/format'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { isArchived } from '../lib/usage'

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

  // Used-up benefits leave the main list for the Used section; the same filters apply to both.
  const current = useMemo(() => benefits?.filter((b) => !isArchived(b)) ?? null, [benefits])
  const used = useMemo(() => benefits?.filter(isArchived) ?? [], [benefits])
  const shown = useMemo(() => (current ? applyFilters(current, filters) : null), [current, filters])
  const usedShown = useMemo(() => applyFilters(used, filters), [used, filters])
  const [usedOpen, setUsedOpen] = useState(false)

  async function restore(b: Benefit) {
    try {
      onUpdated(await api.quickUpdate(b.id, { used: false }))
      toast('success', `Moved “${b.benefit_name}” back to your benefits.`)
    } catch (e) {
      toast('error', `Couldn’t restore it: ${errorMessage(e)}`)
    }
  }
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
            shown && current ? (
              <CountChip>
                <span aria-live="polite">
                  {filtered ? `${shown.length} of ${current.length}` : `${current.length} total`}
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
        ) : !shown || !current ? (
          <ul aria-busy="true" aria-label="Loading benefits" className="divide-y divide-line">
            {['w-3/5', 'w-2/5', 'w-1/2'].map((width) => (
              <li key={width} className="grid gap-2 px-5 py-5">
                <Skeleton className={width} />
                <Skeleton className="w-1/3" />
              </li>
            ))}
          </ul>
        ) : current.length === 0 && used.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-5 py-10 text-center text-ink-muted">
            <Inbox className="size-7" aria-hidden />
            <p className="font-semibold text-ink">Nothing tracked yet</p>
            <p>Add one yourself above, or connect your email or a credit card on the dashboard.</p>
            <Link href="/" className="mt-1 font-semibold text-primary-text underline-offset-4 hover:underline">
              Go to the dashboard
            </Link>
          </div>
        ) : current.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-5 py-10 text-center text-ink-muted">
            <CircleCheck className="size-7 text-ok" aria-hidden />
            <p className="font-semibold text-ink">All used</p>
            <p>Everything you tracked is in the Used list below.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="grid justify-items-center gap-3 px-5 py-10 text-center text-ink-muted">
            <Search className="size-7" aria-hidden />
            <p className="font-semibold text-ink">No benefits match these filters</p>
            <Button onClick={() => setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }))}>Clear filters</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((b, i) =>
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
                <BenefitRow key={b.id} benefit={b} index={i}>
                  <BenefitActions
                    benefit={b}
                    onEdit={() => setEditing(b.id)}
                    onUpdated={onUpdated}
                    onRemoved={onRemoved}
                  />
                </BenefitRow>
              ),
            )}
          </ul>
        )}
        {usedShown.length > 0 ? (
          <div className="border-t border-line">
            <h3>
              <button
                type="button"
                aria-expanded={usedOpen}
                aria-controls="used-list"
                onClick={() => setUsedOpen((o) => !o)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-5 py-3 text-left font-semibold transition-colors duration-150 hover:bg-surface-2/60"
              >
                <ChevronDown
                  className={cn('size-4 text-ink-muted transition-transform duration-200', !usedOpen && '-rotate-90')}
                  aria-hidden
                />
                Used
                <CountChip>{usedShown.length}</CountChip>
              </button>
            </h3>
            <ul id="used-list" hidden={!usedOpen} className="divide-y divide-line">
              {usedShown.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-ink-muted">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink line-through decoration-ink-muted/50">{b.benefit_name}</p>
                    <p className="text-sm">
                      {b.provider ? `${b.provider} · ` : ''}Used {b.used_on ? formatDate(b.used_on) : ''}
                    </p>
                  </div>
                  <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => restore(b)}>
                    Restore<span className="sr-only"> {b.benefit_name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
