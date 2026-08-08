import './style.css'

/* ---------------- canvas / view ---------------- */

const canvas = document.getElementById('map')
const ctx = canvas.getContext('2d')

let W = 0
let H = 0
let dpr = 1
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
}
resize()
window.addEventListener('resize', () => { resize(); dirty = true })

/* ---------------- mercator world ---------------- */

const WBASE = 1024
const YMAX = Math.atanh(Math.sin((85 * Math.PI) / 180))

const mercX = (lon) => ((lon + 180) / 360) * WBASE
const mercY = (lat) => WBASE * (1 - (Math.atanh(Math.sin((lat * Math.PI) / 180)) / YMAX + 1) / 2)
const invLon = (x) => (x / WBASE) * 360 - 180
const invLat = (y) => Math.asin(Math.tanh((1 - (2 * y) / WBASE) * YMAX)) * (180 / Math.PI)

let view = { zoom: 1, cx: WBASE / 2, cy: WBASE / 2, panX: 0, panY: 0 }
let dirty = true

function resetView() {
  view = { zoom: 1, cx: WBASE / 2, cy: WBASE / 2, panX: 0, panY: 0 }
  dirty = true
}

function applyView() {
  const t = dpr * view.zoom
  ctx.setTransform(
    t, 0, 0, t,
    dpr * (W / 2 - view.cx * view.zoom + view.panX),
    dpr * (H / 2 - view.cy * view.zoom + view.panY)
  )
}

/* ---------------- map (mercator remap of equirect texture) ---------------- */

const mapCanvas = document.createElement('canvas')
mapCanvas.width = mapCanvas.height = WBASE
let mapReady = false

function buildMap(src) {
  const tmp = document.createElement('canvas')
  tmp.width = WBASE
  tmp.height = WBASE / 2
  tmp.getContext('2d').drawImage(src, 0, 0, WBASE, WBASE / 2)
  const s = tmp.getContext('2d').getImageData(0, 0, WBASE, WBASE / 2).data
  const out = mapCanvas.getContext('2d').createImageData(WBASE, WBASE)
  const d = out.data
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)

  for (let y = 0; y < WBASE; y++) {
    const lat = invLat(y)
    const fy = ((90 - lat) / 180) * (WBASE / 2)
    const y0 = Math.min(WBASE / 2 - 1, Math.max(0, Math.floor(fy)))
    const y1 = Math.min(WBASE / 2 - 1, y0 + 1)
    const yf = fy - y0
    for (let x = 0; x < WBASE; x++) {
      const lon = invLon(x)
      const fx = ((lon + 180) / 360) * WBASE
      const x0 = Math.min(WBASE - 1, Math.max(0, Math.floor(fx)))
      const x1 = Math.min(WBASE - 1, x0 + 1)
      const xf = fx - x0

      const i00 = (y0 * WBASE + x0) * 4
      const i10 = (y0 * WBASE + x1) * 4
      const i01 = (y1 * WBASE + x0) * 4
      const i11 = (y1 * WBASE + x1) * 4
      const r = (s[i00] * (1 - xf) + s[i10] * xf) * (1 - yf) + (s[i01] * (1 - xf) + s[i11] * xf) * yf
      const g = (s[i00 + 1] * (1 - xf) + s[i10 + 1] * xf) * (1 - yf) + (s[i01 + 1] * (1 - xf) + s[i11 + 1] * xf) * yf
      const b = (s[i00 + 2] * (1 - xf) + s[i10 + 2] * xf) * (1 - yf) + (s[i01 + 2] * (1 - xf) + s[i11 + 2] * xf) * yf

      const lum = (r + g + b) / 765
      const ocean = b > r * 1.25 && b > g * 1.15
      const base = ocean ? [8, 24, 40] : [96, 108, 82]
      const f = 0.45 + lum * 0.85
      const idx = (y * WBASE + x) * 4
      d[idx] = clamp(base[0] * f)
      d[idx + 1] = clamp(base[1] * f)
      d[idx + 2] = clamp(base[2] * f)
      d[idx + 3] = 255
    }
  }
  mapCanvas.getContext('2d').putImageData(out, 0, 0)
  mapReady = true
  document.getElementById('loader').classList.add('hidden')
}

const mapImg = new Image()
mapImg.src = `${import.meta.env.BASE_URL}textures/earth_atmos_2048.jpg`
mapImg.onload = () => buildMap(mapImg)

