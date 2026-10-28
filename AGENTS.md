# Working on Harbor Research

- Edit `src/`; `dist/` is generated with `npm run build` and is not committed.
- Keep asset/fetch URLs relative and navigation in URL hashes so project GitHub Pages works.
- Maintain evidence types: static code, packaged configuration, localization text, analyst inference. Never present shipped defaults as observed current server values.
- Preserve source paths, line anchors, hashes and unknowns when updating a finding. Use REA Evidence IDs only for actual REA records.
- Publish only curated research snippets and original simulator code. Never add the game APK/XAPK, full recovered Lua source, decoded bundles, credentials or player data.
- Run `npm test`, `npm run build`, `npm run check` before committing source changes. Browser QA should cover the changed interaction.
- GitHub Pages publishes `main` through its workflow. Cloudflare uses the same repository and `dist/`. Avoid enabling the optional token-based Cloudflare workflow if Git integration is already active.
- `engine.mjs` is independent from DOM/network. Simulator board/ordering parameters are explicitly design assumptions; keep them distinct from verified energy/offer rules.
