# Agent handoff — 弓弦的每日音階練習

This repository is a cello scale-practice and teacher/student classroom app. **Source code is the authority for implemented behavior; tests and GitHub Actions are evidence for verified behavior; Capacities is the authority for human motivation, design tradeoffs, and decision history.**

Before changing code, read the [Capacities Project](https://app.capacities.io/b9b2fb48-bf3d-4253-b47f-87631c17482f/5440ca7e-93c5-4efd-bbc3-c2b79fc6d61a) and the latest [global agent guidelines](https://app.capacities.io/b9b2fb48-bf3d-4253-b47f-87631c17482f/68d4e140-5898-494d-8c45-1dcb67af2454). For this repository specifically, read [code architecture & maintainability](https://app.capacities.io/b9b2fb48-bf3d-4253-b47f-87631c17482f/2da9f412-296c-42b9-a305-3fa8006adec8) and [test/traceability strategy](https://app.capacities.io/b9b2fb48-bf3d-4253-b47f-87631c17482f/cdfa5ef6-6dd3-412e-9aa3-54ea3065f9d9). These are snapshots, so reconcile with current commits, Issues, PRs and CI.

## Immutable product intent
- 12 major + 12 **classical melodic minor** scales (6/7 raised on ascent, natural minor on descent). Preserve the user's confirmed Werner fingering digits; many string/hand-position placements are **inferred**, not individually confirmed.
- Unconfirmed fingerboard changes are editable, undoable and visible to classroom peers, but must **not** overwrite confirmed/shared fingering until Confirm.
- Personal practice history stays local; shared room state and ephemeral `roomEdits` drafts are separate. Resume modifies the original record; replay never changes history.
- Do not change the deployed Firebase database or rules without explicit authorization. Passing an Emulator test does not prove the production Rules or real-device flows.

## Where to look
- `index.html`: DOM, selection, localStorage/history, application integration — currently a large inline script; refactor gradually behind tests.
- `fingerboard.js`: scale generation, diagram/editor state and undo, exported pure helpers.
- `fingering-presets.js`: user-verified digits, inferred positions.
- `classroom.js` + `firebase-rules.json`: six-digit rooms, room transactions, ephemeral draft/presence, permission policy.
- `fingerboard-editor.js`: potential legacy/unloaded implementation; investigate before removing.
- `.github/workflows/`: syntax/experimental verification, dual-version publishing, proposed L1 quality gates.

## Development contract
1. Use a GitHub Issue describing the actual user problem, chosen approach, tradeoffs, tests, rollback and which code paths change; a future idea is not a committed Roadmap.
2. Prefer a focused PR against `experimental` and keep `main` stable. Do not merge/publish without review.
3. Before changing common data rules, run `node --test tests/*.test.cjs` (where available), then appropriate browser/Emulator tests. Add regression coverage for new behavior.
4. Record exactly what was tested, and distinguish code inspection, CI pass, Emulator pass and real-device pass. Do not claim unrun tests.
5. Link key decisions and failure learnings back to Capacities, rather than duplicating code/issue status in static pages.
