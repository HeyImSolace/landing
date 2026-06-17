# Masonry Collage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS-grid PhotoCollage with a GSAP-animated masonry layout (React Bits Masonry component) that preserves the existing lightbox overlay behavior.

**Architecture:** `PhotoCollage.astro` becomes a thin data shell that uses `import.meta.glob` to map local photos to a JSON prop, which it passes to `MasonryCollage.jsx` (`client:only="react"`). `MasonryCollage.jsx` owns the lightbox state and delegates clicks from the Masonry grid. `Masonry.jsx` + `Masonry.css` are copied verbatim from React Bits.

**Tech Stack:** Astro 6, React 19, GSAP 3 (all already installed), no new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/Masonry.jsx` | Create | React Bits component — verbatim copy, no edits |
| `src/components/Masonry.css` | Create | React Bits styles — verbatim copy, no edits |
| `src/components/MasonryCollage.jsx` | Create | Data shaping, Masonry render, lightbox state |
| `src/components/PhotoCollage.astro` | Replace | Glob images → JSON prop → render MasonryCollage |

`src/pages/index.astro` — **no changes needed**, it already imports `<PhotoCollage />`.

---

## Task 1: Create Masonry.css

**Files:**
- Create: `src/components/Masonry.css`

- [ ] **Step 1: Create the file with the verbatim React Bits CSS**

Write `src/components/Masonry.css` with exactly this content:

```css
.list {
  position: relative;
  width: 100%;
  height: 100%;
}

.item-wrapper {
  position: absolute;
  will-change: transform, width, height, opacity;
  padding: 6px;
  cursor: pointer;
  top: 0;
  left: 0;
}

.item-wrapper > .item-img {
  position: relative;
  background-size: cover;
  background-position: center center;
  width: 100%;
  height: 100%;
  text-transform: uppercase;
  font-size: 10px;
  line-height: 10px;
  border-radius: 10px;
  box-shadow: 0px 10px 50px -10px rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Masonry.css
git commit -m "feat: add React Bits Masonry CSS"
```

---

## Task 2: Create Masonry.jsx

**Files:**
- Create: `src/components/Masonry.jsx`

- [ ] **Step 1: Create the file with the verbatim React Bits component**

Write `src/components/Masonry.jsx` with exactly this content:

```jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

import './Masonry.css';

const useMedia = (queries, values, defaultValue) => {
  const get = () => values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;

  const [value, setValue] = useState(get);

  useEffect(() => {
    const handler = () => setValue(get);
    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries]);

  return value;
};

const useMeasure = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
};

const preloadImages = async urls => {
  await Promise.all(
    urls.map(
      src =>
        new Promise(resolve => {
          const img = new Image();
          img.src = src;
          img.onload = img.onerror = () => resolve();
        })
    )
  );
};

