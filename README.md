# Spinno Studio

3D device mockup studio — drop a UI screenshot (or video) onto a phone, tablet, laptop, or monitor, then style the scene and export a high‑resolution PNG/MP4.

## Features

- **Devices**: mobile phone, tablet, laptop, desktop monitor — each with an accurately fitted screen.
- **Drag & drop routing**: drop on the device to set the UI screen, drop on the background for a backdrop image.
- **Materials**: keep the original finish or recolor the device (matte, silver, white, space grey, custom).
- **Glossy screens**: adjustable screen reflectivity with a real environment map.
- **Lighting**: drag a light around a hemisphere pad, choose a lighting style, brightness, and shadow softness.
- **Camera**: tilt/spin pad, roll, zoom, plus direct orbit/pan/zoom on the canvas.
- **Backdrop layer**: drop an image behind the device with its own position/scale.
- **Export**: PNG or MP4 (MP4 matches the imported clip length) — always captures the entire visible canvas, never cropped to a fixed size.
- Light / dark UI, and a preview mode that hides all controls.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Deploy

Pushing to `main` builds and publishes the site to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.

## Tech

React + Vite + three.js.
