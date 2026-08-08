import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './style.css'

/* ---------------- renderer ---------------- */

const canvas = document.getElementById('map')

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.05,
  4000
)
const CAM_DEFAULT = new THREE.Vector3(5.2, 2.3, 7.0)
camera.position.copy(CAM_DEFAULT)

/* ---------------- controls ---------------- */

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0, 0)
controls.enableDamping = true
controls.dampingFactor = 0.07
controls.rotateSpeed = 0.55
controls.panSpeed = 0.6
controls.zoomSpeed = 0.75
controls.minDistance = 2.15
controls.maxDistance = 110

canvas.addEventListener('contextmenu', (e) => e.preventDefault())
controls.addEventListener('start', () => canvas.classList.add('dragging'))
controls.addEventListener('end', () => canvas.classList.remove('dragging'))

/* ---------------- light ---------------- */

const SUN_DIR = new THREE.Vector3(0.9, 0.22, 0.36).normalize()

const sun = new THREE.DirectionalLight(0xffffff, 2.8)
sun.position.copy(SUN_DIR).multiplyScalar(-60)
sun.target.position.set(0, 0, 0)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -5
sun.shadow.camera.right = 5
sun.shadow.camera.top = 5
sun.shadow.camera.bottom = -5
sun.shadow.camera.near = 1
sun.shadow.camera.far = 140
sun.shadow.bias = -0.0004
sun.shadow.camera.updateProjectionMatrix()
scene.add(sun, sun.target)

const ambient = new THREE.AmbientLight(0x0c1620, 0.12)
scene.add(ambient)

/* ---------------- stars ---------------- */

const STAR_COUNT = 8000
const starPos = new Float32Array(STAR_COUNT * 3)
const starCol = new Float32Array(STAR_COUNT * 3)
for (let i = 0; i < STAR_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2
  const cosPhi = 2 * Math.random() - 1
  const sinPhi = Math.sqrt(1 - cosPhi * cosPhi)
  const r = 600 + Math.random() * 900
  const i3 = i * 3
  starPos[i3] = r * sinPhi * Math.cos(theta)
  starPos[i3 + 1] = r * sinPhi * Math.sin(theta)
  starPos[i3 + 2] = r * cosPhi

  const tint = Math.random()
  let cr
  let cg
  let cb
  const b = 0.45 + Math.random() * 0.55
  if (tint < 0.78) {
    cr = b * (0.92 + Math.random() * 0.08)
    cg = b
    cb = b
  } else if (tint < 0.9) {
    cr = 1
    cg = 0.86 + Math.random() * 0.12
    cb = 0.76 + Math.random() * 0.14
  } else {
    cr = 0.78 + Math.random() * 0.18
    cg = 0.86 + Math.random() * 0.12
    cb = 1
  }
  starCol[i3] = cr
  starCol[i3 + 1] = cg
  starCol[i3 + 2] = cb
}

const starGeo = new THREE.BufferGeometry()
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
const starMat = new THREE.PointsMaterial({
  size: 1.1,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
})
scene.add(new THREE.Points(starGeo, starMat))

/* ---------------- textures ---------------- */

const maxAniso = renderer.capabilities.getMaxAnisotropy()
const loader = new THREE.TextureLoader()
const BASE = import.meta.env.BASE_URL + 'textures/'

function fallbackTex(r, g, b, a = 1) {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 2
  const x = c.getContext('2d')
  x.fillStyle = `rgba(${r},${g},${b},${a})`
  x.fillRect(0, 0, 2, 2)
  return new THREE.CanvasTexture(c)
}

let remaining = 6
const doneOne = () => {
  remaining--
  if (remaining <= 0) document.getElementById('loader').classList.add('hidden')
}
setTimeout(() => document.getElementById('loader').classList.add('hidden'), 8000)

const T = {}
const defs = {
  day: ['earth_atmos_2048.jpg', true, () => fallbackTex(28, 46, 70)],
  bump: ['earth_normal_2048.jpg', false, () => fallbackTex(128, 128, 128)],
  spec: ['earth_specular_2048.jpg', false, () => fallbackTex(96, 96, 96)],
  lights: ['earth_lights_2048.png', true, () => fallbackTex(4, 4, 6)],
  clouds: ['earth_clouds_1024.png', true, () => fallbackTex(255, 255, 255, 0)],
  moon: ['moon_1024.jpg', true, () => fallbackTex(120, 120, 120)],
}
for (const [key, [file, srgb, fb]] of Object.entries(defs)) {
  const t = loader.load(
    BASE + file,
    doneOne,
    undefined,
    () => {
      T[key] = fb()
      doneOne()
    }
  )
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = maxAniso
  T[key] = t
}

/* ---------------- earth ---------------- */

const tiltGroup = new THREE.Group()
tiltGroup.rotation.z = -0.4091
scene.add(tiltGroup)

const spinGroup = new THREE.Group()
tiltGroup.add(spinGroup)