const Masonry = ({
  items,
  ease = 'power3.out',
  duration = 0.6,
  stagger = 0.05,
  animateFrom = 'bottom',
  scaleOnHover = true,
  hoverScale = 0.95,
  blurToFocus = true,
  colorShiftOnHover = false
}) => {
  const columns = useMedia(
    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],
    [5, 4, 3, 2],
    1
  );

  const [containerRef, { width }] = useMeasure();
  const [imagesReady, setImagesReady] = useState(false);

  const getInitialPosition = item => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return { x: item.x, y: item.y };

    let direction = animateFrom;

    if (animateFrom === 'random') {
      const directions = ['top', 'bottom', 'left', 'right'];
      direction = directions[Math.floor(Math.random() * directions.length)];
    }

    switch (direction) {
      case 'top':
        return { x: item.x, y: -200 };
      case 'bottom':
        return { x: item.x, y: window.innerHeight + 200 };
      case 'left':
        return { x: -200, y: item.y };
      case 'right':
        return { x: window.innerWidth + 200, y: item.y };
      case 'center':
        return {
          x: containerRect.width / 2 - item.w / 2,
          y: containerRect.height / 2 - item.h / 2
        };
      default:
        return { x: item.x, y: item.y + 100 };
    }
  };

  useEffect(() => {
    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));
  }, [items]);

  const grid = useMemo(() => {
    if (!width) return [];

    const colHeights = new Array(columns).fill(0);
    const columnWidth = width / columns;

    return items.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = columnWidth * col;
      const height = child.height / 2;
      const y = colHeights[col];

      colHeights[col] += height;

      return { ...child, x, y, w: columnWidth, h: height };
    });
  }, [columns, items, width]);

  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    if (!imagesReady) return;

    grid.forEach((item, index) => {
      const selector = `[data-key="${item.id}"]`;
      const animationProps = {
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h
      };

      if (!hasMounted.current) {
        const initialPos = getInitialPosition(item, index);
        const initialState = {
          opacity: 0,
          x: initialPos.x,
          y: initialPos.y,
          width: item.w,
          height: item.h,
          ...(blurToFocus && { filter: 'blur(10px)' })
        };

        gsap.fromTo(selector, initialState, {
          opacity: 1,
          ...animationProps,
          ...(blurToFocus && { filter: 'blur(0px)' }),
          duration: 0.8,
          ease: 'power3.out',
          delay: index * stagger
        });
      } else {
        gsap.to(selector, {
          ...animationProps,
          duration: duration,
          ease: ease,
          overwrite: 'auto'
        });
      }
    });

    hasMounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);

  const handleMouseEnter = (e, item) => {
    const element = e.currentTarget;
    const selector = `[data-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: hoverScale,
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector('.color-overlay');
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0.3,
          duration: 0.3
        });
      }
    }
  };

  const handleMouseLeave = (e, item) => {
    const element = e.currentTarget;
    const selector = `[data-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector('.color-overlay');
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.3
        });
      }
    }
  };

  return (
    <div ref={containerRef} className="list">
      {grid.map(item => {
        return (
          <div
            key={item.id}
            data-key={item.id}
            className="item-wrapper"
            onClick={() => window.open(item.url, '_blank', 'noopener')}
            onMouseEnter={e => handleMouseEnter(e, item)}
            onMouseLeave={e => handleMouseLeave(e, item)}
          >
            <div className="item-img" style={{ backgroundImage: `url(${item.img})` }}>
              {colorShiftOnHover && (
                <div
                  className="color-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(45deg, rgba(255,0,150,0.5), rgba(0,150,255,0.5))',
                    opacity: 0,
                    pointerEvents: 'none',
                    borderRadius: '8px'
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Masonry;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Masonry.jsx
git commit -m "feat: add React Bits Masonry component"
```

---

## Task 3: Create MasonryCollage.jsx

**Files:**
- Create: `src/components/MasonryCollage.jsx`

This component receives `photos` from Astro, shapes items for `<Masonry>`, intercepts item clicks to open the lightbox, and renders the lightbox overlay as React state.

The click interception strategy: wrap `<Masonry>` in a `div` with `onClick`. Because Masonry's internal handler calls `window.open(item.url, '_blank')` and `item.url` is `"#"`, we prevent that default with `e.preventDefault()` in the wrapper. We identify the clicked item by walking up to the nearest `[data-key]` ancestor.

- [ ] **Step 1: Create MasonryCollage.jsx**

Write `src/components/MasonryCollage.jsx` with exactly this content:

```jsx
import { useState, useEffect, useCallback } from 'react';
import Masonry from './Masonry';

const lbStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
    background: 'rgba(10, 8, 6, 0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  close: {
    position: 'fixed',
    top: '1.5rem',
    right: '1.5rem',
    background: 'none',
    border: '1px solid rgba(240,230,206,0.2)',
    color: '#f0e6ce',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.85rem',
    width: '2.4rem',
    height: '2.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBase: {
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: '1px solid rgba(240,230,206,0.15)',
    color: '#f0e6ce',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '1.2rem',
    width: '3rem',
    height: '3rem',
    cursor: 'pointer',
  },
  counter: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.65rem',
    letterSpacing: '0.15em',
    color: 'rgba(240,230,206,0.4)',
  },
};

export default function MasonryCollage({ photos }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const items = photos.map(p => ({
    id: p.id,
    img: p.img,
    url: '#',
    height: p.height,
  }));

  const open = useCallback(index => {
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  }, []);

  const close = useCallback(() => {
    setLightboxIndex(null);
    document.body.style.overflow = '';
  }, []);

  const prev = useCallback(() => {
    setLightboxIndex(i => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const next = useCallback(() => {
    setLightboxIndex(i => (i + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxIndex, close, prev, next]);

  const handleGridClick = e => {
    e.preventDefault();
    const wrapper = e.target.closest('[data-key]');
    if (!wrapper) return;
    const key = wrapper.dataset.key;
    const index = items.findIndex(item => item.id === key);
    if (index !== -1) open(index);
  };

  const isOpen = lightboxIndex !== null;

  return (
    <>
      <div
        onClick={handleGridClick}
        style={{ width: '100%', minHeight: '100vh' }}
      >
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
      </div>

      {isOpen && (
        <div
          style={lbStyles.overlay}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
          role="dialog"
          aria-modal="true"
        >
          <button style={lbStyles.close} onClick={close} aria-label="Schließen">✕</button>
          <button
            style={{ ...lbStyles.navBase, left: '1.5rem' }}
            onClick={prev}
            aria-label="Zurück"
          >←</button>
          <button
            style={{ ...lbStyles.navBase, right: '1.5rem' }}
            onClick={next}
            aria-label="Weiter"
          >→</button>
          <img
            style={lbStyles.img}
            src={items[lightboxIndex].img}
            alt={`Foto ${lightboxIndex + 1}`}
          />
          <p style={lbStyles.counter}>{lightboxIndex + 1} / {items.length}</p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MasonryCollage.jsx
git commit -m "feat: add MasonryCollage wrapper with lightbox"
```

---

## Task 4: Replace PhotoCollage.astro

**Files:**
- Modify: `src/components/PhotoCollage.astro`

Replace the entire file. The new version: globs photos, maps them to a plain JSON-serializable array using `m.default.src` (the hashed URL string) and `m.default.width`/`m.default.height` from `ImageMetadata`, then renders `<MasonryCollage>`.

**Important:** `import.meta.glob` with `{ eager: true }` gives `{ default: ImageMetadata }` per module. The `src` on `ImageMetadata` is the processed URL string (e.g. `/_astro/IMG_0080.abc123.jpg`) — safe to pass as a prop and use as an `img` `src`.

The `id` for each item is derived from the filename: strip the path prefix to get e.g. `IMG_0080.jpg`.

- [ ] **Step 1: Overwrite PhotoCollage.astro**

Replace `src/components/PhotoCollage.astro` with exactly this content:

```astro
---
import MasonryCollage from './MasonryCollage.jsx';

const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true }
);

const photos = Object.entries(imageModules).map(([path, m]) => ({
  id: path.split('/').pop() ?? path,
  img: m.default.src,
  width: m.default.width,
  height: m.default.height,
}));
---

<MasonryCollage client:only="react" photos={photos} />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PhotoCollage.astro
git commit -m "feat: replace PhotoCollage with Masonry-based implementation"
```

---

## Task 5: Verify in the browser

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Expected output includes: `Local: http://localhost:4321/`

- [ ] **Step 2: Open the page and scroll to the photo section**

Navigate to `http://localhost:4321/`. Scroll past the links section to the photo grid.

Expected: masonry grid appears, photos animate in from bottom with blur-to-focus effect.

- [ ] **Step 3: Click a photo**

Expected: dark overlay opens with the full photo, `✕` button top-right, `←`/`→` nav buttons, counter at bottom.

- [ ] **Step 4: Test keyboard navigation**

Press `ArrowRight` and `ArrowLeft` to navigate, `Escape` to close.

Expected: navigation works, overlay closes on Escape.

- [ ] **Step 5: Test backdrop click**

Click the dark area outside the photo.

Expected: overlay closes.

- [ ] **Step 6: Check responsive layout**

Resize the browser window to mobile width (~375px).

Expected: masonry reflows to fewer columns (2 columns at ~400px, 1 below that).

- [ ] **Step 7: Commit verification note (no code change needed)**

If all checks pass, no commit needed. If you had to fix anything during verification, commit those fixes with `git commit -m "fix: masonry collage verification fixes"`.
