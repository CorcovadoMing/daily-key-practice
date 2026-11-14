# 039 arpeggio-only polish
Based on 037. Parent combines separate 038 note-dialog work.
- Every arpeggio staff note is quarter; 13 noteheads/stems, zero beams. Scale engraving unchanged.
- Both major and minor arpeggios derive ascending saved map/default fingering; descending projection reverses those placements, ignoring conflicting saved down map only for arpeggios.
- Single half-width desktop board labeled 上下行相同 in each arpeggio section. Minor scale still has separate up/down boards.
- No persistence/schema/audio changes.
- 233 unit tests pass. qa/arpeggio.cjs checks 24 keys, all quarters, no beams, 13 stems, scale beam preservation, single board, custom updates, conflicting down-map reversal. wide-layout/ui-polish pass.
- Managed Chromium desktop A minor: quarter13/beam0/board1, board456px within926px section. At390 iframe: document375/scroll375, board297px, score282/scroll960, ArrowRight settled scrollLeft40. Screenshots inspected.
- Preview stopped. No deployment. Physical iPad not tested.