const earthMat = new THREE.MeshPhongMaterial({
  map: T.day,
  bumpMap: T.bump,
  bumpScale: 0.02,
  specularMap: T.spec,
  specular: new THREE.Color(0x808080),
  shininess: 24,
  emissive: new THREE.Color(1.5, 1.35, 1.1),
  emissiveMap: T.lights,
})

earthMat.onBeforeCompile = (shader) => {
  shader.uniforms.uSunDir = { value: SUN_DIR.clone() }
  shader.fragmentShader = 'uniform vec3 uSunDir;\n' + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
      totalEmissiveRadiance *= 1.0 - smoothstep(-0.1, 0.34, dot(normalize(normal), normalize(mat3(viewMatrix) * uSunDir)));`
  )
}

const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), earthMat)
earthMesh.castShadow = true
spinGroup.add(earthMesh)

/* ---------------- clouds ---------------- */

const cloudMat = new THREE.MeshPhongMaterial({
  map: T.clouds,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  shininess: 10,
  specular: new THREE.Color(0x222222),
})
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.025, 96, 96), cloudMat)
spinGroup.add(cloudMesh)

/* ---------------- atmosphere ---------------- */

const atmoMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uSunDir: { value: SUN_DIR.clone() },
    uColor: { value: new THREE.Color(0.38, 0.55, 0.85) },
  },
  vertexShader: `
    varying vec3 vNormalW;
    varying vec3 vViewW;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewW = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDir;
    uniform vec3 uColor;
    varying vec3 vNormalW;
    varying vec3 vViewW;
    void main() {
      float rim = pow(1.0 - abs(dot(vNormalW, vViewW)), 3.0);
      float day = smoothstep(-0.05, 0.35, dot(vNormalW, uSunDir));
      float a = rim * (0.25 + 1.35 * day);
      vec3 c = mix(uColor * 0.6, uColor, day);
      gl_FragColor = vec4(c * a, a);
    }
  `,
})
const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(1.055, 96, 96), atmoMat)
atmoMesh.renderOrder = 2
spinGroup.add(atmoMesh)

/* ---------------- moon ---------------- */

const orbitGroup = new THREE.Group()
orbitGroup.rotation.z = 0.052
orbitGroup.rotation.x = 0.012
scene.add(orbitGroup)

const moonMat = new THREE.MeshStandardMaterial({
  map: T.moon,
  bumpMap: T.moon,
  bumpScale: 0.035,
  roughness: 0.92,
  metalness: 0.0,
})
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 72, 72), moonMat)
moonMesh.position.set(14.2, 0, 0)
moonMesh.receiveShadow = true
orbitGroup.add(moonMesh)

/* ---------------- state / ui ---------------- */

const state = {
  paused: false,
  rotSpeed: 1,
  orbSpeed: 1,
  earthAngle: 0,
  orbitAngle: Math.PI,
}

const panel = document.getElementById('panel')
const btnPause = document.getElementById('btn-pause')
const btnReset = document.getElementById('btn-reset')
const optRot = document.getElementById('opt-rot')
const optOrb = document.getElementById('opt-orb')
const valRot = document.getElementById('val-rot')
const valOrb = document.getElementById('val-orb')

btnPause.addEventListener('click', () => {
  state.paused = !state.paused
  btnPause.textContent = state.paused ? 'resume' : 'pause'
})

optRot.addEventListener('input', () => {
  state.rotSpeed = +optRot.value
  valRot.textContent = state.rotSpeed.toFixed(2)
})
optOrb.addEventListener('input', () => {
  state.orbSpeed = +optOrb.value
  valOrb.textContent = state.orbSpeed.toFixed(2)
})

let camTween = null
function flyTo(pos, dur = 1.4) {
  camTween = { from: camera.position.clone(), to: pos.clone(), t: 0, dur }
}

btnReset.addEventListener('click', () => {
  state.earthAngle = 0
  state.orbitAngle = Math.PI
  spinGroup.rotation.y = 0
  cloudMesh.rotation.y = 0
  orbitGroup.rotation.y = Math.PI
  moonMesh.rotation.y = Math.PI
  flyTo(CAM_DEFAULT)
})

let idleTimer = null
const armIdle = () => {
  clearTimeout(idleTimer)
  panel.classList.remove('idle')
  idleTimer = setTimeout(() => panel.classList.add('idle'), 4200)
}
window.addEventListener('pointermove', armIdle, { passive: true })
armIdle()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

/* ---------------- loop ---------------- */

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)

  if (!state.paused) {
    state.earthAngle += dt * 0.045 * state.rotSpeed
    state.orbitAngle += dt * 0.02 * state.orbSpeed
    spinGroup.rotation.y = state.earthAngle
    cloudMesh.rotation.y = state.earthAngle * 1.12
    orbitGroup.rotation.y = state.orbitAngle
    moonMesh.rotation.y = state.orbitAngle
  }

  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt / camTween.dur)
    const k = camTween.t * camTween.t * (3 - 2 * camTween.t)
    camera.position.lerpVectors(camTween.from, camTween.to, k)
    if (camTween.t >= 1) camTween = null
  }

  controls.update()
  renderer.render(scene, camera)
}

animate()
