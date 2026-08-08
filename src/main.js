import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './style.css'

const API_KEY = import.meta.env.VITE_NASA_API_KEY || ''
const BASE = import.meta.env.BASE_URL

const app = document.getElementById('app')
const loaderEl = document.getElementById('loader')
const loaderFill = document.getElementById('loader-fill')
const loaderStatus = document.getElementById('loader-status')

if (!window.WebGLRenderingContext) {
  loaderStatus.textContent = 'webgl not supported on this device'
  return
}

/* ---------------- loading manager ---------------- */

const textures = {}
const manager = new THREE.LoadingManager()
const texLoader = new THREE.TextureLoader(manager)
const names = [
  'earth_atmos_2048.jpg',
  'earth_lights_2048.png',
  'earth_clouds_1024.png',
  'earth_specular_2048.jpg',
  'earth_normal_2048.jpg',
  'moon_1024.jpg',
]
manager.onProgress = (url, loaded, total) => {
  loaderFill.style.width = `${(loaded / total) * 100}%`
  loaderStatus.textContent = `loading ${url.split('/').pop()}`
}
manager.onLoad = () => {
  loaderEl.classList.add('hidden')
  animate()
}
manager.onError = (url) => {
  loaderStatus.textContent = `failed to load ${url}`
}

for (const n of names) textures[n.split('.')[0]] = texLoader.load(`${BASE}textures/${n}`)

/* ---------------- renderer / scene / camera ---------------- */

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x020409)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000)
camera.position.set(4.5, 8.5, 19)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 3
controls.maxDistance = 120

/* ---------------- sun ---------------- */

function radialTexture(stops, size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [off, col] of stops) g.addColorStop(off, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const sunRadius = 3
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(sunRadius, 48, 48),
  new THREE.MeshBasicMaterial({
    map: radialTexture([
      [0, '#fffdf4'],
      [0.35, '#fff3c4'],
      [0.7, '#ffd27a'],
      [1, 'rgba(255,150,60,0)'],
    ]),
  })
)
sun.rotation.z = 0.4
scene.add(sun)

const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: radialTexture([
      [0, 'rgba(255,220,150,0.9)'],
      [0.25, 'rgba(255,180,90,0.35)'],
      [1, 'rgba(255,140,60,0)'],
    ], 512),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
)
sunGlow.scale.setScalar(sunRadius * 7)
scene.add(sunGlow)

const sunLight = new THREE.PointLight(0xfff3d6, 900, 0, 2)
sunLight.position.set(0, 0, 0)
scene.add(sunLight)
scene.add(new THREE.AmbientLight(0x1a2740, 0.55))

/* ---------------- earth ---------------- */

const ORBIT_R = 12
const EARTH_R = 1
const TILT = THREE.MathUtils.degToRad(23.44)

const orbitAngle = () => (simTime / (365.256 * 86400)) * Math.PI * 2

const earthGroup = new THREE.Group()
scene.add(earthGroup)

const earthTilt = new THREE.Group()
earthTilt.rotation.z = TILT
earthGroup.add(earthTilt)

const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 96), earthShader())
earthTilt.add(earth)

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R * 1.012, 64, 64),
  new THREE.MeshPhongMaterial({
    map: textures.earth_clouds_1024,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
)
earthTilt.add(clouds)

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R * 1.04, 64, 64),
  atmosphereShader()
)
earthTilt.add(atmosphere)

const orbitPath = new THREE.Mesh(
  new THREE.RingGeometry(ORBIT_R - 0.02, ORBIT_R + 0.02, 160),
  new THREE.MeshBasicMaterial({
    color: 0x57a7ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
)
orbitPath.rotation.x = -Math.PI / 2
scene.add(orbitPath)

/* ---------------- moon ---------------- */

const moonOrbit = new THREE.Group()
earthGroup.add(moonOrbit)
moonOrbit.rotation.z = THREE.MathUtils.degToRad(5.14)

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(0.27, 48, 48),
  new THREE.MeshStandardMaterial({ map: textures.moon_1024, roughness: 1, metalness: 0 })
)
moonOrbit.add(moon)

/* ---------------- stars ---------------- */

function starField(count, radiusMin, radiusMax, size, opacity) {
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const palette = [
    [1, 1, 1],
    [0.75, 0.85, 1],
    [1, 0.9, 0.75],
    [0.85, 0.8, 1],
  ]
  for (let i = 0; i < count; i++) {
    const r = radiusMin + Math.random() * (radiusMax - radiusMin)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.cos(phi)
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    const c = palette[(Math.random() * palette.length) | 0]
    const b = 0.5 + Math.random() * 0.5
    col[i * 3] = c[0] * b
    col[i * 3 + 1] = c[1] * b
    col[i * 3 + 2] = c[2] * b
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const m = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
  })
  return new THREE.Points(g, m)
}

