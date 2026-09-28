# Lab Practical Trainer

Study app for the Human Anatomy & Physiology I lab practical (Labs 1–5): sticker-style
identification on masked illustrations and micrographs, multiple choice with same-group
distractors, matching, flashcards, short-answer stations, word forms, and a timed practical
simulation with a report by region. Static site, phone-first, installable as a web app.

## Run

```
npm install
npm run dev        # local dev server
npm run build      # validates content, builds dist/
npm test           # answer-matcher tests
```

Deploys to GitHub Pages from `main` via `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).

## Content

- `content/lab*.json` — terms grouped as the 2026 handouts group them, plus question banks.
  A term is `"name | alias | alias"` or an object with `facts` (definition, location, transmits, plural, note).
- `content/images/*.json` — one record per image: hotspots (normalised 0–1) and masks. Author mode in the app exports exactly this shape.
- `scripts/build-content.mjs` merges everything into `public/content.json` and fails on dangling references.

## Images

`raw/` (git-ignored) holds pages extracted from the source PDFs with poppler. `scripts/images.manifest.json` lists every image:
crop, rotation, groups, hotspots, masks. `npm run prep-images` writes `public/img/*.webp` and creates `content/images/*.json` stubs.

Manifest builders:
- `scripts/hist-manifest.mjs` — histology photo crops (detected by `detect-photos.mjs`, corrected by hand).
- `scripts/skeleton-manifest.mjs` — 2024 skeleton pages: `skeleton-detect.mjs` finds the red-ink answer boxes and pairs them with OCR words; `skeleton-overrides.json` fixes, adds and drops boxes per page and sets crops and extra masks.
- `scripts/extra-manifest.mjs` — Lab 3 skin figures and the muscle worksheet.

`scripts/preview-masks.mjs <out.jpg> <id-prefix>` renders images with masks and sticker numbers baked in, for checking that no answer leaks.

## Progress

Stored in `localStorage` (Leitner boxes per term) with student photos in IndexedDB. Settings → Export writes a single JSON backup including photos.

`node scripts/leak-scan.mjs` lists OCR words on the skeleton pages that match a term name and sit outside a mask. Words that land on the illustration itself are ghost text from the reverse side of the scan and can be ignored; words on a printed label are real leaks.
