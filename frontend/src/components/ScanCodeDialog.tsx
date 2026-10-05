import { Camera, ExternalLink, Image, Keyboard, Plus, ScanLine, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { asLink, matchCode } from '../lib/codes'
import { formatDate, formatPoints } from '../lib/format'
import { createReader, type CodeReader } from '../lib/scanner'
import { fieldClass } from '../lib/styles'
import { isArchived } from '../lib/usage'
import { Button } from './ui/Button'
import { Message } from './ui/Message'

const SCAN_EVERY_MS = 250
const MAX_CODE_LENGTH = 64 // the Code field's limit

interface ScanCodeDialogProps {
  benefits: Benefit[]
  onClose: () => void
  /** Opens a matched benefit in the list. */
  onShow: (benefit: Benefit) => void
  /** Opens the Add form with this code filled in. */
  onAdd: (code: string) => void
}

type CameraState = { state: 'starting' } | { state: 'on' } | { state: 'off'; reason: string }

/** Reads a QR code or barcode (camera, photo or typed) and says which saved benefit it belongs to, if any. */
export function ScanCodeDialog({ benefits, onClose, onShow, onAdd }: ScanCodeDialogProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<Promise<CodeReader> | null>(null)
  const [camera, setCamera] = useState<CameraState>({ state: 'starting' })
  const [scanned, setScanned] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const reader = () => (readerRef.current ??= createReader())

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // The camera runs only while there's no result, and always stops on close.
  useEffect(() => {
    if (scanned !== null) return
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera({ state: 'off', reason: 'The camera only works when Squirrel is opened over https.' })
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch (e) {
        const denied = e instanceof DOMException && e.name === 'NotAllowedError'
        setCamera({
          state: 'off',
          reason: denied
            ? 'Camera access was blocked. Allow it in your browser’s site settings, or use a photo.'
            : 'No camera was found.',
        })
        return
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      await video.play().catch(() => {})
      setCamera({ state: 'on' })
      const r = await reader()
      const tick = async () => {
        if (stopped) return
        if (video.readyState >= 2) {
          const text = await r.read(video).catch(() => null)
          if (text && !stopped) {
            setScanned(text)
            return
          }
        }
        timer = window.setTimeout(tick, SCAN_EVERY_MS)
      }
      tick()
    }

    start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [scanned])

  async function readPhoto(file: File | undefined) {
    if (!file) return
    setNotice(null)
    const text = await (await reader()).read(file).catch(() => null)
    if (text) setScanned(text)
    else setNotice('No code found in that photo. Try one that’s sharper and closer.')
  }

  function submitTyped(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (typed.trim()) setScanned(typed.trim())
  }

  function again() {
    setCamera({ state: 'starting' })
    setScanned(null)
    setTyped('')
    setNotice(null)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-popover p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="grid gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
            Scan a code
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
            className="-m-2 grid size-11 cursor-pointer place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {scanned === null ? (
          <>
            <p className="text-sm text-ink-muted">
              Point your camera at a voucher’s QR code or barcode to see which of your benefits it belongs to.
            </p>
            {camera.state !== 'off' ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="Camera view" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/80"
                />
                <p
                  aria-live="polite"
                  className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-2 text-center text-sm text-white"
                >
                  {camera.state === 'starting' ? 'Starting the camera…' : 'Looking for a code…'}
                </p>
              </div>
            ) : (
              <Message tone="info">{camera.reason}</Message>
            )}

            <div className="flex flex-wrap gap-2">
              <Button icon={<Image className="size-4" aria-hidden />} onClick={() => photoRef.current?.click()}>
                Use a photo
              </Button>
              <Button icon={<Keyboard className="size-4" aria-hidden />} onClick={() => setTyping((t) => !t)}>
                Type the code
              </Button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  readPhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
            {typing ? (
              <form onSubmit={submitTyped} className="flex gap-2">
                <label htmlFor={`${id}-typed`} className="sr-only">
                  Code
                </label>
                <div className="min-w-0 flex-1">
                  <input
                    id={`${id}-typed`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="e.g. BDAY-7Q2K"
                    className={cn(fieldClass, 'border-line font-mono')}
                  />
                </div>
                <Button type="submit" variant="primary" icon={<ScanLine className="size-4" aria-hidden />}>
                  Check
                </Button>
              </form>
            ) : null}
            {notice ? <Message tone="error">{notice}</Message> : null}
          </>
        ) : (
          <Result
            scanned={scanned}
            benefits={benefits}
            onShow={(b) => {
              onShow(b)
              dialogRef.current?.close()
            }}
            onAdd={(code) => {
              onAdd(code)
              dialogRef.current?.close()
            }}
            onAgain={again}
          />
        )}
      </div>
    </dialog>
  )
}

interface ResultProps {
  scanned: string
  benefits: Benefit[]
  onShow: (b: Benefit) => void
  onAdd: (code: string) => void
  onAgain: () => void
}

function Result({ scanned, benefits, onShow, onAdd, onAgain }: ResultProps) {
  const matches = matchCode(scanned, benefits)
  const link = asLink(scanned)

  return (
    <div aria-live="polite" className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Scanned</p>
        <p className="font-mono text-sm [overflow-wrap:anywhere]">{scanned}</p>
      </div>

      {matches.length ? (
        <div className="grid gap-2">
          <p className="font-semibold">
            {matches.length === 1 ? 'This is one of your benefits:' : `This code matches ${matches.length} benefits:`}
          </p>
          <ul className="grid gap-2">
            {matches.map((b) => (
              <li key={b.id} className="grid gap-2 rounded-xl bg-surface-2 p-3.5">
                <div>
                  <p className="font-semibold">{b.benefit_name}</p>
                  <p className="text-sm text-ink-muted">
                    {[
                      b.provider,
                      b.points != null ? formatPoints(b.points, b.points_unit) : b.value,
                      b.expiry_date
                        ? `${(b.days_until_expiry ?? 0) < 0 ? 'Expired' : 'Expires'} ${formatDate(b.expiry_date)}`
                        : 'No expiry date',
                      isArchived(b) && 'Marked as used',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {!isArchived(b) ? (
                  <div>
                    <Button onClick={() => onShow(b)}>Show it in my list</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="font-semibold">None of your benefits has this code.</p>
      )}

      {link ? (
        <div className="grid gap-2 rounded-xl border border-line p-3.5">
          <p className="text-sm">
            It’s a link to <strong>{link.hostname.replace(/^www\./, '')}</strong>, which usually says whose offer it is.
            Only open links you trust.
          </p>
          <div>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open the link<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!matches.length ? (
          <Button
            variant="primary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => onAdd(link || scanned.length > MAX_CODE_LENGTH ? '' : scanned)}
          >
            Add as a new benefit
          </Button>
        ) : null}
        <Button icon={<Camera className="size-4" aria-hidden />} onClick={onAgain}>
          Scan another
        </Button>
      </div>
    </div>
  )
}
