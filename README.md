# EARTH — 3D

A realistic 3D Earth-and-Moon visualization, rendered with real NASA satellite imagery. The intent is a calm, photographic view of the planet from space — like a spacecraft observation, not a screensaver.

**Live demo:** https://akshatbansaltech.github.io/Earth/

## Features

- **Earth** — NASA Blue Marble day map with normal/bump relief, specular ocean highlights, and subtle night-time city lights that appear only on the dark side with a soft terminator transition
- **Atmosphere** — thin physically-inspired scattering layer, visible only around the illuminated limb
- **Clouds** — separate photographic cloud layer that drifts at its own slightly different rotation speed
- **Moon** — real lunar imagery with bump-mapped craters, tidally locked to Earth, orbiting with naturally changing phases
- **Lighting** — single directional sun; day/night separation is genuine, the night side is genuinely dark
- **Space** — 8000 procedural stars with natural brightness and color variation, no repeating texture
- **Camera** — damped orbit/pan/zoom controls, clamped so you can't fly through the planet, smooth reset
- **UI** — minimal panel with pause/resume/reset and speed controls; auto-fades when idle

## Tech stack

| Layer | Choice |
|---|---|
| 3D | [three.js](https://threejs.org) |
| Build | [Vite](https://vitejs.dev) |
| Textures | NASA Visible Earth |
| Styling | Hand-written CSS (no frameworks) |

## Getting started

```bash
npm install
npm run dev      # local dev
npm run build    # production build into dist/
```

## Project structure

```
public/textures/   # NASA Earth texture maps (day, night, spec, normal, clouds, moon)
src/main.js        # three.js scene, shaders, controls, UI
src/style.css      # minimal UI styles
index.html         # app shell
```

## Acknowledgements

- Earth/cloud/moon textures: [NASA Visible Earth](https://visibleearth.nasa.gov)
