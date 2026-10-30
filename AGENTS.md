# Working on Harbor Research

- Edit `src/`; `dist/` is generated with `npm run build` and is not committed.
- Keep asset/fetch URLs relative and navigation in URL hashes so project GitHub Pages works.
- Maintain evidence types: static code, packaged configuration, localization text, analyst inference. Never present shipped defaults as observed current server values.
- Preserve source paths, line anchors, hashes and unknowns when updating a finding. Use REA Evidence IDs only for actual REA records.
- Publish only curated research snippets and original simulator code. Never add the game APK/XAPK, full recovered Lua source, decoded bundles, credentials or player data.
- Run `npm test`, `npm run build`, `npm run check` before committing source changes. Browser QA should cover the changed interaction.
- GitHub Pages publishes `main` through its workflow. Cloudflare uses the same repository and `dist/`. Avoid enabling the optional token-based Cloudflare workflow if Git integration is already active.
- `engine.mjs` is independent from DOM/network. Simulator board/ordering parameters are explicitly design assumptions; keep them distinct from verified energy/offer rules.

## Current-work checklist markers

- Keep exactly one `checklist-current-work` block in `docs/MASTER-CHECKLIST.md`; the generated JSON and UI derive from it. Never append a second batch or tag all previously completed tasks.
- At the start of the next implementation or analysis task, replace that block with the new batch (`id`, `date`, `title`, `items: []`) using `npm run checklist:work -- <batch.json>`. This removes every prior `이번 작업` badge and change note together. Read-only status questions, continued work in the same batch, validation and deployment do not start a new batch.
- As that batch is completed, replace its `items` with the actual changed task IDs and a concrete summary of what changed in each row. Use the same command; do not accumulate old batch entries. Existing task titles, acceptance criteria and status remain the durable record, with history in Git.
- Show the badge beside the row's existing status, including `부분` where appropriate. A current-work badge does not promote a task to `완료`. Keep the fixed100 task IDs and their completion criteria.
