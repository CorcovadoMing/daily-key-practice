# 038 local candidate
Base /tmp/dkp-037-rail; expected published parent c3dd3f2f6bf8e397e46a50ce86339c225d2a5f18. No publish.

Only positive cumulative counts render. Empty state explains when counts appear. Cards/stat tiles use same SVG, golden active note icon, browser-local per-key storage; edits refresh both visible surfaces immediately. Existing count semantics unchanged.

Migration is lazy per key on first display/open: personal, cumulative, lexically sorted room-scoped legacy strings; exact duplicate strings once, conflicting distinct strings preserved with source labels. Legacy keys retained untouched. Per-key marker prevents repeat migration and resurrection after clear. Old scope has no student/account identity, only browser+room; therefore no inference of named ownership, no upload. Existing shared-browser warning remains. This unifies local browser notes, not notes across devices.

236 unit tests pass, UI polish/wide/stats DOM suites pass. Migration conflict/dedup/read-repeat/clear+reload exercised in VM tests; DOM verified shared-room switch, two surfaces highlight/clear, no Firebase module. Chromium mobile 320 viewport stats 241px no panel overflow; clicked real local completion to get C-major 1 count only; note dialog fit at320, 390 empty state visible. Migration reload tested deterministically, not browser storage injection. Final caption wording change after browser check only.
