import './style.css'

/* ---------------- canvas / view ---------------- */

const canvas = document.getElementById('map')
const ctx = canvas.getContext('2d')

const trailCanvas = document.createElement('canvas')
const trailCtx = trailCanvas.getContext('2d')

let W = 0
let H = 0
let dpr = 1

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  trailCanvas.width = W * dpr
  trailCanvas.height = H * dpr
}
resize()
window.addEventListener('resize', resize)

/* ---------------- mercator world ---------------- */

const WBASE = 1024
const YMAX = Math.atanh(Math.sin((85 * Math.PI) / 180))
const PX_PER_DEG = WBASE / 360

const mercX = (lon) => ((lon + 180) / 360) * WBASE
const mercY = (lat) => WBASE * (1 - (Math.atanh(Math.sin((lat * Math.PI) / 180)) / YMAX + 1) / 2)
const invLon = (x) => (x / WBASE) * 360 - 180
const invLat = (y) => Math.asin(Math.tanh((1 - (2 * y) / WBASE) * YMAX)) * (180 / Math.PI)

let view = { zoom: 1, cx: WBASE / 2, cy: WBASE / 2, panX: 0, panY: 0 }

function fitZoom() {
  return Math.min(1, (Math.min(W, H) / WBASE) * 0.96)
}

function resetView() {
  view = { zoom: fitZoom(), cx: WBASE / 2, cy: WBASE / 2, panX: 0, panY: 0 }
}
resetView()

function applyView() {
  const t = dpr * view.zoom
  ctx.setTransform(
    t, 0, 0, t,
    dpr * (W / 2 - view.cx * view.zoom + view.panX),
    dpr * (H / 2 - view.cy * view.zoom + view.panY)
  )
}

/* ---------------- noise ---------------- */

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

function makeNoise(seed, nx = 36, ny = 18) {
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

/* ---------------- map layer (never fades) ---------------- */

const bgMap = document.createElement('canvas')
bgMap.width = bgMap.height = WBASE
const bgCtx = bgMap.getContext('2d')
let mapReady = false

function shadePixel(s, x0, y0, x1, y1, xf, yf, d, idx) {
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
  d[idx] = base[0] * f
  d[idx + 1] = base[1] * f
  d[idx + 2] = base[2] * f
  d[idx + 3] = 255
}

function buildMap(src) {
  const tmp = document.createElement('canvas')
  tmp.width = WBASE
  tmp.height = WBASE / 2
  tmp.getContext('2d').drawImage(src, 0, 0, WBASE, WBASE / 2)
  const s = tmp.getContext('2d').getImageData(0, 0, WBASE, WBASE / 2).data
  const out = bgCtx.createImageData(WBASE, WBASE)
  const d = out.data
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
      shadePixel(s, x0, y0, x1, y1, fx - x0, yf, d, (y * WBASE + x) * 4)
    }
  }
  bgCtx.putImageData(out, 0, 0)
  mapReady = true
  document.getElementById('loader').classList.add('hidden')
}

function buildFallbackMap() {
  const out = bgCtx.createImageData(WBASE, WBASE)
  const d = out.data
  for (let y = 0; y < WBASE; y++) {
    const lat = invLat(y)
    for (let x = 0; x < WBASE; x++) {
      const lon = invLon(x)
      const land = n1(lon, lat) + 0.5 * n2(lon * 3 + 11, lat * 3 - 5) > 0.15
      const base = land ? [96, 108, 82] : [8, 24, 40]
      const f = 0.6 + 0.4 * n2(lon * 7 - 3, lat * 7 + 2)
      const idx = (y * WBASE + x) * 4
      d[idx] = base[0] * f
      d[idx + 1] = base[1] * f
      d[idx + 2] = base[2] * f
      d[idx + 3] = 255
    }
  }
  bgCtx.putImageData(out, 0, 0)
  mapReady = true
  document.getElementById('loader').classList.add('hidden')
}

const mapImg = new Image()
mapImg.src = `${import.meta.env.BASE_URL}textures/earth_atmos_2048.jpg`
mapImg.onload = () => buildMap(mapImg)
mapImg.onerror = buildFallbackMap
setTimeout(() => {
  if (!mapReady) buildFallbackMap()
}, 8000)

