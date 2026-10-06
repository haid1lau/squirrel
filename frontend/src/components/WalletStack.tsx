import { Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, type CatalogCard, type UserCard } from '../lib/api'
import { cn } from '../lib/cn'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, i, 1)),
)

// Plain gradients by card, so the stack is easy to tell apart. No issuer logos.
const FACES: Record<string, { bg: string; ink: string }> = {
  amex_platinum: { bg: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 55%, #d1d5db 100%)', ink: '#111827' },
  amex_gold: { bg: 'linear-gradient(135deg, #f6d58a 0%, #c9952f 55%, #e8c46d 100%)', ink: '#3b2a06' },
  chase_sapphire_reserve: { bg: 'linear-gradient(135deg, #1e2a4a 0%, #0b1324 60%, #26365e 100%)', ink: '#f8fafc' },
  chase_sapphire_preferred: { bg: 'linear-gradient(135deg, #2f5fa8 0%, #1b3a6b 60%, #3b73c4 100%)', ink: '#f8fafc' },
  capital_one_venture_x: { bg: 'linear-gradient(135deg, #3a3f47 0%, #15181d 60%, #2b3038 100%)', ink: '#f8fafc' },
  uob_one: { bg: 'linear-gradient(135deg, #2b4c9b 0%, #142a63 60%, #3a5fb8 100%)', ink: '#f8fafc' },
  dbs_live_fresh: { bg: 'linear-gradient(135deg, #7dd3c0 0%, #2a9d8f 60%, #8fe0cc 100%)', ink: '#06201c' },
  citi_cash_back: { bg: 'linear-gradient(135deg, #5fa8e8 0%, #1e5fa8 60%, #7bb9ee 100%)', ink: '#f8fafc' },
  citi_cash_back_plus: { bg: 'linear-gradient(135deg, #9fb6c9 0%, #4d6a84 60%, #b3c6d6 100%)', ink: '#0f1b26' },
  ocbc_365: { bg: 'linear-gradient(135deg, #e04a3f 0%, #9b1c17 60%, #ef6a5f 100%)', ink: '#fff7f5' },
  ocbc_frank: { bg: 'linear-gradient(135deg, #f7c948 0%, #e07b39 60%, #f9d77a 100%)', ink: '#2b1606' },
  uob_absolute_cashback: { bg: 'linear-gradient(135deg, #1f2937 0%, #030712 60%, #374151 100%)', ink: '#f8fafc' },
  uob_evol: { bg: 'linear-gradient(135deg, #7ad08a 0%, #2f8a4a 60%, #9be0a8 100%)', ink: '#06210f' },
  uob_ladys: { bg: 'linear-gradient(135deg, #f4a7c3 0%, #c2457a 60%, #f7bfd3 100%)', ink: '#2b0716' },
  maybank_family_friends: { bg: 'linear-gradient(135deg, #ffd84d 0%, #e3b100 60%, #ffe27a 100%)', ink: '#2b2200' },
  sc_simply_cash: { bg: 'linear-gradient(135deg, #38b06f 0%, #0f6e8c 60%, #4fc28a 100%)', ink: '#f8fafc' },
  hsbc_revolution: { bg: 'linear-gradient(135deg, #e5e7eb 0%, #b91c1c 70%, #f3f4f6 100%)', ink: '#111827' },
  citi_rewards: { bg: 'linear-gradient(135deg, #c4b5fd 0%, #6d28d9 60%, #ddd6fe 100%)', ink: '#f8fafc' },
  dbs_womans_world: { bg: 'linear-gradient(135deg, #4a1d3f 0%, #1f0a1a 60%, #6b2a5b 100%)', ink: '#fdf2f8' },
  citi_premiermiles: { bg: 'linear-gradient(135deg, #475569 0%, #0f172a 60%, #64748b 100%)', ink: '#f8fafc' },
  dbs_altitude: { bg: 'linear-gradient(135deg, #1e1b4b 0%, #000000 60%, #312e81 100%)', ink: '#f8fafc' },
  uob_prvi_miles: { bg: 'linear-gradient(135deg, #2c3e50 0%, #0b1622 60%, #4b6584 100%)', ink: '#f8fafc' },
  hsbc_travelone: { bg: 'linear-gradient(135deg, #0f4c5c 0%, #062a33 60%, #1b6b7d 100%)', ink: '#f8fafc' },
  uob_krisflyer: { bg: 'linear-gradient(135deg, #1b2a5c 0%, #0a1430 60%, #c9a227 100%)', ink: '#f8fafc' },
  amex_krisflyer_ascend: { bg: 'linear-gradient(135deg, #d6b56b 0%, #8a6a2b 60%, #e6c98a 100%)', ink: '#231a06' },
}
const DEFAULT_FACE = { bg: 'linear-gradient(135deg, #64748b 0%, #334155 100%)', ink: '#f8fafc' }

const STRIP = 58 // px of each card showing when the stack is closed
const PILE_STEP = 9 // px between cards in the pile under an opened card
const PILE_SHOW = 22 // px of the last piled card that shows
const SHADOW_ROOM = 14 // px under the stack, so the bottom card's shadow isn't cut off
const ASPECT = 1.586 // a real card's width to height

interface WalletStackProps {
  cards: UserCard[]
  catalog: CatalogCard[]
  onRemoved: (id: string) => void
}

/**
 * The user's cards as an Apple Wallet-style stack: each card's top strip shows,
 * and opening one brings it to the top with the rest piled underneath, then its
 * perks below. Each card is a button; Escape closes.
 */
export function WalletStack({ cards, catalog, onRemoved }: WalletStackProps) {
  const [open, setOpen] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => setWidth(box.offsetWidth))
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // A removed card can't stay open.
  const openCard = cards.find((c) => c.id === open) ?? null
  const cardH = width / ASPECT
  const others = cards.filter((c) => c.id !== openCard?.id)
  // The box clips, so piled cards show only as slivers under the opened one.
  const height =
    (openCard
      ? cardH + (others.length ? 14 + (others.length - 1) * PILE_STEP + PILE_SHOW : 0)
      : cardH + Math.max(0, cards.length - 1) * STRIP) + SHADOW_ROOM

  function top(card: UserCard, i: number) {
    if (!openCard) return i * STRIP
    if (card.id === openCard.id) return 0
    return cardH + 14 + others.indexOf(card) * PILE_STEP
  }

  return (
    <div className="grid gap-4">
      <div
        ref={boxRef}
        className="relative w-full max-w-[360px] overflow-hidden transition-[height] duration-400 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ height: width ? height : undefined }}
      >
        {width
          ? cards.map((card, i) => {
              const face = FACES[card.card_key] ?? DEFAULT_FACE
              const info = catalog.find((c) => c.key === card.card_key)
              const perks = info?.perks.length ?? 0
              const isOpen = card.id === openCard?.id
              const inPile = Boolean(openCard) && !isOpen
              const style: CSSProperties = {
                height: cardH,
                transform: `translateY(${top(card, i)}px) scale(${inPile ? 0.94 : 1})`,
                zIndex: isOpen ? cards.length + 1 : i,
                background: face.bg,
                color: face.ink,
              }
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? 'wallet-detail' : undefined}
                  onClick={() => setOpen(isOpen ? null : card.id)}
                  style={style}
                  className={cn(
                    'absolute inset-x-0 top-0 flex origin-top cursor-pointer flex-col justify-between rounded-2xl p-4 text-left',
                    'shadow-[0_-1px_0_rgb(255_255_255/0.35)_inset,0_10px_28px_-10px_rgb(15_23_42/0.55)]',
                    'transition-transform duration-400 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-offset-4',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[15px] leading-tight font-bold">{card.name}</span>
                    <span aria-hidden className="text-xs font-semibold tracking-widest uppercase opacity-70">
                      Credit
                    </span>
                  </span>
                  {/* A chip, for the card look. */}
                  <span
                    aria-hidden
                    className="h-7 w-10 rounded-md opacity-80"
                    style={{ background: 'linear-gradient(135deg, #f3e3b0, #c8a95a 60%, #efd88f)' }}
                  />
                  <span className="flex items-end justify-between gap-3 text-sm font-semibold">
                    <span>
                      {perks === 1
                        ? '1 perk tracked'
                        : perks
                          ? `${perks} perks tracked`
                          : info?.features.length
                            ? 'Benefits listed'
                            : 'No perks tracked'}
                    </span>
                    {card.anniversary_month ? (
                      <span className="opacity-80">Renews {MONTHS[card.anniversary_month - 1]}</span>
                    ) : null}
                  </span>
                </button>
              )
            })
          : null}
      </div>

      {openCard ? (
        <CardDetail
          key={openCard.id}
          card={openCard}
          perks={catalog.find((c) => c.key === openCard.card_key)?.perks ?? []}
          features={catalog.find((c) => c.key === openCard.card_key)?.features ?? []}
          total={cards.length}
          onRemoved={(id) => {
            setOpen(null)
            onRemoved(id)
          }}
        />
      ) : null}
    </div>
  )
}