const starsFar = starField(4000, 350, 900, 1.6, 0.85)
const starsNear = starField(900, 120, 260, 2.6, 0.9)
scene.add(starsFar, starsNear)

/* ---------------- shaders ---------------- */

function earthShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: textures.earth_atmos_2048 },
      nightMap: { value: textures.earth_lights_2048 },
      specMap: { value: textures.earth_specular_2048 },
      normalMap: { value: textures.earth_normal_2048 },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      showNight: { value: true },
    },
    vertex: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying mat3 vTBN;

      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;

        vec3 N = normalize(mat3(modelMatrix) * normal);
        vec3 T = normalize(mat3(modelMatrix) * tangent);
        T = normalize(T - N * dot(T, N));
        vec3 B = cross(N, T);
        vTBN = mat3(T, B, N);

        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragment: /* glsl */ `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D specMap;
      uniform sampler2D normalMap;
      uniform vec3 sunDirection;
      uniform bool showNight;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying mat3 vTBN;

      void main() {
        vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        vec3 n = normalize(vTBN * mapN);
        vec3 l = normalize(sunDirection);

        float ndl = dot(n, l);
        float dayAmt = smoothstep(-0.12, 0.32, ndl);

        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;

        vec3 col = day;
        if (showNight) {
          vec3 nightGlow = night * vec3(1.5, 1.7, 2.1) * (0.35 + 0.65 * max(ndl, 0.0));
          col = mix(nightGlow, day, dayAmt);
        } else {
          col = day * (0.25 + 0.85 * max(ndl, 0.0));
        }

        vec3 v = normalize(cameraPosition - vWorldPos);
        vec3 h = normalize(l + v);
        float specAmt = texture2D(specMap, vUv).r;
        vec3 spec = specAmt * pow(max(dot(n, h), 0.0), 28.0) * vec3(1.0, 0.92, 0.78) * 1.7 * dayAmt;

        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 rim = fres * vec3(0.22, 0.42, 0.85) * 1.3 * dayAmt;

        col = col + spec + rim;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

function atmosphereShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertex: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragment: /* glsl */ `
      uniform vec3 sunDirection;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.5);
        float sunAmt = smoothstep(-0.35, 0.55, dot(n, normalize(sunDirection)));
        float alpha = fres * (0.25 + 0.75 * sunAmt);
        vec3 col = mix(vec3(0.18, 0.4, 0.95), vec3(0.45, 0.75, 1.4), sunAmt);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })
}

/* ---------------- time ---------------- */

const SPEEDS = [1, 60, 3600, 86400, 2592000, 31536000]
let simSpeed = SPEEDS[2]
let paused = false
let realtime = true
let simTime = Date.now() / 1000

const speedSlider = document.getElementById('speed')
const speedLabel = document.getElementById('speed-label')

function setSpeed(idx, slider = true) {
  if (idx === -1) {
    paused = !paused
  } else {
    paused = false
    simSpeed = SPEEDS[idx]
    if (slider) speedSlider.value = idx
    document.querySelectorAll('#presets button').forEach((b, i) => {
      b.classList.toggle('active', String(i) === String(idx))
    })
  }
  renderSpeedLabel()
}

function renderSpeedLabel() {
  if (paused) {
    speedLabel.textContent = 'paused'
    return
  }
  const map = { '1': '1×', '60': '60×', '3600': '1d/min', '86400': '1d/s', '2592000': '1mo/s', '31536000': '1yr/s' }
  speedLabel.textContent = paused ? 'paused' : map[String(simSpeed)]
}

speedSlider.addEventListener('input', () => setSpeed(Number(speedSlider.value), false))

document.getElementById('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (b) setSpeed(Number(b.dataset.speed))
})

const toggles = {
  realtime: document.getElementById('t-realtime'),
  clouds: document.getElementById('t-clouds'),
  night: document.getElementById('t-night'),
  moon: document.getElementById('t-moon'),
  orbit: document.getElementById('t-orbit'),
  stars: document.getElementById('t-stars'),
}

for (const [key, btn] of Object.entries(toggles)) {
  btn.addEventListener('click', () => {
    btn.classList.toggle('on')
    applyToggles()
  })
}

function applyToggles() {
  clouds.visible = toggles.clouds.classList.contains('on')
  atmosphere.visible = toggles.clouds.classList.contains('on')
  moonOrbit.visible = toggles.moon.classList.contains('on')
  orbitPath.visible = toggles.orbit.classList.contains('on')
  starsFar.visible = starsNear.visible = toggles.stars.classList.contains('on')
  earth.material.uniforms.showNight.value = toggles.night.classList.contains('on')
  toggles.realtime.classList.toggle('on', realtime)
}

