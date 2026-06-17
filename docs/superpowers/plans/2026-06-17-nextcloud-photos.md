# Nextcloud Dynamic Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `import.meta.glob` photo loading with a runtime Nextcloud WebDAV fetch, proxied through Astro server-side API endpoints so credentials never reach the browser.

**Architecture:** `MasonryCollage.jsx` fetches `/api/photos` on mount to get a JSON list of filenames. Each image `src` points to `/api/photos/[filename]`, an Astro proxy endpoint that authenticates to Nextcloud WebDAV and streams image bytes back. A shared `src/lib/nextcloud.ts` module owns all WebDAV communication. Astro switches from static to server mode via `@astrojs/node`.

**Tech Stack:** Astro 6 (server mode), `@astrojs/node` adapter, Nextcloud WebDAV API, React 19, GSAP 3.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `astro.config.mjs` | Modify | Add `output: 'server'` + `@astrojs/node` adapter |
| `.env` | Create | Local credentials (gitignored) |
| `.env.example` | Create | Committed template with placeholder values |
| `src/lib/nextcloud.ts` | Create | `listPhotos()` and `fetchPhoto()` WebDAV helpers |
| `src/pages/api/photos.ts` | Create | GET `/api/photos` → JSON array |
| `src/pages/api/photos/[filename].ts` | Create | GET `/api/photos/[filename]` → proxied image bytes |
| `src/components/MasonryCollage.jsx` | Modify | Remove `photos` prop, add fetch + loading/error state |
| `src/components/PhotoCollage.astro` | Modify | Remove glob + props, render bare `<MasonryCollage />` |

---

## Task 1: Install `@astrojs/node` and switch to server mode

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Install the adapter**

```bash
pnpm add @astrojs/node
```

Expected: `@astrojs/node` appears in `package.json` dependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Update `astro.config.mjs`**

Replace the entire file with:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
});
```

- [ ] **Step 3: Verify dev server still starts**

```bash
pnpm dev
```

Expected: server starts at `http://localhost:4321/` with no errors. The page still loads (server mode is backwards-compatible for page rendering).

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs package.json pnpm-lock.yaml
git commit -m "feat: switch to server mode with @astrojs/node adapter"
```

---

## Task 2: Add environment variables

**Files:**
- Create: `.env`
- Create: `.env.example`

- [ ] **Step 1: Create `.env` with your real Nextcloud credentials**

Create `.env` in the project root:

```
NC_BASE_URL=https://your-nextcloud.example.com
NC_USER=your_username
NC_APP_PASSWORD=your-app-password-here
NC_PHOTOS_PATH=Photos/landing
```

Replace each value with your actual Nextcloud details. `NC_PHOTOS_PATH` is the path to the photo folder inside your Nextcloud user files — no leading or trailing slash.

To generate an app password in Nextcloud: Settings → Security → Devices & Sessions → "App name" field → click Generate.

- [ ] **Step 2: Create `.env.example`**

Create `.env.example` in the project root:

```
# Nextcloud WebDAV credentials
# NC_BASE_URL: your Nextcloud base URL, no trailing slash
NC_BASE_URL=https://cloud.example.com

# NC_USER: your Nextcloud username
NC_USER=myuser

# NC_APP_PASSWORD: generate at Nextcloud → Settings → Security → App passwords
NC_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# NC_PHOTOS_PATH: path to the photos folder inside your Nextcloud files
# No leading or trailing slash. Example: Photos/landing
NC_PHOTOS_PATH=Photos/landing
```

- [ ] **Step 3: Verify `.env` is gitignored**

```bash
git status
```

Expected: `.env` does NOT appear in the output. `.env.example` appears as an untracked file.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat: add .env.example for Nextcloud credentials"
```

---

## Task 3: Create `src/lib/nextcloud.ts`

**Files:**
- Create: `src/lib/nextcloud.ts`

This module reads credentials from `process.env` and exposes two functions. WebDAV PROPFIND returns XML; we parse it with a simple regex since no XML parser is available without adding a dependency.

- [ ] **Step 1: Create the directory and file**

Create `src/lib/nextcloud.ts` with exactly this content:

```ts
const base = () => {
  const url = process.env.NC_BASE_URL;
  const user = process.env.NC_USER;
  const pass = process.env.NC_APP_PASSWORD;
  const path = process.env.NC_PHOTOS_PATH;

  if (!url || !user || !pass || !path) {
    throw new Error('Missing Nextcloud env vars: NC_BASE_URL, NC_USER, NC_APP_PASSWORD, NC_PHOTOS_PATH');
  }

  return { url, user, pass, path };
};

const authHeader = (user: string, pass: string) =>
  'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

export async function listPhotos(): Promise<string[]> {
  const { url, user, pass, path } = base();
  const endpoint = `${url}/remote.php/dav/files/${encodeURIComponent(user)}/${path}/`;

  const res = await fetch(endpoint, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader(user, pass),
      Depth: '1',
    },
  });

  if (!res.ok) {
    throw new Error(`Nextcloud PROPFIND failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Extract all <d:href> values from the WebDAV response
  const hrefMatches = xml.matchAll(/<[^:>]*:href[^>]*>([^<]+)<\/[^:>]*:href>/gi);
  const filenames: string[] = [];

  for (const match of hrefMatches) {
    const href = decodeURIComponent(match[1].trim());
    const basename = href.split('/').pop() ?? '';
    if (/\.(jpe?g|png|webp)$/i.test(basename)) {
      filenames.push(basename);
    }
  }

  return filenames;
}

export async function fetchPhoto(filename: string): Promise<Response> {
  const { url, user, pass, path } = base();
  const endpoint = `${url}/remote.php/dav/files/${encodeURIComponent(user)}/${path}/${encodeURIComponent(filename)}`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: authHeader(user, pass),
    },
  });

  if (!res.ok) {
    throw new Error(`Nextcloud fetch failed: ${res.status} ${res.statusText}`);
  }

  return res;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm astro check
```

Expected: no errors in `src/lib/nextcloud.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nextcloud.ts
git commit -m "feat: add Nextcloud WebDAV helpers (listPhotos, fetchPhoto)"
```

---

## Task 4: Create `/api/photos` endpoint

**Files:**
- Create: `src/pages/api/photos.ts`

- [ ] **Step 1: Create the file**

Create `src/pages/api/photos.ts` with exactly this content:

```ts
import type { APIRoute } from 'astro';
import { listPhotos } from '../../lib/nextcloud';