interface CardDetailProps {
  card: UserCard
  total: number
  perks: CatalogCard['perks']
  features: CatalogCard['features']
  onRemoved: (id: string) => void
}

/** The opened card's perks and benefits, and Remove. */
function CardDetail({ card, total, perks, features, onRemoved }: CardDetailProps) {
  const toast = useToast()
  const [armed, armOrConfirm, disarm] = useArmedAction()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!armOrConfirm()) return
    setBusy(true)
    try {
      await api.removeCard(card.id)
      onRemoved(card.id)
      toast('info', `Removed ${card.name} and its perks.`)
    } catch (e) {
      toast('error', errorMessage(e))
      setBusy(false)
      disarm()
    }
  }

  return (
    <div id="wallet-detail" className="grid max-w-[360px] animate-rise gap-3 rounded-xl bg-surface-2 p-4">
      <p className="font-semibold">{card.name}</p>
      {perks.length ? (
        <ul className="grid gap-1 text-sm text-ink-muted">
          {perks.map((p) => (
            <li key={p.name} className="flex justify-between gap-3">
              <span>{p.name}</span>
              <span className="text-right whitespace-nowrap text-ink">
                {p.value} · {p.resets}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {features.length ? (
        <ul className="grid list-disc gap-0.5 pl-4 text-sm text-ink-muted">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
      {total > 1 ? <p className="text-xs text-ink-muted">Tap the card again to see all {total} cards.</p> : null}
      <div>
        <Button
          variant="danger"
          icon={<Trash2 className="size-4" aria-hidden />}
          loading={busy}
          loadingLabel="Removing…"
          onClick={remove}
          className={armed ? 'border-danger bg-danger-soft' : undefined}
        >
          {armed ? 'Click again to remove' : 'Remove card'}
        </Button>
      </div>
    </div>
  )
}
