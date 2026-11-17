# Fortune Cookies

A small daily ritual: ten floating, golden 3D fortune cookies, one personal fortune, and a paper slip worth keeping.

**Site:** https://ariandr.github.io/fortune-cookies/

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (including `/fortune-cookies/`).

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

## Experience

Click, tap, swipe at least 36 pixels, or use Tab and Enter/Space to choose a cookie. The selected cookie moves forward, its two wafer shells split, crumbs fall, and a paper slip unfurls. A copy button lets you keep the words.

There is one draw per **local calendar day**, per browser. A reservation is saved before animation, so interruptions and reloads preserve the same fortune. A new draw becomes available at local midnight, including when a previously hidden tab is reopened. Web Locks coordinate simultaneous tabs where supported; storage events synchronize open pages. In browsers without Web Locks, reservations are best effort across exactly simultaneous tabs.

The app draws without replacement from 500 original English fortunes. After the collection is exhausted, a fresh cycle begins without immediately repeating the previous draw. Records have explicit permanent IDs; preserve those IDs when editing the text collection.

No account or server is required. Clearing browser storage or changing devices starts a separate history. If storage is denied or full, the app preserves its draw in memory for the current visit and displays a short notice.

## Rendering and accessibility

The cookie is an original procedural folded wafer with inner and outer walls, matching fracture edges, and a locally generated surface texture. Geometry, materials, and lighting are shared across the ten instances. The paper is a deforming mesh, with readable HTML positioned from its projected coordinates at rest.

The Three.js scene is loaded separately from the interface. Pixel density is capped and rendering pauses in hidden tabs. Fonts are self-hosted using Fontsource packages; no external assets or APIs are fetched at runtime.

Reduced-motion preferences replace motion with a brief reveal. An original SVG/CSS scene is used when WebGL is unavailable, the graphics context is lost, or rendering fails. For manual fallback QA, append `?fallback` to the URL. This does not bypass the daily draw.

Cookie controls have accessible names, keyboard focus indicators, and matching pointer hit areas. The revealed fortune is announced and receives keyboard focus.

## Fortune source research

The bundled collection was chosen to control tone, sentence length, and repetitions while avoiding network dependencies.

- [Dumb APIs](https://dumbapis.com/docs/fortune/): a viable keyless, CORS-enabled alternative with 382 fortunes, rate limits, and possible repeats.
- [Advice Slip](https://api.adviceslip.com/): free general advice, with a two-second cache; not specifically optimistic fortune predictions.
- [ZenQuotes](https://docs.zenquotes.io/zenquotes-documentation/): attributed quotations, free-tier usage limits, and a key or registered IP required to enable CORS.

## Deployment

GitHub Actions runs type checking, collection/draw tests, and the production build. Pushes to `main` then publish `dist` to GitHub Pages; pull requests run verification only.

Enable **Settings → Pages → Source: GitHub Actions**. The Vite base is `/fortune-cookies/`, matching the repository name. For another repository or a custom domain, update the base in `vite.config.ts`.

## Project map

- `src/data/fortunes.txt`: 500 explicit `id|text` records.
- `src/lib/daily.ts`: selection, local dates, persistence, and cross-tab reservation.
- `src/scene/`: procedural geometry, lighting, layout, and animation.
- `src/ui/`: accessible input targets and the SVG fallback.
- `src/App.tsx`: daily lifecycle and printed fortune interface.

Third-party font licenses are included with the installed Fontsource packages and are reproduced in `THIRD_PARTY_NOTICES.md`.