export const GET: APIRoute = async () => {
  try {
    const filenames = await listPhotos();
    const photos = filenames.map(id => ({
      id,
      img: `/api/photos/${id}`,
      height: 600,
    }));
    return new Response(JSON.stringify({ photos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

- [ ] **Step 2: Start the dev server and test the endpoint**

```bash
pnpm dev
```

In a second terminal:

```bash
curl http://localhost:4321/api/photos
```

Expected (with valid `.env`):
```json
{"photos":[{"id":"IMG_0035.jpg","img":"/api/photos/IMG_0035.jpg","height":600}, ...]}
```

Expected (with missing/wrong `.env`):
```json
{"error":"Missing Nextcloud env vars: ..."}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/photos.ts
git commit -m "feat: add /api/photos endpoint (Nextcloud WebDAV listing)"
```

---

## Task 5: Create `/api/photos/[filename]` proxy endpoint

**Files:**
- Create: `src/pages/api/photos/[filename].ts`

- [ ] **Step 1: Create the directory and file**

Create `src/pages/api/photos/[filename].ts` with exactly this content:

```ts
import type { APIRoute } from 'astro';
import { fetchPhoto } from '../../../lib/nextcloud';

export const GET: APIRoute = async ({ params }) => {
  const filename = params.filename ?? '';

  // Prevent path traversal
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return new Response(JSON.stringify({ error: 'Invalid filename' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await fetchPhoto(filename);

    const headers = new Headers();
    const contentType = upstream.headers.get('Content-Type');
    const contentLength = upstream.headers.get('Content-Length');
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    // Cache images for 5 minutes in the browser
    headers.set('Cache-Control', 'public, max-age=300');

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'upstream fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

- [ ] **Step 2: Test the proxy endpoint**

With `pnpm dev` running, pick a filename from the `/api/photos` response and test:

```bash
curl -o /tmp/test.jpg http://localhost:4321/api/photos/IMG_0035.jpg
file /tmp/test.jpg
```

Expected: `JPEG image data` (or equivalent for the file type).

- [ ] **Step 3: Test path traversal rejection**

```bash
curl -v "http://localhost:4321/api/photos/..%2F..%2Fetc%2Fpasswd"
```

Expected: `404` response with `{"error":"Invalid filename"}`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/photos/[filename].ts
git commit -m "feat: add /api/photos/[filename] proxy endpoint with path traversal guard"
```

---

## Task 6: Update `MasonryCollage.jsx` to fetch from API

**Files:**
- Modify: `src/components/MasonryCollage.jsx`

Replace the component to remove the `photos` prop and add data fetching on mount.

- [ ] **Step 1: Replace `MasonryCollage.jsx`**

Write `src/components/MasonryCollage.jsx` with exactly this content:

```jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
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

export default function MasonryCollage() {
  const [photos, setPhotos] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    fetch('/api/photos')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setPhotos(data.photos);
      })
      .catch(() => setFetchError('Fotos konnten nicht geladen werden.'));
  }, []);

  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  const items = useMemo(() => (photos ?? []).map(p => ({
    id: p.id,
    img: p.img,
    url: '#',
    height: p.height,
  })), [photos]);

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
    const wrapper = e.target.closest('[data-key]');
    if (!wrapper) return;
    e.stopPropagation();
    const key = wrapper.dataset.key;
    const index = items.findIndex(item => item.id === key);
    if (index !== -1) open(index);
  };

  if (fetchError) {
    return (
      <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.78rem', color: 'var(--muted)', padding: '2rem 0' }}>
        {fetchError}
      </p>
    );
  }

  if (!photos || photos.length === 0) return null;

  const isOpen = lightboxIndex !== null;

  return (
    <>
      <div
        onClickCapture={handleGridClick}
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

- [ ] **Step 2: Verify the page loads and photos appear**

With `pnpm dev` running, open `http://localhost:4321/` in a browser and scroll to the photo section.

Expected: masonry grid loads and photos animate in from Nextcloud. If `.env` is not configured, the section is blank (no crash).

- [ ] **Step 3: Commit**

```bash
git add src/components/MasonryCollage.jsx
git commit -m "feat: MasonryCollage fetches photos from /api/photos at runtime"
```

---

## Task 7: Simplify `PhotoCollage.astro`

**Files:**
- Modify: `src/components/PhotoCollage.astro`

- [ ] **Step 1: Replace the file**

Write `src/components/PhotoCollage.astro` with exactly this content:

```astro
---
import MasonryCollage from './MasonryCollage.jsx';
---

<MasonryCollage client:only="react" />
```

- [ ] **Step 2: Verify page still loads**

```bash
pnpm dev
```

Open `http://localhost:4321/` — photos section should still appear.

- [ ] **Step 3: Commit**

```bash
git add src/components/PhotoCollage.astro
git commit -m "feat: simplify PhotoCollage.astro — remove static glob, no props"
```

---

## Task 8: Verify full flow end-to-end

**Files:** none

- [ ] **Step 1: Verify `/api/photos` returns the correct shape**

```bash
curl http://localhost:4321/api/photos | python -m json.tool
```

Expected: a JSON object with a `photos` array. Each item has `id` (filename), `img` (`/api/photos/<filename>`), `height` (`600`).

- [ ] **Step 2: Verify image proxy loads a real image**

Pick a filename from the response and run:

```bash
curl -s -o /tmp/nc_test.jpg http://localhost:4321/api/photos/$(curl -s http://localhost:4321/api/photos | python -c "import sys,json; print(json.load(sys.stdin)['photos'][0]['id'])")
file /tmp/nc_test.jpg
```

Expected: `JPEG image data` (or PNG/WebP depending on file).

- [ ] **Step 3: Verify path traversal is blocked**

```bash
curl -s "http://localhost:4321/api/photos/..%2F..%2Fetc%2Fpasswd" | python -m json.tool
```

Expected:
```json
{"error": "Invalid filename"}
```

HTTP status should be 404 (check with `curl -s -o /dev/null -w "%{http_code}" "..."`)

- [ ] **Step 4: Verify error state when Nextcloud is unreachable**

Temporarily set `NC_BASE_URL` to an invalid value in `.env`, restart `pnpm dev`, and reload the page.

Expected: the photo section is blank or shows the German error message "Fotos konnten nicht geladen werden." — no JS crash, no broken layout.

Restore the correct `NC_BASE_URL` value afterwards.

- [ ] **Step 5: Run a production build**

```bash
pnpm build
```

Expected: build completes with no errors. `dist/server/entry.mjs` is created.

- [ ] **Step 6: No commit needed** — verification only.
