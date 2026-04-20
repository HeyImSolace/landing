# solace

Personal landing page. Built with [Astro](https://astro.build).

## Stack

- **Astro** — static site generator
- **IBM Plex Mono** — typography
- **Lanyard API** — Discord presence (Spotify / game status)
- **CSS Scroll Snap** — section-based scrolling

## Structure

```
src/
├── assets/
│   └── photos/           ← not committed (see .gitignore)
├── components/
│   ├── PhotoCollage.astro
│   └── Button.astro
├── layouts/
│   └── BaseLayout.astro
└── pages/
    └── index.astro
```

## Commands

```sh
npm install
npm run dev        # localhost:4321
npm run build
npm run preview
```

## Photos

Drop images into `src/assets/photos/` — Astro optimizes them at build time.
The folder is gitignored so photos never end up in the repo.

Supported: `jpg`, `jpeg`, `png`, `webp`

## Discord Presence

Uses [Lanyard](https://github.com/Phineas/lanyard) to show current Spotify track or active game.

1. Join the [Lanyard Discord server](https://discord.gg/lanyard)
2. Set your Discord user ID in `src/pages/index.astro`:
   ```js
   const DISCORD_ID = "your_id_here";
   ```
