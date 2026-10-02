import { CreditCard, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage, type CardsResponse } from '../lib/api'
import { cn } from '../lib/cn'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'
import { WalletStack } from './WalletStack'

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, i, 1)),
)

export function CardsPanel({ onChanged }: { onChanged: () => void }) {
  const toast = useToast()
  const [data, setData] = useState<CardsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cardKey, setCardKey] = useState('')
  const [month, setMonth] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchCards = useCallback(() => {
    api.cards().then(setData, (e) => setLoadError(errorMessage(e)))
  }, [])
  useEffect(fetchCards, [fetchCards])
  const load = () => {
    setLoadError(null)
    fetchCards()
  }

  const owned = new Set(data?.cards.map((c) => c.card_key))
  const available = data?.catalog.cards.filter((c) => !owned.has(c.key)) ?? []
  const selected = available.find((c) => c.key === cardKey)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) {
      setFormError('Pick a card first.')
      return
    }
    if (selected.needs_anniversary && !month) {
      setFormError('Pick the month you opened the card.')
      return
    }
    setFormError(null)
    setAdding(true)
    try {
      const card = await api.addCard(selected.key, selected.needs_anniversary ? Number(month) : null)
      setData((d) => d && { ...d, cards: [...d.cards, card] })
      setCardKey('')
      setMonth('')
      onChanged()
      toast('success', `Added ${card.name}. Its perks are now tracked.`)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  function removed(id: string) {
    setData((d) => d && { ...d, cards: d.cards.filter((c) => c.id !== id) })
    onChanged()
  }

  return (
    <Card as="article" aria-labelledby="cards-title" className="grid content-start">
      <CardHeader
        icon={CreditCard}
        title="Credit cards"
        titleId="cards-title"
        action={data ? <CountChip>{data.cards.length} added</CountChip> : null}
      />
      <div className="grid gap-4 p-5">
        {loadError ? (
          <div className="grid gap-3">
            <Message tone="error">Couldn’t load your cards: {loadError}</Message>
            <div>
              <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={load}>
                Try again
              </Button>
            </div>
          </div>
        ) : !data ? (
          <div className="grid gap-2" aria-busy="true" aria-label="Loading cards">
            <Skeleton className="w-1/2" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {data.cards.length ? (
              <WalletStack cards={data.cards} catalog={data.catalog.cards} onRemoved={removed} />
            ) : null}

            {available.length ? (
              <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid content-start gap-1.5">
                    <label htmlFor="card-key" className="text-sm font-semibold">
                      Card
                    </label>
                    <select
                      id="card-key"
                      value={cardKey}
                      onChange={(e) => setCardKey(e.target.value)}
                      className={cn(fieldClass, 'border-line')}
                    >
                      <option value="">Choose a card…</option>
                      {available.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selected?.needs_anniversary ? (
                    <div className="grid content-start gap-1.5">
                      <label htmlFor="card-month" className="text-sm font-semibold">
                        Month you opened it
                      </label>
                      <select
                        id="card-month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        aria-describedby="card-month-hint"
                        className={cn(fieldClass, 'border-line')}
                      >
                        <option value="">Choose a month…</option>
                        {MONTHS.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <p id="card-month-hint" className="text-xs text-ink-muted">
                        Annual credits on this card reset on your card anniversary.
                      </p>
                    </div>
                  ) : null}
                </div>

                {selected ? (
                  <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
                    <p className="font-semibold">Perks that will be tracked</p>
                    <ul className="mt-1 grid gap-0.5 text-ink-muted">
                      {selected.perks.map((p) => (
                        <li key={p.name}>
                          {p.name}: {p.value}, resets {p.resets}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Plus className="size-4" aria-hidden />}
                    loading={adding}
                    loadingLabel="Adding…"
                  >
                    Add card
                  </Button>
                </div>
                <div aria-live="polite">{formError ? <Message tone="error">{formError}</Message> : null}</div>
              </form>
            ) : (
              <p className="text-sm text-ink-muted">You’ve added every card Squirrel knows about.</p>
            )}

            <p className="text-xs text-ink-muted">
              Perk list last checked {data.catalog.checked}. Card issuers change perks, so confirm with yours.
              Squirrel never asks for card numbers.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
