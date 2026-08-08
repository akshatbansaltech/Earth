# EARTH 3D

A little slice of space on your screen. A realistically rendered Earth with the Moon swinging around it, lit by the actual Sun, computed from the real date rather than a hardcoded light.

**Live demo:** https://akshatbansaltech.github.io/Earth/

## What this is

A 3D Earth-and-Moon visualization that tries hard to look like something NASA would put on a wall, not like a screensaver. The whole thing is built around one idea: the Sun is a real light source, and the scene follows it.

## What's in it

- **Earth.** Actual NASA satellite imagery on a sphere. Day map, surface relief, specular glints off the ocean, and city lights that only wake up on the night side, fading in softly across the terminator
- **Atmosphere.** A whisper-thin scattering shell. You mostly notice it as a faint blue rim hugging the sunlit edge
- **Clouds.** A real photographic cloud layer drifting at its own slightly different speed, like the planet breathes
- **Moon.** Cratered lunar surface with real bump mapping, tidally locked (same face always toward Earth), and its phase changes as it orbits because the Sun lights it the same way it lights Earth
- **The Sun.** Not a glowing sticker. Its actual position for today's date is computed (ecliptic longitude + solar declination), the sun disc and its corona sit there in the scene, and the lighting follows. Orbit the camera and the sun sets behind the planet
- **Stars.** A few thousand procedural stars with natural brightness and color variation. No repeating texture, no weird twinkling
- **Camera.** Damped, smooth orbit/pan/zoom. Clamped so you can't fly through the planet. Reset glides back to the original shot
- **A date + position readout.** Top-left corner: today's date (UTC) and where Earth actually is in its orbit right now (heliocentric longitude)

## Controls

| Action | Input |
|---|---|
| Orbit | Left drag |
| Pan | Right drag |
| Zoom | Scroll |
| Pause / Reset / Speed | Small panel, bottom-left, fades out when you stop touching it |

## Tech

- [three.js](https://threejs.org), the 3D engine
- [Vite](https://vitejs.dev), builds the thing
- [NASA Visible Earth](https://visibleearth.nasa.gov), the textures
- Hand-written CSS, no frameworks, no templates

## Running it

```bash
npm install
npm run dev      # local dev
npm run build    # production build into dist/
```

## The math

The Sun direction is derived from the real date (Lowell/NOAA-style solar position approximation), which sets the lighting, the terminator, and the Moon's phase. It's good to ~0.01° for our purposes. No leap second obsessions here.
