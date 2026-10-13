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
- Do not add version controls or technical implementation details inside the learner-facing prototype. Review controls belong in the outer workspace.
- All UI is buildless; publish `dist/` via the Sites source workflow. Reuse this site.
