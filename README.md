# Car Database

A personal encyclopedia of interesting cars. React + Vite, no backend —
everything is static JSON and images. See [VISION.md](VISION.md) for the full
project vision.

## Run it

```
npm install
npm run dev        # local dev server
npm run build      # static site in dist/ — deploy anywhere
```

The build uses relative paths and hash routing, so `dist/` works as-is on
GitHub Pages, Cloudflare Pages, or any static host with zero configuration.

## Structure

```
public/
├── data/
│   ├── brands.json            # brand list + themes + brand-page hero text
│   └── pagani.json            # one file per brand, lazy-loaded per route
└── images/
    └── pagani/<car-slug>/     # 1.jpg, 2.jpg… +
        └── credits.json       # {"1.jpg": "Photo: Name, License, Source"}
src/                           # the app (pages, components, lib)
scripts/migrate-photos.mjs     # one-time: decoded the old app's photo backup
```

## Adding a car

1. Add an entry to `public/data/<brand>.json` (`id` is `<brand>/<slug>`).
2. Drop web-res photos (~1600px, q85) in `public/images/<brand>/<slug>/`,
   numbered `1.jpg`, `2.jpg`… — the first one is the cover/hero.
3. List the filenames in the car's `images` array and add credit strings to
   `credits.json` in the same folder (publish-safe sources only — see
   VISION.md for the licensing rules).
4. Push. The site updates.

## Adding a brand

Add an entry to `public/data/brands.json` with a `data` path, a `theme`
(accent, familyAccents, fonts, texture) and an optional `hero` block for the
brand-page header, then create its `public/data/<brand>.json`. If the theme
uses new fonts, add them to the Google Fonts link in `index.html`. No new
components needed — theming is CSS-variable driven.

Favorites are stored in localStorage on each visitor's device.
