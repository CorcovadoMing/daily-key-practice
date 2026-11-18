# Arpeggio classroom sync 20261118-010 (based on 20261118-009)

The candidate was tested without production classroom data reads/writes. Before the 010 app release, the coordinating root obtained action-time user confirmation, published the exact candidate rules through Firebase Console, and verified the published rules SHA-256 after reload. No classroom data was written for validation.

## Data and compatibility

- Confirmed arpeggio edits: `rooms/{roomId}/arpeggioFingerings/{major|minor}-{0..11}/upMap`.
- Temporary previews: `roomArpeggioEdits/{roomId}/{editorPushId}`.
- Scale `fingerings`, `roomEdits`, local `fingerings`, and scale snapshot storage are unchanged.
- Arpeggio local edits remain in `arpeggioFingerings`; confirmed room deltas inherit into that local namespace. Untouched personal pitches are preserved. Per-room snapshots use `roomArpeggioSnapshots`.
- Confirmation uses a transaction merging changed MIDI entries. Simultaneous unrelated edits survive; the last confirmed change wins for the same pitch. UI reset is a staged per-note deletion, so unrelated newer pitches survive.
- Previews never enter persistent fingerings. Confirmation/cancel clear the draft. Unsubscribe, stale-room checks, ordered draft writes, cleanup, and reconnect follow the existing scale channel.
- Older clients neither see arpeggio previews nor interpret arpeggio maps as scale maps. Their whole-room updates preserve unknown room fields through existing object spreads.

## Rules prerequisite

Existing rules reject both namespaces. Candidate `firebase-rules.json` adds only:

1. `arpeggioFingerings`: same key IDs as scales; nonempty objects containing only string `upMap` of at most 1800 characters.
2. `roomArpeggioEdits`: the existing scale draft read/write predicates (anonymous authentication, matching room existence and expiry rules, valid 20-character editor key, record owner) copied without broadening them. Direction is restricted to canonical `up`. The seven required fields retain existing value/length limits and unknown fields are rejected.

Existing root default-deny, scale rules, room expiry, authentication configuration, and Firebase public configuration are unchanged. The existing 32-hex legacy-room policy is inherited unchanged, not expanded. These non-sensitive classroom rooms retain the existing role model: authenticated participants can confirm practice changes; only a draft's owner can change/remove that draft.

**Live rules deployment was separately confirmed and completed by the coordinating root before app publication.** No Firebase deployment connector is available in the current tool catalog. The repository has public web configuration but no `firebase.json` / `.firebaserc` deployment setup. No stored authentication secrets were inspected. Installing a local emulator CLI is not evidence of production deploy access.

## Verification

- `node --test tests/*.test.cjs`: 479 passed.
- `JSDOM_MODULE=/path/to/jsdom node qa/arpeggio-classroom-dom.cjs`: two isolated DOM/localStorage clients, mock room transport. Covers remote previews, confirm, active-draft-preserving receive, both-device local persistence, simultaneous edits, reset/undo/cancel, failed-save authoritative restoration, scale isolation, and leave.
- `node --test tests/arpeggio-classroom.test.cjs`: two VM clients and mock Firebase transport. Covers queued leave, offline/reconnect, stale callbacks, canonical direction, delta races, legacy scale reset, and snapshot inheritance.
- `qa/arpeggio-editor.cjs`: existing local edit regression.
- `qa/fingering-dom.cjs`: 192 route/render cases.
- `qa/card-manual-collapse.cjs`: iPhone-sized DOM manual-collapse and classroom update regression.
- Independent worker ran actual local Firebase Database Emulator against baseline and candidate rules: 86/86 checks passed, including unknown-field denial, cross-owner/expiry/size restrictions, real authenticated two-client subscriptions, and actual onDisconnect cleanup preserving the other participant. Candidate rules SHA-256: cac2ecd661313db3508d70e2f0020753528488da99a85759cec9b5ab4f80c98b. Its report is separate; mock/DOM checks above are not emulator evidence.

Not verified by the implementation tests: physical iOS Safari touch/audio or real classroom practice. Production rules deployment verification belongs to the coordinating root; GitHub CI and exact Pages bytes are checked separately during publication.
