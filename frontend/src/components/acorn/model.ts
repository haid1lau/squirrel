import * as THREE from 'three'

// The 3D acorn from the Claude Design file (design/Squirrel.html), ported from
// three.js r149 to the current version: textures use colorSpace, and light
// intensities are multiplied by PI because lights are now physically based.
// This module is only loaded on demand (see HeroAcorn and AcornRain).

const V = (x: number, y: number) => new THREE.Vector2(x, y)

function capTextures() {
  const N = 1024
  const c = document.createElement('canvas')
  const b = document.createElement('canvas')
  c.width = b.width = N
  c.height = b.height = N
  const g = c.getContext('2d')!
  const gb = b.getContext('2d')!
  g.fillStyle = '#2a1c12'
  g.fillRect(0, 0, N, N)
  gb.fillStyle = '#000'
  gb.fillRect(0, 0, N, N)
  const cols = 26
  const rows = 13
  const w = N / cols
  const hh = N / rows
  const scale = (ctx: CanvasRenderingContext2D, x: number, y: number, fill: CanvasGradient) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(x - w * 0.62, y - hh * 0.55)
    ctx.bezierCurveTo(x - w * 0.7, y + hh * 0.25, x - w * 0.25, y + hh * 0.85, x, y + hh * 1.15)
    ctx.bezierCurveTo(x + w * 0.25, y + hh * 0.85, x + w * 0.7, y + hh * 0.25, x + w * 0.62, y - hh * 0.55)
    ctx.closePath()
    ctx.fill()
  }
  // Overlapping scales, drawn bottom row first so each row tucks under the one above.
  for (let r = rows; r >= -1; r--) {
    for (let i = -1; i <= cols; i++) {
      const x = i * w + (r % 2 ? w / 2 : 0) + (Math.random() - 0.5) * w * 0.15
      const y = r * hh
      const l = 0.85 + Math.random() * 0.3
      const gr = g.createLinearGradient(0, y - hh * 0.5, 0, y + hh * 1.15)
      gr.addColorStop(0, `rgb(${70 * l},${48 * l},${30 * l})`)
      gr.addColorStop(0.45, `rgb(${140 * l},${105 * l},${74 * l})`)
      gr.addColorStop(0.85, `rgb(${205 * l},${188 * l},${165 * l})`)
      gr.addColorStop(1, `rgb(${170 * l},${150 * l},${128 * l})`)
      scale(g, x, y, gr)
      g.strokeStyle = 'rgba(40,25,15,0.35)'
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(x, y - hh * 0.2)
      g.lineTo(x, y + hh * 0.95)
      g.stroke()
      const bg = gb.createLinearGradient(0, y - hh * 0.5, 0, y + hh * 1.15)
      bg.addColorStop(0, '#202020')
      bg.addColorStop(0.75, '#e8e8e8')
      bg.addColorStop(1, '#9a9a9a')
      scale(gb, x, y, bg)
    }
  }
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,245,230' : '40,25,15'},${Math.random() * 0.12})`
    g.fillRect(Math.random() * N, Math.random() * N, 2, 2)
  }
  const make = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: make(c, true), bump: make(b, false) }
}

