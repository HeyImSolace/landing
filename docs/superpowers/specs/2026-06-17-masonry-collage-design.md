# Masonry Collage — Design Spec
**Date:** 2026-06-17

## Overview

Replace the existing CSS-grid `PhotoCollage.astro` with a GSAP-animated masonry layout using the React Bits `Masonry` component. The lightbox (overlay with prev/next nav) is preserved as React state inside a new `MasonryCollage.jsx` wrapper.

---

## Architecture

`PhotoCollage.astro` becomes a thin data shell. It uses `import.meta.glob` at build time to collect all images from `src/assets/photos/`, maps the `ImageMetadata` objects into a serializable JSON array, and passes that array as a prop to `<MasonryCollage client:only="react" photos={photos} />`.

All animation and interaction logic lives in React — consistent with how `TargetCursor.jsx` is already wired up in this project.

---

## Files

| File | Role | Action |
|------|------|--------|
| `src/components/Masonry.jsx` | React Bits masonry component | Create (copy verbatim) |
| `src/components/Masonry.css` | React Bits masonry styles | Create (copy verbatim) |
| `src/components/MasonryCollage.jsx` | Wrapper: data shaping, Masonry render, lightbox | Create |
| `src/components/PhotoCollage.astro` | Data shell: glob → JSON → pass to MasonryCollage | Replace |

---

## Data Flow

1. **Build time** (`PhotoCollage.astro`): `import.meta.glob` produces `ImageMetadata[]` with real `width` and `height` per image.
2. Mapped to: `{ id: string, img: string, width: number, height: number }[]` — serialized as a prop.
3. **Runtime** (`MasonryCollage.jsx`): receives `photos`, constructs `items` for `<Masonry>` using `height` from metadata. Sets `url: "#"` (lightbox handles navigation, not `window.open`).

---

## MasonryCollage.jsx — Responsibilities

- Receives `photos: { id, img, width, height }[]`
- Constructs `items` array: `{ id, img, url: "#", height }`
- Renders `<Masonry>` inside a wrapper `div` with a delegated `onClick` handler
- The delegated handler reads `e.target.closest('[data-key]')` to identify which item was clicked, then opens the lightbox at the corresponding index
- Passes `scaleOnHover={true}`, `hoverScale={0.95}`, `blurToFocus={true}`, `animateFrom="bottom"` to Masonry
- Owns lightbox state: `const [lightboxIndex, setLightboxIndex] = useState(null)` (`null` = closed)
- Lightbox renders as a React portal or inline fixed overlay

---

## Lightbox

- Fixed overlay, `z-index: 500`, dark background matching existing aesthetic (`rgba(10, 8, 6, 0.96)`)
- Shows full-resolution image (`<img>`) centered in viewport
- Controls: `✕` close (top-right), `←` prev (left), `→` next (right), counter (bottom-center)
- Keyboard: `Escape` closes, `ArrowLeft`/`ArrowRight` navigates
- Body scroll locked while open (`document.body.style.overflow = 'hidden'`)
- Clicking the backdrop (not the image) closes the overlay
- Styles inline in the component (small enough to not warrant a separate CSS file)

---

## Masonry Props Used

```jsx
<Masonry
  items={items}
  ease="power1.out"
  duration={0.4}
  stagger={0.13}
  animateFrom="bottom"
  scaleOnHover={true}
  hoverScale={0.95}
  blurToFocus={true}
  colorShiftOnHover={false}
/>
```

---

## What Is Removed

- The entire old `PhotoCollage.astro` scroll-in animation (IntersectionObserver + CSS class toggling)
- The old Astro HTML lightbox markup and its vanilla JS
- The `develop` keyframe animation and all the `--rot`/`--tx`/`--fly-x` CSS custom property tricks

GSAP (already in `package.json`) handles all animation going forward.

---

## Constraints

- `gsap` is already installed (`^3.15.0`) — no new dependencies needed
- React + `@astrojs/react` already configured
- `PhotoCollage.astro` is used in `index.astro` as `<PhotoCollage />` — import stays the same, no changes to `index.astro`
- Images remain Astro-optimized assets (served via `/src/assets/photos/` pipeline)