applyToggles()

/* ---------------- clock HUD ---------------- */

const clockTime = document.getElementById('clock-time')
const clockDate = document.getElementById('clock-date')

function fmt(n) {
  return String(n).padStart(2, '0')
}

function tickClock() {
  const d = new Date(simTime * 1000)
  clockTime.textContent = `${fmt(d.getUTCHours())}:${fmt(d.getUTCMinutes())}:${fmt(d.getUTCSeconds())}`
  const date = `${d.getUTCFullYear()}-${fmt(d.getUTCMonth() + 1)}-${fmt(d.getUTCDate())}`
  clockDate.textContent = realtime ? `${date} UTC · synced to earth` : `${date} UTC · simulated`
}
setInterval(tickClock, 200)

/* ---------------- NEO panel ---------------- */

const neoToggle = document.getElementById('neo-toggle')
const neoBody = document.getElementById('neo-body')
const neoList = document.getElementById('neo-list')
const neoStatus = document.getElementById('neo-status')
const neoCount = document.getElementById('neo-count')

neoToggle.addEventListener('click', () => {
  neoBody.style.display = neoBody.style.display === 'none' ? '' : 'none'
})

function fetchNEO() {
  neoStatus.textContent = 'contacting nasa…'
  neoList.innerHTML = ''
  const url = `https://api.nasa.gov/neo/rest/v1/feed/today?detailed=false${API_KEY ? `&api_key=${API_KEY}` : ''}`
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((data) => {
      const objects = Object.values(data.near_earth_objects).flat().sort((a, b) => {
        const ad = +a.close_approach_data[0].miss_distance.kilometers
        const bd = +b.close_approach_data[0].miss_distance.kilometers
        return ad - bd
      })
      neoCount.textContent = objects.length
      neoStatus.textContent = ''
      objects.forEach((o) => {
        const cad = o.close_approach_data[0]
        const km = (+cad.miss_distance.kilometers).toLocaleString('en-US', { maximumFractionDigits: 0 })
        const ld = (+cad.miss_distance.lunar).toFixed(0)
        const v = (+cad.relative_velocity.kilometers_per_second).toFixed(1)
        const sizeMin = o.estimated_diameter.meters.estimated_diameter_min.toFixed(0)
        const sizeMax = o.estimated_diameter.meters.estimated_diameter_max.toFixed(0)
        const li = document.createElement('li')
        li.className = 'neo-item'
        li.title = 'open on JPL small-body database'
        li.addEventListener('click', () => window.open(o.nasa_jpl_url, '_blank'))
        li.innerHTML = `
          <span class="neo-hazard ${o.is_potentially_hazardous_asteroid}"></span>
          <div>
            <div class="neo-name">${escapeHtml(o.name)}</div>
            <div class="neo-meta">${sizeMin}–${sizeMax} m · ${v} km/s</div>
          </div>
          <div class="neo-dist">${ld} LD<small>${km} km</small></div>
        `
        neoList.appendChild(li)
      })
    })
    .catch(() => {
      neoCount.textContent = '—'
      neoStatus.innerHTML =
        'can\u2019t reach nasa right now. <button class="retry">retry</button>'
      neoStatus.querySelector('.retry').addEventListener('click', fetchNEO)
    })
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

fetchNEO()

/* ---------------- animation ---------------- */

const clock3d = new THREE.Clock()
const sunDir = new THREE.Vector3()

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(clock3d.getDelta(), 0.05)

  if (!paused) simTime += delta * simSpeed
  if (realtime) simTime = Date.now() / 1000

  const oa = orbitAngle()
  const earthPos = new THREE.Vector3(Math.cos(oa) * ORBIT_R, 0, Math.sin(oa) * ORBIT_R)
  earthGroup.position.copy(earthPos)

  earthTilt.rotation.y = simTime / 86164 * Math.PI * 2 + oa
  clouds.rotation.y = earthTilt.rotation.y * 1.12 + 0.2

  const ma = (simTime / (27.32 * 86400)) * Math.PI * 2
  moon.position.set(Math.cos(ma) * 2.6, 0, Math.sin(ma) * 2.6)

  sunDir.copy(earthPos).multiplyScalar(-1).normalize()
  earth.material.uniforms.sunDirection.value.copy(sunDir)
  atmosphere.material.uniforms.sunDirection.value.copy(sunDir)
  clouds.material.uniforms = clouds.material.uniforms || {}

  sunGlow.material.rotation += delta * 0.02

  controls.update()
  renderer.render(scene, camera)
}

/* ---------------- resize / hint ---------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

setTimeout(() => document.getElementById('hint').classList.add('hidden'), 9000)

tickClock()
setSpeed(2)
