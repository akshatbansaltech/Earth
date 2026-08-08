# EARTH — in Orbit 🌍

A live, interactive 3D model of Earth orbiting the Sun — rendered with real NASA texture data, synced to real time, and fed with live NASA near-earth object (asteroid) telemetry.

**Live demo:** https://akshatbansaltech.github.io/Earth/

## Features

- 🪐 **Realistic Earth** — custom GLSL shader mixing real NASA day-map, night-lights, specular ocean highlights and surface normal maps; fresnel atmosphere glow; drifting cloud layer; 23.44° axial tilt
- ⏱ **Real-time sync** — the planet's rotation matches actual sidereal time; toggle to simulated time and crank the clock from 1× to a year per second
- ☀️ **The Sun** — emissive disc, radial glow, and dynamic lighting that travels with Earth's orbit (day/night terminator is real)
- 🌙 **The Moon** — orbits Earth on its real 5.14° inclined plane
- ☄️ **Live NASA data** — the *Near Earth Objects* panel pulls today's asteroid flybys from the NASA NEO API: size, miss distance, relative velocity, and hazardous-object flags. Click any object for its JPL page
- ✨ Procedural starfield, orbit path overlay, orbit/zoom camera controls, mobile-friendly HUD

## Tech stack

| Layer | Choice |
|---|---|
| 3D | [three.js](https://threejs.org) |
| Build | [Vite](https://vitejs.dev) |
| Data | [NASA Open APIs](https://api.nasa.gov) |
| Deploy | GitHub Pages (GitHub Actions) |
| Styling | Hand-written CSS (no frameworks, no templates) |

## Getting started

```bash
npm install
npm run dev      # local dev at http://localhost:5173
npm run build    # production build into dist/
```

### NASA API key (optional)

Create `Earth/.env` (gitignored):

```
VITE_NASA_API_KEY=your_key_here
```

Without a key the site still works — the NEO panel falls back to NASA's anonymous quota. Get a free key at https://api.nasa.gov

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages automatically (source: **GitHub Actions**). Deployed URL: `https://<user>.github.io/<repo>/`.

## Project structure

```
.github/workflows/deploy.yml   # CI/CD: build + deploy to Pages
public/textures/               # NASA Visible Earth texture maps
src/main.js                    # three.js scene, shaders, HUD logic, NEO fetcher
src/style.css                  # hand-built UI system
index.html                     # HUD shell
```

## Acknowledgements

- Earth/cloud/moon textures: [NASA Visible Earth](https://visibleearth.nasa.gov)
- Asteroid data: NASA JPL / [NEO API](https://api.nasa.gov)
- Built as a web development competition entry