/* ---------------- wind field (value-noise flow) ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed) {
  const nx = 36
  const ny = 18
  const rand = mulberry32(seed)
  const g = new Float32Array(nx * ny)
  for (let i = 0; i < g.length; i++) g[i] = rand() * 2 - 1
  const at = (ix, iy) => g[(((iy % ny) + ny) % ny) * nx + (((ix % nx) + nx) % nx)]
  const smooth = (t) => t * t * (3 - 2 * t)
  return (lon, lat) => {
    const fx = ((lon + 180) / 360) * nx
    const fy = ((90 - lat) / 180) * ny
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const xf = smooth(fx - x0)
    const yf = smooth(fy - y0)
    return (
      at(x0, y0) * (1 - xf) * (1 - yf) +
      at(x0 + 1, y0) * xf * (1 - yf) +
      at(x0, y0 + 1) * (1 - xf) * yf +
      at(x0 + 1, y0 + 1) * xf * yf
    )
  }
}

const n1 = makeNoise(7)
const n2 = makeNoise(31)

const NX = 144
const NY = 72
const U = new Float32Array(NX * NY)
const V = new Float32Array(NX * NY)

for (let j = 0; j < NY; j++) {
  const lat = 90 - (j + 0.5) * (180 / NY)
  const a = Math.abs(lat)
  for (let i = 0; i < NX; i++) {
    const lon = -180 + (i + 0.5) * (360 / NX)
    const uBase =
      7 * Math.exp(-((a - 52) ** 2) / 150) -
      5 * Math.exp(-((a - 12) ** 2) / 90) +
      3 * Math.exp(-((a - 72) ** 2) / 120)
    const idx = j * NX + i
    U[idx] = uBase + (n1(lon, lat) + 0.5 * n2(lon * 2 + 13, lat * 2 - 7)) * 6
    V[idx] = (n1(lon + 40, lat + 17) + 0.5 * n2(lon * 2 - 23, lat * 2 + 11)) * 4 - a * 0.03
  }
}

function sampleWind(lon, lat, isU) {
  const gx = Math.min(NX - 1.001, Math.max(0, ((lon + 180) / 360) * NX))
  const gy = Math.min(NY - 1.001, Math.max(0, ((90 - lat) / 180) * NY))
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const xf = gx - x0
  const yf = gy - y0
  const arr = isU ? U : V
  const a = arr[y0 * NX + x0]
  const b = arr[y0 * NX + x0 + 1]
  const c = arr[(y0 + 1) * NX + x0]
  const d = arr[(y0 + 1) * NX + x0 + 1]
  return a * (1 - xf) * (1 - yf) + b * xf * (1 - yf) + c * (1 - xf) * yf + d * xf * yf
}

/* ---------------- particles ---------------- */

const PARTICLES = []

function makeParticle() {
  return { x: Math.random() * WBASE, y: Math.random() * WBASE, age: Math.random() * 320 }
}

function rebuildParticles(n) {
  PARTICLES.length = 0
  for (let i = 0; i < n; i++) PARTICLES.push(makeParticle())
}

const SPEED_COLORS = [
  [0, [242, 251, 255]],
  [5, [172, 226, 242]],
  [10, [92, 178, 216]],
  [15, [64, 146, 204]],
  [20, [96, 190, 110]],
  [25, [240, 210, 74]],
  [30, [240, 154, 60]],
  [35, [240, 90, 74]],
  [40, [216, 74, 224]],
]