/* ---------------- wind field ---------------- */

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

/* ---------------- particles (batched by speed bucket) ---------------- */

const MAX_AGE = 180
const BUCKETS = 20
const COLORS = []
{
  const stops = [
    [0, [242, 251, 255]], [2, [205, 238, 247]], [4, [154, 214, 234]], [6, [108, 184, 221]],
    [8, [74, 148, 201]], [10, [63, 127, 184]], [12, [90, 168, 104]], [14, [143, 207, 95]],
    [16, [201, 226, 79]], [18, [240, 210, 74]], [20, [240, 176, 60]], [22, [240, 138, 60]],
    [24, [240, 100, 60]], [26, [232, 74, 74]], [28, [216, 68, 124]], [30, [199, 68, 168]],
    [32, [176, 74, 200]], [34, [154, 84, 216]], [36, [122, 92, 216]], [38, [106, 104, 196]],
  ]
  for (let i = 0; i < BUCKETS; i++) {
    const s = i * 2
    let a = stops[0]
    let b = stops[stops.length - 1]
    for (let k = 0; k < stops.length - 1; k++) {
      if (s <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break }
    }
    const t = Math.min(1, Math.max(0, (s - a[0]) / (b[0] - a[0])))
    const ca = a[1]
    const cb = b[1]
    COLORS.push(`rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(ca[1] + (cb[1] - ca[1]) * t)},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`)
  }
}

const bucketX = new Array(BUCKETS).fill(0).map(() => new Float32Array(20000))
const bucketY = new Array(BUCKETS).fill(0).map(() => new Float32Array(20000))
const bucketNX = new Array(BUCKETS).fill(0).map(() => new Float32Array(20000))
const bucketNY = new Array(BUCKETS).fill(0).map(() => new Float32Array(20000))
const bucketLen = new Int32Array(BUCKETS)
const MAX_PARTICLES = 20000

const pX = new Float32Array(MAX_PARTICLES)
const pY = new Float32Array(MAX_PARTICLES)
const pAge = new Float32Array(MAX_PARTICLES)

function rebuildParticles(n) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pX[i] = Math.random() * WBASE
    pY[i] = Math.random() * WBASE
    pAge[i] = Math.random() * MAX_AGE
    if (i >= n) pAge[i] = MAX_AGE + 1
  }
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
const K = 110000
const INV = 1 / 111320

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
    const on = key === 'wind' ? showWind : key === 'particles' ? showParticles : key === 'grid' ? showGrid : trails
    row.querySelector('.state').textContent = on ? 'on' : 'off'
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
  try { canvas.setPointerCapture(e.pointerId) } catch (err) {}
})

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  view.panX += e.clientX - lastX
  view.panY += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
})

canvas.addEventListener('pointerup', () => {
  dragging = false
  canvas.classList.remove('dragging')
})

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const minZ = fitZoom() * 0.35
  const nz = Math.min(14, Math.max(minZ, view.zoom * Math.exp(-e.deltaY * 0.0012)))
  const wx = (e.clientX - (W / 2 + view.panX)) / view.zoom + view.cx
  const wy = (e.clientY - (H / 2 + view.panY)) / view.zoom + view.cy
  view.zoom = nz
  view.cx = wx - (e.clientX - (W / 2 + view.panX)) / nz
  view.cy = wy - (e.clientY - (H / 2 + view.panY)) / nz
}, { passive: false })

canvas.addEventListener('dblclick', resetView)

/* ---------------- render loop ---------------- */

let last = performance.now()

function screenX(wx) {
  return (wx - view.cx) * view.zoom + W / 2 + view.panX
}
function screenY(wy) {
  return (wy - view.cy) * view.zoom + H / 2 + view.panY
}

