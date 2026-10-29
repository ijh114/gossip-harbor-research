# Harbor Research reading system

This is a readability refinement of the existing notebook. Retain its forest green identity, restrained warm notices, research content and interactive laboratories. Readers compare game rules with source evidence; comprehension and repeat visits take priority over decorative presentation.

- Surface modes: chapter/wiki pages **Read**; catalog and simulators **Operate**.
- Light canvas `#f7f8f5`, white panels, ink `#202e2b`, secondary text `#526158`; primary action/current navigation `#18564c`. Warm tones identify inference or observation limits. Labels accompany semantic colors.
- Self-host Pretendard Variable 1.3.9 under SIL OFL, `font-display: swap`, Korean system fallbacks. One family for headings, body and controls; Consolas only for code, identifiers and measurements.
- Body 17px / 1.85 line height, optional 19px reader setting. Secondary UI 14–15px, metadata 12–13px, heading roles 19/22/24/34px. Use rem values for reader roles, preserve browser zoom. Long prose measure at most 68ch.
- Chapters: title and scope, question/answer summary, structure/values, then a single-column finding ledger. Summaries stay visible; detailed analysis uses native disclosures. Unknowns and source evidence retain separate labels.
- Fixed 264px primary navigation; max-width content with a 188px sticky outline on wide screens. Below 1280px the outline is an inline disclosure before the article. Below 761px navigation uses the existing modal drawer. Phone content gutters 16–20px; tables scroll inside labeled keyboard-focusable regions.
- Controls use 44px minimum heights; dense 7-column source-board cells use a 40px minimum on small phones to keep the verified 7×9 layout and a 24px target floor. Standard focus rings, native range/select/details controls, text selection and tabular numbers remain available.
- Global search groups chapters, findings and products. Results navigate to durable hash links; finding links expand the selected analysis. `/` and Ctrl/Cmd+K focus search; Escape dismisses it. Reader size persists locally; no analytics or account data is sent.
- Restrained state transitions only. Reduced motion preserves instantaneous state feedback without scrolling or spinner motion. Do not add decorative entrances, display faces, tiny all-caps labels or card grids for long findings.

Implementation: `src/reading.css` is the final reading layer over the existing shell/domain styles; `src/reader.mjs` owns search, outlines, disclosures and sharing. Data and simulation rules are unchanged.

Validation scope and remaining visual checks: [readability review](docs/READABILITY-REVIEW.md).

## Visual exploration surfaces

The user's requested structure adds a visual comparison layer while keeping detailed documents in a collapsible Research tree. Puzzle has separate type and motion catalogs, interaction and difficulty pages. UI has a screen catalog, anatomy and motion pages. Game Simulation owns the connected loading/title/tutorial/main/play/home prototype. Legacy research hashes remain stable.

These surfaces use the existing palette/type and **Operate** mode. The medium is a grid only where visual objects are genuinely compared: item variants, UI components and motion samples. Reading routes keep their linear document layout. Media have a fixed preview area and source labels. The interaction catalog uses user-requested autoplay GIF cards with a global pause control, reduced-motion defaults, and offscreen/hidden-page suspension; other galleries keep explicit playback. Web diagrams remain explicitly separate from original captured media. No original art or live runtime claim may be inferred from a catalog declaration.

The 7×9 connected playthrough uses an independent two-family merge model. Its basic sequence is usable before original captures arrive. Per-stage capture slots and `src/data/media.json` are the extension point; [MEDIA-GUIDE.md](docs/MEDIA-GUIDE.md) specifies keys and required provenance. Publish verified captures only. Modal viewers are for media enlargement/playback and stop on close.

## Configuration-based play mode

The existing experience route now switches between a source-backed bounded experiment and the original flow prototype. Use the same Operate palette and font. Source sprites have exact Type provenance; unsupported types show IDs. Keep current state, fixed orders, generator details, economy, map progression and commerce readable. The focus control temporarily hides research navigation and restores it on exit; on375px screens all63 cells fit without horizontal overflow. Modal energy/offer/shop uses native dialog focus. Source cells show a short web-only appearance transition and remove it for reduced motion. Save/import/export and explicitly labeled research aids remain distinct from game rewards.

## Capture-referenced game surface

The default experience mode now presents the source model inside a390–480px phone frame. HUD → customer/order tray → square7×9 grid → selected-item panel follows GH-S0363; newer high-level customer counts and right-side generator placement are not copied into the beginner board. Selected APK portraits replace full-body customer animation and are explicitly identified as substitutions. Local scenery, resource, shop and inventory Sprites are reused; the map entry is a labeled web control because its captured icon is not mapped. Box/web overlays, merge pops, title and home drawing are web reconstruction. Research aids, provenance and gaps sit outside the phone. Pointer drag has a separate ghost; tap/keyboard alternatives, native dialogs,44px normal controls and reduced-motion support remain. Existing saves migrate only from a reviewed revision after an intact backup.


## Connected game scenes

The game experience keeps one domain save and adds an optional, normalized `screenFlow` presentation field. Loading/title, two short original web guide pages, capture-referenced main map, actual source-rule board, protected quest scene, already-committed reward view and return are separate presentation states. Existing source experiments retain title/play/home. Scene transitions hide map HUD/board input; title/route changes suspend presentation timers. Actual captured before/after spaces are an explicitly independent visual demonstration, with no invented quest-to-furniture mapping or three-variant claim. Captured scenery uses legible opaque text surfaces; source and reconstruction labels remain visible. Opt-in bounded SFX, keyboard focus restoration and reduced-motion instant completion accompany the flow. Details and unresolved original timeline requirements are in `docs/SCREEN-FLOW.md`.

## Production planner and timeline ledger

`#production-assets` extends the Operate notebook with a scope selector, unit-separated selection summary and a single-column request ledger. Original measurements and proposed new-game specifications occupy adjacent labeled columns and stack on phones. The user chose MVP through launch with pass, album and a representative event; detailed quantities are editable planning proposals. Include checkboxes, quantity/spec/notes, dependency warnings, per-browser draft storage and Markdown/CSV/JSON exports support a concrete graphics handoff. Avoid aggregating icons, clips, scenes and music into one invented asset count. Existing source previews use the same media viewer.

`#media-audit` is a Read ledger of decode coverage, chronological sampled visual review, audio measurement and unperformed listening/real-time playback. Source ID, hash, timestamp ranges and unknowns stay visible in disclosures; private full videos/contact sheets remain local. Counts come from the current audit dataset, and publication does not imply original-game runtime parity.


## Source scene and research activity expansion

The first60 packaged task sequences now drive selected dialogue, story-image, camera metadata and mandatory choices. Keep omitted narrative explicit and original Unity coordinates separate from the web projection.75 selected mesh/UV previews are technical derivatives, not finished game rendering. Research activities have explicit scenario badges, a separate reward ledger and preserved invalid saves. Their original72-cell layout is a bounded research board; missing event art remains labeled. Scene analysis is a Read route; interactive activities and growth scrubber keep existing Operate tokens.
