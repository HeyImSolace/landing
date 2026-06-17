# Nextcloud Dynamic Photos — Design Spec
**Date:** 2026-06-17

## Overview

Replace the static `import.meta.glob` photo loading in `PhotoCollage.astro` with a runtime fetch from a Nextcloud instance. Photos are listed via WebDAV PROPFIND and proxied through Astro API endpoints so Nextcloud credentials never reach the browser.

---

## Architecture

```
Browser
  └── GET /                          → index.astro renders PhotoCollage.astro
  └── MasonryCollage mounts (React)
      └── fetch /api/photos          → Astro server endpoint
              └── PROPFIND NC WebDAV → parse XML → return JSON
  └── <Masonry items> renders
      └── each item.img = /api/photos/[filename]
              └── GET /api/photos/IMG_001.jpg  → proxy endpoint
                      └── GET NC WebDAV file  → stream bytes to browser
```

Credentials (`NC_BASE_URL`, `NC_USER`, `NC_APP_PASSWORD`, `NC_PHOTOS_PATH`) live only in the server environment. The browser sees only `/api/photos` and `/api/photos/[filename]` — its own origin.

---

## Prerequisites

Astro currently runs in static mode (`output: 'static'` default). Server-side API endpoints require `output: 'server'` plus an adapter. The `@astrojs/node` adapter is the minimal addition for self-hosted or Node.js environments.

---

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `astro.config.mjs` | Modify | Add `output: 'server'` and `@astrojs/node` adapter (middleware mode) |
| `.env` | Create | Nextcloud credentials and folder path |
| `.env.example` | Create | Documented template (committed to git) |
| `src/lib/nextcloud.ts` | Create | Shared WebDAV helpers: `listPhotos()`, `fetchPhoto()` |
| `src/pages/api/photos.ts` | Create | GET → returns `{ id, img, height }[]` JSON |
| `src/pages/api/photos/[filename].ts` | Create | GET → proxies image bytes from Nextcloud |
| `src/components/MasonryCollage.jsx` | Modify | Fetch `/api/photos` on mount; loading + error states |
| `src/components/PhotoCollage.astro` | Modify | Remove `import.meta.glob` and props; render `<MasonryCollage client:only="react" />` |

---

## Environment Variables

```
NC_BASE_URL=https://cloud.example.com       # Nextcloud base URL, no trailing slash
NC_USER=myuser                               # Nextcloud username
NC_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx         # App password (not account password)
NC_PHOTOS_PATH=Photos/landing               # Path inside the user's files, no leading/trailing slash
```

`.env` is gitignored. `.env.example` is committed with placeholder values.

---

## `src/lib/nextcloud.ts`

Two exported functions, no side effects:

**`listPhotos(): Promise<string[]>`**
- Sends `PROPFIND` to `{NC_BASE_URL}/remote.php/dav/files/{NC_USER}/{NC_PHOTOS_PATH}/` with `Depth: 1`
- Auth: `Authorization: Basic base64(NC_USER:NC_APP_PASSWORD)`
- Parses the WebDAV XML response (`multistatus > response > href`)
- Filters to entries whose href ends in `.jpg`, `.jpeg`, `.png`, or `.webp` (case-insensitive)
- Returns bare filenames only (e.g. `["IMG_0035.jpg", "IMG_0080.jpg"]`) — strips the WebDAV path prefix
- Throws with a descriptive message on non-2xx WebDAV response

**`fetchPhoto(filename: string): Promise<Response>`**
- Fetches `{NC_BASE_URL}/remote.php/dav/files/{NC_USER}/{NC_PHOTOS_PATH}/{filename}` with Basic auth
- Returns the raw `fetch` Response (caller streams it)
- Throws if response is not ok

---

## `src/pages/api/photos.ts`

```
GET /api/photos
→ 200 { photos: [{ id, img, height }] }
→ 500 { error: string }
```

- Calls `listPhotos()` from `src/lib/nextcloud.ts`
- Maps each result to `{ id, img: /api/photos/${id}, height: 600 }`
- Height is fixed at `600` — no image metadata available at runtime; produces uniform tile proportions
- Returns JSON with `Content-Type: application/json`
- On any thrown error: returns `500` with `{ error: message }`

---

## `src/pages/api/photos/[filename].ts`

```
GET /api/photos/[filename]
→ 200  (image bytes, Content-Type from Nextcloud)
→ 404  if filename contains path traversal (../)
→ 502  if Nextcloud fetch fails
```

- Validates `filename` contains no `/` or `..` (prevents path traversal)
- Calls `fetchPhoto(filename)` from `src/lib/nextcloud.ts`
- Pipes the response body directly to the Astro response (`return new Response(ncResponse.body, { headers })`)
- Forwards `Content-Type` and `Content-Length` from Nextcloud response
- On error: `502` with `{ error: "upstream fetch failed" }`

---

## `src/components/MasonryCollage.jsx` Changes

Current signature: `MasonryCollage({ photos })` — receives static array from Astro.

New signature: `MasonryCollage()` — no props. Manages its own data fetching.

Added state:
- `const [photos, setPhotos] = useState(null)` — `null` = loading, `[]` = empty/error
- `const [error, setError] = useState(null)`

Added effect on mount:
```js
useEffect(() => {
  fetch('/api/photos')
    .then(r => r.json())
    .then(data => setPhotos(data.photos))
    .catch(() => setError('Fotos konnten nicht geladen werden.'));
}, []);
```

Render states:
- `photos === null` → render nothing (or a minimal loading indicator)
- `error` → render `<p style={{ color: 'var(--muted)' }}>{error}</p>`
- `photos.length === 0` → render nothing
- otherwise → existing `<Masonry>` render (unchanged)

---

## `src/components/PhotoCollage.astro` Changes

Entire frontmatter reduced to just the import. No `import.meta.glob`, no `photos` array, no props passed.

```astro
---
import MasonryCollage from './MasonryCollage.jsx';
---
<MasonryCollage client:only="react" />
```

---

## `astro.config.mjs` Changes

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
});
```

`mode: 'standalone'` produces a self-contained `dist/server/entry.mjs` that can be run directly with `node dist/server/entry.mjs`.

---

## Security

- `NC_APP_PASSWORD` is never serialized into HTML or sent to the browser
- The `[filename]` proxy validates no path traversal before forwarding to Nextcloud
- Nextcloud credentials are read from `process.env` at request time (server-side only)

---

## What Is Removed

- `import.meta.glob` in `PhotoCollage.astro` — no longer needed
- Local `src/assets/photos/` files — still present but no longer used by the collage (can be deleted manually)
- The `photos` prop on `MasonryCollage` — component is now self-contained

---

## Constraints

- Requires `@astrojs/node` as a new dependency
- Requires `output: 'server'` — the site can no longer be deployed as a fully static export; needs a Node.js host (or equivalent adapter swap for other platforms)
- Nextcloud must be reachable from the server at request time