function frame(now) {
  requestAnimationFrame(frame)
  const dt = paused ? 0 : Math.min((now - last) / 1000, 0.05)
  last = now

  /* screen pass */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#01060c'
  ctx.fillRect(0, 0, W, H)

  /* world pass */
  applyView()
  if (mapReady) ctx.drawImage(bgMap, 0, 0)

  if (showGrid) {
    const path = new Path2D()
    for (let j = 0; j < NY; j++) {
      const gy = mercY(90 - (j + 0.5) * (180 / NY))
      for (let i = 0; i < NX; i++) {
        path.rect(mercX(-180 + (i + 0.5) * (360 / NX)) - 0.5 / view.zoom, gy - 0.5 / view.zoom, 1 / view.zoom, 1 / view.zoom)
      }
    }
    ctx.fillStyle = 'rgba(120,170,210,0.28)'
    ctx.fill(path)
  }

  /* wind pass — drawn on the trail layer, map untouched */
  if (showWind && mapReady && !paused) {
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (trails) {
      trailCtx.fillStyle = 'rgba(1,6,12,0.08)'
      trailCtx.fillRect(0, 0, W, H)
    } else {
      trailCtx.clearRect(0, 0, W, H)
    }

    trailCtx.setTransform(
      dpr * view.zoom, 0, 0, dpr * view.zoom,
      dpr * (W / 2 - view.cx * view.zoom + view.panX),
      dpr * (H / 2 - view.cy * view.zoom + view.panY)
    )

    const k = K * velScale
    const lw = 1 / view.zoom
    trailCtx.lineWidth = lw
    trailCtx.lineCap = 'round'

    for (let b = 0; b < BUCKETS; b++) bucketLen[b] = 0

    const n = Math.min(count, MAX_PARTICLES)
    for (let i = 0; i < n; i++) {
      pAge[i]++
      if (pAge[i] > MAX_AGE) {
        pX[i] = Math.random() * WBASE
        pY[i] = Math.random() * WBASE
        pAge[i] = 0
        continue
      }
      const x = pX[i]
      const y = pY[i]
      if (y < 4 || y > WBASE - 4) {
        pX[i] = Math.random() * WBASE
        pY[i] = Math.random() * WBASE
        pAge[i] = 0
        continue
      }
      const lon = invLon(x)
      const lat = invLat(y)
      const u = sampleWind(lon, lat, true)
      const v = sampleWind(lon, lat, false)
      const cosl = Math.max(Math.cos((lat * Math.PI) / 180), 0.08)
      let nx = x + (u * k * INV * dt / cosl) * PX_PER_DEG
      const ny = y + (v * k * INV * dt) * PX_PER_DEG
      if (nx < 0) nx += WBASE
      if (nx > WBASE) nx -= WBASE
      const sx = screenX(x)
      const sy = screenY(y)
      if ((sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) &&
          (screenX(nx) < -30 || screenX(nx) > W + 30 || screenY(ny) < -30 || screenY(ny) > H + 30)) {
        pX[i] = Math.random() * WBASE
        pY[i] = Math.random() * WBASE
        pAge[i] = 0
        continue
      }
      pX[i] = nx
      pY[i] = ny
      const b = Math.min(BUCKETS - 1, Math.floor(Math.hypot(u, v) / 2))
      const l = bucketLen[b]
      if (l < 20000) {
        bucketX[b][l] = x
        bucketY[b][l] = y
        bucketNX[b][l] = nx
        bucketNY[b][l] = ny
        bucketLen[b] = l + 1
      }
    }

    for (let b = 0; b < BUCKETS; b++) {
      const l = bucketLen[b]
      if (!l) continue
      const path = new Path2D()
      for (let i = 0; i < l; i++) {
        path.moveTo(bucketX[b][i], bucketY[b][i])
        path.lineTo(bucketNX[b][i], bucketNY[b][i])
      }
      trailCtx.strokeStyle = COLORS[b]
      trailCtx.stroke(path)
    }

    if (showParticles) {
      const path = new Path2D()
      const s = 1 / view.zoom
      for (let i = 0; i < n; i++) {
        if (pAge[i] > MAX_AGE) continue
        path.rect(pX[i] - s / 2, pY[i] - s / 2, s, s)
      }
      trailCtx.fillStyle = 'rgba(255,255,255,0.55)'
      trailCtx.fill(path)
    }
  }

  /* blit trail layer on top of the map */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (showWind) {
    ctx.globalAlpha = opacity
    ctx.drawImage(trailCanvas, 0, 0)
    ctx.globalAlpha = 1
  }
}

rebuildParticles(count)
requestAnimationFrame(frame)
