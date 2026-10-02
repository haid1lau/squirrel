import { useEffect, useRef } from 'react'
import { onCelebrate } from '../../lib/motion'

const COUNT = 30 // the owner's choice: keep it at about 30
const MAX_SECONDS = 3

/**
 * Full-screen falling acorns for big wins (see celebrate() in lib/motion.ts), drawn
 * above the page but under toasts, so the Undo button stays visible.
 * Mount once. Nothing is drawn, and three.js isn't loaded, until the first celebration.
 */
export function AcornRain() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancel = () => {}
    const off = onCelebrate(() => {
      cancel()
      let stopped = false
      cancel = () => {
        stopped = true
      }
      import('./model')
        .then(({ THREE, makeAcorn, makeRenderer, lightScene }) => {
          const host = hostRef.current
          if (stopped || !host) return
          const renderer = makeRenderer()
          host.appendChild(renderer.domElement)
          const W = window.innerWidth
          const H = window.innerHeight
          renderer.setSize(W, H)
          const scene = new THREE.Scene()
          lightScene(scene, renderer)
          const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100)
          camera.position.set(0, 0, 10)
          camera.lookAt(0, 0, 0)

          // World units per pixel at the acorns' depth, so sizes can be set in px.
          const halfH = 10 * Math.tan((15 * Math.PI) / 180)
          const halfW = halfH * (W / H)
          const upp = (2 * halfH) / H
          const items = Array.from({ length: COUNT }, () => {
            const px = 56 + Math.random() * 28
            const size = px * upp
            const group = new THREE.Group()
            const inner = makeAcorn()
            inner.scale.setScalar(size / 3.1)
            group.add(inner)
            group.visible = false
            scene.add(group)
            const dist = 2 * halfH + 2 * size
            return {
              group,
              inner,
              x: (Math.random() * 2 - 1) * halfW * 0.92,
              y: halfH + size,
              vy: -dist * 0.35,
              gravity: dist * 1.1,
              bottom: -halfH - size,
              delay: Math.random() * 0.5,
              spinX: (Math.random() - 0.5) * 6,
              spinZ: (Math.random() - 0.5) * 6,
              gone: false,
            }
          })

          const timer = new THREE.Timer()
          let raf = 0
          const finish = () => {
            cancelAnimationFrame(raf)
            renderer.dispose()
            renderer.domElement.remove()
          }
          cancel = () => {
            stopped = true
            finish()
          }
          const frame = () => {
            timer.update()
            const dt = Math.min(timer.getDelta(), 0.05)
            const t = timer.getElapsed()
            for (const it of items) {
              if (t < it.delay || it.gone) continue
              it.group.visible = true
              it.vy -= it.gravity * dt
              it.y += it.vy * dt
              it.inner.rotation.x += it.spinX * dt
              it.inner.rotation.z += it.spinZ * dt
              it.group.position.set(it.x, it.y, 0)
              if (it.y < it.bottom) {
                it.gone = true
                it.group.visible = false
              }
            }
            renderer.render(scene, camera)
            if (t > MAX_SECONDS || items.every((it) => it.gone)) finish()
            else raf = requestAnimationFrame(frame)
          }
          frame()
        })
        .catch(() => {
          // No WebGL: skip the celebration.
        })
    })
    return () => {
      off()
      cancel()
    }
  }, [])

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-[45]" />
}
