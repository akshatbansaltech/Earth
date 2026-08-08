# Devlog — MERCURY

Web dev competition build log.

## Day 1 · 2026-08-08 — scaffolding

- Repo `akshatbansaltech/Earth` created; site named **MERCURY** (codenamed Earth).
- **Bug found:** GitHub Pages never deployed because `.github/workflows/deploy.yml` was an empty 0-byte file — the action run "failed" with zero jobs. Also `vite.config.js` was empty, so there was no `base` path (any build would have 404'd assets on Pages).
- **Fixed:** real build+deploy workflow (actions/checkout → setup-node → vite build → configure-pages → upload-pages-artifact → deploy-pages), `base: '/Earth/'` in vite config, `.env` gitignored so the NASA key stays private.
- First green build, first successful action run.

## Day 1 · 2026-08-08 — the scene

- Installed `three` (bundled by Vite, no CDN dependency).
- Pulled 6 real NASA Visible Earth textures into `public/textures/` (day map 2048², night lights, clouds, specular, normal, moon).
- Wrote a custom GLSL earth shader: day/night maps mixed by actual sun direction, tangent-space normal mapping, specular ocean glint, fresnel rim light.
- Added atmosphere glow shader (additive, sun-aware), drifting cloud shell, 23.44° axial tilt, moon on its 5.14° inclined orbit.
- Sun: emissive radial-gradient disc + additive glow sprite + point light. Procedural two-layer starfield.
- Time model: `simTime` in seconds; Earth rotation uses real sidereal day (86,164 s), orbit uses the tropical year. **Realtime sync mode** pins simTime to the wall clock, so the planet matches the real one.

## Day 1 · 2026-08-08 — data + UI

- NEO panel: `GET /neo/rest/v1/feed/today` from NASA's API — sorted by miss distance, shows size range, velocity, lunar-distance + km, hazard flags; click opens JPL.
- Hand-built HUD: glass panels, Space Grotesk/Inter, time-scale presets (⏸ → 1yr/s), toggles (clouds / night lights / moon / orbit / stars), live UTC clock.
- Graceful degradation: if NASA's API 500s (it did, on APOD) the panel shows a retry button instead of breaking.

## Next

- Polish pass on mobile layout, maybe APOD feature, devlog page on site.
