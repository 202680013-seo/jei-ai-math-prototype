# JEI Math design review workspace

- This is the user's separate private UI prototype site. Keep its existing project ID and audience.
- `dist/index.html`, `workspace.*`, `preview*`, and `review-model.js` implement the review workspace.
- Edit the actual math UI only under `dist/working/`.
- `dist/versions/v*/` are immutable design snapshots, each with a SHA-256 `snapshot.json`. Never edit, overwrite, or delete them during normal design revisions.
- After a meaningful user-requested design revision, run `node scripts/save-design-version.mjs --title "짧은 시안 이름" --change "변경 내용"` (repeat `--change` as needed). It copies the current prototype into the next unused V-number, updates the menu, and records the change. It rejects unchanged duplicates.
- During unfinished changes, update working metadata (`matchesBaseline: false`, title, date, changes) in `dist/versions.json`. Once a snapshot is created, the script updates it to the new baseline.
- Review workspace changes alone do not create a new design V-number. Sites deployment version numbers are independent of design V-numbers.
- Preserve `SOURCE_BASELINE.json`. Its original `dist/*` hashes now correspond to `dist/versions/v1/*`.
- Run `node --test tests/*.test.cjs` before publishing. Existing math tests target `dist/working/`; review tests verify snapshot integrity and independent preview state.
- Run `node scripts/build-review-views.mjs` after source or preview adapter edits, before tests/packaging. It generates direct `dist/views/*.html` entrypoints and shared catalog assets; the save-design-version script also runs it. Do not reintroduce srcdoc, nested preview frames, or readiness overlays.
- The user explicitly requested in-preview history and save/restore controls. Inject them from `history-ui.*` through the review adapter; keep immutable learner sources free of review controls.
- User-requested revisions within V2 use `--family v2` when saving, producing labels V2.1, V2.2, etc. Internal IDs remain immutable sequential `vN` directories. Existing snapshots are never rewritten.
- Manual save records pin an immutable design ID plus learner state in this browser. Explain browser-local scope in the UI. Design source changes are recorded by publication, not by the manual save button.
- All UI is buildless; publish `dist/` via the Sites source workflow. Reuse this site.
- The user requested NanumSquareRound across all versions. `dist/shared/typography.css` and its locally hosted font files are injected last by `build-review-views.mjs` into every generated version view and the review workspace. Preserve this global font choice on future designs; do not rewrite immutable snapshots just to update shared display typography.