function speedColor(s) {
  let a = SPEED_COLORS[0]
  let b = SPEED_COLORS[SPEED_COLORS.length - 1]
  for (let i = 0; i < SPEED_COLORS.length - 1; i++) {
    if (s <= SPEED_COLORS[i + 1][0]) { a = SPEED_COLORS[i]; b = SPEED_COLORS[i + 1]; break }
  }
  const t = Math.min(1, Math.max(0, (s - a[0]) / (b[0] - a[0])))
  const ca = a[1]
  const cb = b[1]
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(ca[1] + (cb[1] - ca[1]) * t)},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`
}

function offScreen(x, y) {
  const sx = (x - view.cx) * view.zoom + W / 2 + view.panX
  const sy = (y - view.cy) * view.zoom + H / 2 + view.panY
  return sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30
}

/* ---------------- settings ---------------- */

let paused = false
let showWind = true
let showParticles = true
let showGrid = false
let trails = true
let opacity = 1
let velScale = 1
let count = 5000
const K = 80000

/* ---------------- UI wiring ---------------- */

const btnPause = document.getElementById('btn-pause')
const btnMenu = document.getElementById('btn-menu')
const panel = document.getElementById('panel')

btnPause.addEventListener('click', () => {
  paused = !paused
  btnPause.textContent = paused ? '▶' : '⏸'
})

btnMenu.addEventListener('click', () => {
  panel.hidden = !panel.hidden
})

panel.querySelectorAll('.panel-head').forEach((head) => {
  head.addEventListener('click', () => {
    head.classList.toggle('open')
    document.getElementById(head.dataset.sec).classList.toggle('open')
  })
})

panel.querySelectorAll('.toggle-row').forEach((row) => {
  row.addEventListener('click', () => {
    const key = row.dataset.key
    if (key === 'wind') showWind = !showWind
    if (key === 'particles') showParticles = !showParticles
    if (key === 'grid') showGrid = !showGrid
    if (key === 'trails') trails = !trails
    row.querySelector('.state').textContent = key === 'wind' ? (showWind ? 'on' : 'off') : key === 'particles' ? (showParticles ? 'on' : 'off') : key === 'grid' ? (showGrid ? 'on' : 'off') : (trails ? 'on' : 'off')
  })
})

document.getElementById('opt-opacity').addEventListener('input', (e) => { opacity = +e.target.value })
document.getElementById('opt-vel').addEventListener('input', (e) => { velScale = +e.target.value })
document.getElementById('opt-count').addEventListener('input', (e) => {
  count = +e.target.value
  rebuildParticles(count)
})

const clockEl = document.getElementById('clock')
setInterval(() => {
  clockEl.textContent = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
}, 1000)

/* ---------------- pan / zoom ---------------- */

let dragging = false
let lastX = 0
let lastY = 0

canvas.addEventListener('pointerdown', (e) => {
  dragging = true
  canvas.classList.add('dragging')
  lastX = e.clientX
  lastY = e.clientY
  canvas.setPointerCapture(e.pointerId)
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  view.panX += e.clientX - lastX
  view.panY += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  dirty = true
})

canvas.addEventListener('pointerup', () => {
  dragging = false
  canvas.classList.remove('dragging')
})

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const nz = Math.min(12, Math.max(0.5, view.zoom * Math.exp(-e.deltaY * 0.0012)))
  const wx = (e.clientX - (W / 2 + view.panX)) / view.zoom + view.cx
  const wy = (e.clientY - (H / 2 + view.panY)) / view.zoom + view.cy
  view.zoom = nz
  view.cx = wx - (e.clientX - (W / 2 + view.panX)) / nz
  view.cy = wy - (e.clientY - (H / 2 + view.panY)) / nz
  dirty = true
}, { passive: false })

canvas.addEventListener('dblclick', resetView)

/* ---------------- render loop ---------------- */

let last = performance.now()

function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min((now - last) / 1000, 0.05)
  last = now
  if (paused) dt = 0

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#01060c'
  ctx.fillRect(0, 0, W, H)
  applyView()

  if (mapReady) {
    if (trails && !dirty) {
      ctx.fillStyle = 'rgba(1,6,12,0.07)'
      ctx.fillRect(0, 0, WBASE, WBASE)
    } else {
      ctx.drawImage(mapCanvas, 0, 0)
      dirty = false
    }
  }

  if (showGrid) {
    ctx.fillStyle = 'rgba(120,170,210,0.28)'
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        ctx.fillRect(mercX(-180 + (i + 0.5) * (360 / NX)), mercY(90 - (j + 0.5) * (180 / NY)), 1, 1)
      }
    }
  }

  if (showWind && mapReady && !paused && dt > 0) {
    const k = K * velScale
    const inv = 1 / 111320
    const pxPerDeg = WBASE / 360
    ctx.lineWidth = Math.max(0.5, 1 / view.zoom)
    ctx.lineCap = 'round'
    for (const p of PARTICLES) {
      p.age++
      if (p.age > 320 || p.y < 4 || p.y > WBASE - 4) {
        Object.assign(p, makeParticle())
        continue
      }
      const lon = invLon(p.x)
      const lat = invLat(p.y)
      const u = sampleWind(lon, lat, true)
      const v = sampleWind(lon, lat, false)
      const spd = Math.hypot(u, v)
      const cosl = Math.max(Math.cos((lat * Math.PI) / 180), 0.08)
      let nx = p.x + (u * k * inv * dt / cosl) * pxPerDeg
      const ny = p.y + (v * k * inv * dt) * pxPerDeg
      if (nx < 0) nx += WBASE
      if (nx > WBASE) nx -= WBASE
      if (offScreen(nx, ny) && offScreen(p.x, p.y)) {
        Object.assign(p, makeParticle())
        continue
      }
      if (showParticles) {
        ctx.globalAlpha = Math.max(0.08, 1 - p.age / 320) * opacity
        ctx.strokeStyle = speedColor(spd)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
      }
      p.x = nx
      p.y = ny
    }
    ctx.globalAlpha = 1
  }
}

rebuildParticles(count)
requestAnimationFrame(frame)
