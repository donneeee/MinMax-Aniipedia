# MinMax's Map

Interactive static map for Aniimo world markers.

Version: `v0.3.23`

## What Is Included

- Separate map scenes for Idyll, Whisperwake Isles, Astra, and The Lost Islets.
- Filterable marker layers for items, Aniimo, eggs, teleports, ambers, and misc markers.
- A small startup manifest at `data/map_site_data.json`, with marker data loaded per map from `data/maps/`.
- WebP map previews for first paint and GPU-safe detail tiles for zoomed-in views.
- Static assets under `assets/`, so the site can be hosted without a build step.
- Discord-synced respawn tracking for verified overworld collectible nodes.

## Run Locally

From this folder:

```powershell
python -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

## Deploy To GitHub Pages

This folder is ready to be used as its own GitHub repository.

1. Push the repository to GitHub.
2. In the GitHub repository settings, enable Pages with `GitHub Actions` as the source.
3. Pushes to `main` will publish through `.github/workflows/deploy-pages.yml`.

## Discord Sync Setup

The map and filters work without a backend. Tracking is disabled until Discord
sync is configured through Supabase. Follow the click-by-click
[Discord sync setup guide](./DISCORD_SYNC_SETUP.md) when you are ready.

`app-config.local.js` and `.env` files are ignored so local credentials and
development settings cannot be committed accidentally.

## Coordinate Convention

- Website `x` = scene position axis `1`.
- Website `y` = scene position axis `3`.
- Scene position axis `2` is exported as `height_y`.