function bodyTexture() {
  const W = 2048
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, '#c99a66')
  gr.addColorStop(0.07, '#a8622e')
  gr.addColorStop(0.35, '#97501f')
  gr.addColorStop(0.7, '#86431a')
  gr.addColorStop(0.93, '#6a3313')
  gr.addColorStop(1, '#3b1c0b')
  g.fillStyle = gr
  g.fillRect(0, 0, W, H)
  // Fine vertical grain, dark and light.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W
    const dark = Math.random() < 0.55
    g.strokeStyle = dark
      ? `rgba(70,30,10,${0.04 + Math.random() * 0.12})`
      : `rgba(240,190,140,${0.03 + Math.random() * 0.08})`
    g.lineWidth = 0.6 + Math.random() * 2.4
    const y0 = Math.random() * H * 0.2
    const y1 = H * (0.7 + Math.random() * 0.3)
    g.beginPath()
    g.moveTo(x, y0)
    g.bezierCurveTo(
      x + (Math.random() - 0.5) * 14,
      y0 + (y1 - y0) / 3,
      x + (Math.random() - 0.5) * 14,
      y0 + (2 * (y1 - y0)) / 3,
      x + (Math.random() - 0.5) * 10,
      y1,
    )
    g.stroke()
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * W
    const hg = g.createLinearGradient(x - 40, 0, x + 40, 0)
    hg.addColorStop(0, 'rgba(255,200,150,0)')
    hg.addColorStop(0.5, 'rgba(255,200,150,0.06)')
    hg.addColorStop(1, 'rgba(255,200,150,0)')
    g.fillStyle = hg
    g.fillRect(x - 40, 0, 80, H)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function stemTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#6d635a'
  g.fillRect(0, 0, 256, 512)
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '35,28,22' : '170,160,150'},${Math.random() * 0.35})`
    g.lineWidth = 1 + Math.random() * 3
    const x = Math.random() * 256
    g.beginPath()
    g.moveTo(0, x * 2)
    g.lineTo(512, x * 2 + (Math.random() - 0.5) * 20)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

let template: THREE.Group | null = null

/** A new acorn (about 2.4 units tall, centred near the origin). Textures are built once and shared. */
export function makeAcorn(): THREE.Group {
  if (template) return template.clone()
  const acorn = new THREE.Group()

  const bodyPts = new THREE.SplineCurve([
    V(0.001, -1.16), V(0.07, -1.13), V(0.38, -1.02), V(0.68, -0.76), V(0.88, -0.4),
    V(0.95, -0.02), V(0.93, 0.32), V(0.86, 0.56), V(0.62, 0.74), V(0.001, 0.8),
  ]).getPoints(90)
  const bodyTex = bodyTexture()
  acorn.add(
    new THREE.Mesh(
      new THREE.LatheGeometry(bodyPts, 160),
      new THREE.MeshPhysicalMaterial({
        map: bodyTex,
        bumpMap: bodyTex,
        bumpScale: 0.004,
        roughness: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.1,
      }),
    ),
  )
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b170b, roughness: 0.7 }),
  )
  tip.scale.set(1, 0.7, 1)
  tip.position.y = -1.16
  acorn.add(tip)

  // The cap, with a scaly bump pushed into its outline.
  const capPts = new THREE.SplineCurve([
    V(0.8, 0.4), V(0.97, 0.42), V(1.08, 0.55), V(1.12, 0.74), V(1.05, 0.95),
    V(0.86, 1.11), V(0.55, 1.21), V(0.22, 1.25), V(0.001, 1.26),
  ]).getPoints(70)
  const capGeo = new THREE.LatheGeometry(capPts, 180)
  const pos = capGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 0.05) continue
    const th = Math.atan2(z, x)
    const bump = 1 + 0.028 * Math.max(0, Math.sin(th * 26 + y * 34)) * Math.min(1, r * 1.5)
    pos.setX(i, x * bump)
    pos.setZ(i, z * bump)
  }
  capGeo.computeVertexNormals()
  const capT = capTextures()
  acorn.add(
    new THREE.Mesh(
      capGeo,
      new THREE.MeshStandardMaterial({
        map: capT.map,
        bumpMap: capT.bump,
        bumpScale: 0.09,
        roughness: 0.92,
        side: THREE.DoubleSide,
        envMapIntensity: 0.6,
      }),
    ),
  )
  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.075, 16, 160),
    new THREE.MeshStandardMaterial({ color: 0x9c8a74, roughness: 0.95 }),
  )
  rimRing.rotation.x = Math.PI / 2
  rimRing.position.y = 0.42
  acorn.add(rimRing)

  const stemTex = stemTexture()
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.18, 0),
    new THREE.Vector3(0.06, 1.42, 0.02),
    new THREE.Vector3(0.22, 1.66, 0.06),
    new THREE.Vector3(0.46, 1.84, 0.1),
  ])
  acorn.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 40, 0.068, 14, false),
      new THREE.MeshStandardMaterial({ map: stemTex, bumpMap: stemTex, bumpScale: 0.01, roughness: 0.9 }),
    ),
  )
  const stemTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.85 }),
  )
  stemTop.scale.set(1, 0.8, 1)
  stemTop.position.set(0.47, 1.85, 0.1)
  acorn.add(stemTop)

  template = acorn
  return acorn.clone()
}

/** Lights and a soft studio reflection, as in the design. */
export function lightScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  // r149 "legacy" light units to today's physically based ones (times PI), a little dimmer to match the design.
  const k = Math.PI * 0.7
  scene.add(new THREE.HemisphereLight(0xc7d8ff, 0x24160a, 0.7 * k))
  const key = new THREE.DirectionalLight(0xffe0bd, 1.8 * k)
  key.position.set(3, 6, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x7fb2ff, 1.4 * k)
  rim.position.set(-4, 2.5, -4)
  scene.add(rim)
  const warm = new THREE.PointLight(0xff7a33, 0.8 * k * 4, 12, 1)
  warm.position.set(2.5, -1.5, 2)
  scene.add(warm)

  const pm = new THREE.PMREMGenerator(renderer)
  const env = new THREE.Scene()
  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(20, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x5b5f66, side: THREE.BackSide }),
    ),
  )
  const panel = (col: number, mult: number, x: number, y: number, z: number, sw: number, sh: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(mult), side: THREE.DoubleSide }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  panel(0xffffff, 6, 0, 9, 5, 8, 5)
  panel(0xfff1e0, 3, 8, 3, 4, 4, 8)
  panel(0xcfe0ff, 2.2, -9, 2, -2, 5, 9)
  panel(0xffffff, 1.5, 0, -6, 6, 10, 3)
  scene.environment = pm.fromScene(env, 0.04).texture
  pm.dispose()
}

export function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  return renderer
}

export { THREE }
