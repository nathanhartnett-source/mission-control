# overrides/ — Tier 3 userspace

Per-install overrides. **Gitignored.** Clean-repo updates never touch this directory.

## css/

Drop CSS files in `overrides/css/` to override theme variables or component styles per-install. They are loaded after `app/globals.css` by `app/layout.tsx`. Example: `overrides/css/brand.css` sets `--bento-accent` to your brand colour.

## Other override surfaces

To be added: `overrides/logo.svg`, `overrides/favicon.ico`, etc. Referenced by `config/site.json`.
