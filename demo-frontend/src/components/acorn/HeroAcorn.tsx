import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/motion'

/**
 * idle: a gentle bob. wobble: a shake every few seconds (something expires
 * within 3 days). settle: still and leaning back (nothing left to review).
 */
export type AcornMood = 'idle' | 'wobble' | 'settle'

interface HeroAcornProps {
  mood: AcornMood
  /** The acorn's size in px; the hero sets it to fit beside its text. */
  size: number
}

/**
 * The 3D acorn in the dashboard hero. Spins when the page scrolls, bobs, and
 * fades out as the hero scrolls away. three.js is loaded only when this mounts.
 * With reduced motion it's drawn once and stays still.
 */
export function HeroAcorn({ mood, size }: HeroAcornProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const moodRef = useRef(mood)
  const reduced = useReducedMotion()
  const reducedRef = useRef(reduced)
  const resizeRef = useRef<(() => void) | null>(null)
  const startRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    resizeRef.current?.()
  }, [size])

  // Hand the latest mood to the render loop, and wake it: it rests once a reduced-motion acorn is still.
  useEffect(() => {
    moodRef.current = mood
    reducedRef.current = reduced
    startRef.current?.()
  }, [reduced, mood])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let stopped = false
    let cleanup = () => {}
    host.style.opacity = '0' // fades in once drawn (see onScroll)

    import('./model')
      .then(({ THREE, makeAcorn, makeRenderer, lightScene }) => {
        if (stopped) return
        const renderer = makeRenderer()
        renderer.domElement.style.display = 'block'
        host.appendChild(renderer.domElement)
        const scene = new THREE.Scene()
        lightScene(scene, renderer)
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)

        const acorn = makeAcorn()
        acorn.rotation.z = 0.12 // a slight lean so the spin reads
        const spinner = new THREE.Group()
        spinner.add(acorn)
        spinner.scale.setScalar(1.68)
        scene.add(spinner)

        // Frame the acorn's bounding sphere (the same at any spin angle), seen from slightly above,
        // with room to bob.
        const sphere = new THREE.Box3().setFromObject(spinner).getBoundingSphere(new THREE.Sphere())
        function fitCamera() {
          const w = host!.clientWidth
          const h = host!.clientHeight
          if (!w || !h) return
          renderer.setSize(w, h)
          camera.aspect = w / h
          const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
          // The sphere is looser than the acorn's outline, so pull in a little.
          const d = ((sphere.radius + 0.1) / Math.sin(halfFov)) * 0.8
          const a = Math.PI / 7 // a little above, so the cap shows
          camera.position.set(sphere.center.x, sphere.center.y + d * Math.sin(a), sphere.center.z + d * Math.cos(a))
          camera.lookAt(sphere.center)
          camera.updateProjectionMatrix()
        }
        fitCamera()
        resizeRef.current = () => {
          fitCamera()
          renderer.render(scene, camera)
        }

        // Scrolling down turns it clockwise, seen from above.
        let target = 0
        let current = 0
        let lastY = window.scrollY
        const onScroll = () => {
          const y = window.scrollY
          if (!reducedRef.current) target -= (y - lastY) * 0.006
          lastY = y
          host.style.opacity = String(Math.max(0, 1 - y / 280))
        }
        window.addEventListener('scroll', onScroll, { passive: true })

        // Only draw while it's on screen.
        let visible = true
        const io = new IntersectionObserver(([e]) => {
          visible = e.isIntersecting
          if (visible) start()
        })
        io.observe(host)

        const timer = new THREE.Timer()
        let bobA = 0.08
        let raf = 0
        function frame() {
          raf = 0
          timer.update()
          const dt = Math.min(timer.getDelta(), 0.05)
          const t = timer.getElapsed()
          const rm = reducedRef.current
          const m = moodRef.current
          current += (target - current) * Math.min(1, dt * 6)
          spinner.rotation.y = current
          bobA += ((m === 'settle' || rm ? 0 : 0.08) - bobA) * Math.min(1, dt * 2)
          spinner.position.y = Math.sin(t * 1.1) * bobA
          if (m === 'wobble' && !rm) {
            const ph = t % 4
            const env = ph < 0.9 ? Math.sin((ph / 0.9) * Math.PI) : 0
            acorn.rotation.z = 0.12 + Math.sin(t * 18) * 0.13 * env
          } else {
            acorn.rotation.z += ((m === 'settle' ? 0.2 : 0.12) - acorn.rotation.z) * Math.min(1, dt * 4)
          }
          acorn.rotation.x = Math.sin(t * 0.7) * 0.03 * (bobA / 0.08)
          renderer.render(scene, camera)
          if (visible && !document.hidden && !(rm && Math.abs(target - current) < 1e-3 && bobA < 1e-3)) start()
        }
        function start() {
          if (!raf && !stopped) raf = requestAnimationFrame(frame)
        }
        const onVisibility = () => {
          timer.update() // don't jump after the tab was hidden
          start()
        }
        document.addEventListener('visibilitychange', onVisibility)
        if (reducedRef.current) bobA = 0
        startRef.current = start
        start()
        onScroll()

        cleanup = () => {
          cancelAnimationFrame(raf)
          io.disconnect()
          window.removeEventListener('scroll', onScroll)
          document.removeEventListener('visibilitychange', onVisibility)
          resizeRef.current = null
          startRef.current = null
          renderer.dispose()
          renderer.domElement.remove()
        }
      })
      .catch(() => {
        // No WebGL (or the module failed to load): the hero simply has no acorn.
      })

    return () => {
      stopped = true
      cleanup()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute top-1/2 -translate-y-1/2 transition-opacity duration-300"
      style={{ width: size, height: size, right: 16 }}
    />
  )
}
