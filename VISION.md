# Car Database — Project Vision

## What this is

A personal encyclopedia of interesting cars, built as a web app. It started as a
single-file interactive database of every Pagani ever made (50 cars: all production
models, limited editions, and significant one-offs, each with full specs and
researched Story / Engineering / Records write-ups). This document defines the next
version: a multi-brand app with a home page, per-brand themed pages, and an
architecture that scales to thousands of cars.

**Not commercial.** Personal project, shared with friends via a public link.
No accounts, no payments, no analytics needed.

## Core experience

1. **Home page** — the front door. Shows favorited cars (cover-image cards),
   a brand index to click into, and ambient extras: a rotating "car of the day,"
   newest additions, and a stat strip (e.g. "50 cars · 1 brand · 23 one-offs").
   Favorites are stored client-side (localStorage) — no backend.

2. **Brand pages** (`/pagani`, `/koenigsegg`, …) — each brand is its own themed
   world. The Pagani page defines the pattern: a filterable, sortable card gallery
   (filter by family/road-legal, sort by year/hp/name, search), where each card
   opens a full one-pager.

3. **Car one-pagers** — the heart of the app. Layout per car:
   - Hero image with photo credit overlay
   - "Build Plaque" spec block (hp, torque, weight, 0–60, top speed, engine,
     powertrain, drivetrain, downforce, price, production, road legality, status)
   - Prose sections: The Story · Engineering · Records & Claims to Fame
   - Photo gallery with per-photo credit captions

## Brand theming

Each brand gets a theme object (see `brands.json`) controlling accent colors,
per-family accent hues, fonts, and a signature texture/motif. The component
structure is shared; only the theme changes. Established direction:

- **Pagani** (built): dark carbon weave, warm ivory, gold/steel-blue/sage family
  accents, Marcellus display serif, quad-exhaust motif, "engraved build plaque"
  spec styling. The existing app is the reference implementation.
- **Koenigsegg** (planned): icy Scandinavian minimalism, ghost-squadron heritage,
  cold whites and steel blues, geometric sans display.
- **Ferrari** (planned): rosso corsa on near-black, racing serif, giallo accents.

Theming should be CSS-variable driven so a new brand is a JSON entry + optional
font import, not a redesign.

## Data architecture (the part that makes "thousands of cars" work)

Everything is files in the repo — no database, no storage quotas, no backup/restore:

```
car-database/
├── src/                     # React app (Vite recommended)
├── data/
│   ├── brands.json          # brand list + themes (exists — see handoff files)
│   ├── pagani.json          # 50 cars, full content (exists — see handoff files)
│   └── <brand>.json         # one file per brand, same schema
└── images/
    └── <brand>/<car-slug>/  # web-res JPGs (~1600px, q85), numbered 1.jpg, 2.jpg…
        └── credits.json     # {"1.jpg": "Photo: Name, CC BY-SA 4.0, Wikimedia Commons"}
```

- Car IDs are `<brand>/<slug>` (already present in pagani.json).
- Text for thousands of cars is a few MB — trivial. Photos at web resolution run
  roughly 1–3 MB per car; thousands of cars fit in single-digit GB.
- Brand JSON files are lazy-loaded per route so the app stays fast at scale.
- Favorites = array of car IDs in localStorage.

## Photo licensing rules (already established, keep them)

- Publish-safe sources only: Wikimedia Commons, CC-filtered Flickr/Openverse,
  own photos, or direct photographer permission (keep written proof).
- Every photo carries a credit string: "Photo: <name>, <license>, <source>".
  CC0 needs no credit but gets one as courtesy. Avoid ND; NC is acceptable
  (non-commercial project) but prefer BY/BY-SA to keep options open.
- Credits display under gallery photos and overlaid on the hero image.

## Migration from the current app

1. `pagani.json` and `brands.json` in this handoff are the source of truth for data.
2. Photos: the current app exports `pagani-photos-backup.json` (base64 images +
   credits keyed by car slug). Write a small script to decode these into
   `images/pagani/<slug>/N.jpg` + `credits.json`. Re-source photos at higher
   resolution over time; the backup images are 1280–1800px.
3. The current single-file app ("Pagani Collection.html") is the visual reference
   for the Pagani theme — port its look, don't reinvent it.

## Hosting & sharing

- Static hosting on GitHub Pages or Cloudflare Pages (free, no server).
- Repo on GitHub; adding a car = add JSON entry + image folder, push, site updates.
- Friends get the URL. Optionally a custom domain later.

## Tech notes

- React + Vite, plain CSS with CSS variables for theming (the current app's CSS
  is variable-driven already — reuse it). React Router for /brand routes.
- No backend, no auth, no build-time CMS. Keep it boring and static.
- Image handling: lazy-load galleries, use loading="lazy", consider
  width-capped thumbnails for card covers (the current app uses ~220px covers).

## Someday / maybe

- Cross-brand pages: "Record holders," "Track-only weapons," "One-offs," a
  spec-comparison view between any two cars.
- "Spotted" flag per car for ones seen in person.
- Remaining Pagani deep cuts to add: Zonda Danubi, Venti, King, Kiryu, ZoZo,
  AG Roadster, 760 Diamante Verde, 760 Unica Roadster (headlining Villa d'Este
  auction May 2026 — check result), Huayra NC, plus future Utopia variants.
