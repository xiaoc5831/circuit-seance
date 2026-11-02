# Next Kiro passes (queued for the 4,000-credit grant)

The free tier is spent (see `kiro-usage-log.md`). These passes are deliberately left for Kiro instead of being done by hand, so `.kiro/` stays kiro-cli output and the spec stays the source of truth. Run them in this order, headless, through `docs/kiro-runs/bg.sh` (detached). Don't use `run.sh` under a short shell timeout: run 10 got killed that way.

| # | Pass | Spec tasks | Why it's Kiro's job | Size |
|---|------|-----------|---------------------|------|
| 11 | **tasks.md status sync (finish run 10)**: tick 28.x, 30.x and 31.x with the notes from `10-tasks-status.prompt.md`, untick parent 22 (22.2 is still open), and append the "Status — 2026-11-03" section | – | `.kiro/` files must be written by kiro-cli | small (≈1–2 cr) |
| 12 | **SPICE MCP server**: `tools/spice-mcp/` (stdio, `@modelcontextprotocol/sdk`), `simulate_netlist` + `explain_waveform` tools that reuse `src/features/spirit/measure.ts` + `offline-explainer.ts`; register it in `.kiro/settings/mcp.json`; then have Kiro call it to re-verify all 10 bundled netlists; write `docs/spice-mcp.md` | 29.1–29.8, 30.10 | Kiro writing *and then using* its own MCP tool is the strongest "how Kiro was used" story | medium |
| 13 | **Ownership/review pass on hand-written code**: Kiro reviews every file in `hand-fixes.md` against requirements.md (EARS) and design.md; fixes or files issues; updates design.md where the implementation deliberately diverged (catalog.ts vs per-asset files, no `useSpirit` hook, key in localStorage only, measurement digest instead of `CompactSummary`) | – | Turns "hand-written" into "spec-reviewed"; design.md must be updated by Kiro | medium |
| 14 | **Steering refresh**: `fileMatch` steering for `src/features/scope/**` (CRT rendering rules: phosphor palette, reduced motion, no per-frame allocation) and for `src/features/spirit/**` (numbers must come from `measure()`, both languages, three sections) | – | Steering files | small |
| 15 | Hook fix found in review: `netlist-guard` `timeout` sits inside `action` instead of at hook level | – | `.kiro/hooks` | tiny |
| 16 | Remaining spec items: 22.2 parser property test (fast-check), 13.4 Anthropic adapter, 5.4 CodeMirror 6 behind a flag, 6.3 validation summary, 7.4 dry-run validation through the worker, 10.7 DC-sweep check, 21.1 offline WASM cache (service worker), 25.3 CI workflow | listed | Spec-tracked implementation | medium–large |

Known gaps that don't need Kiro (do whenever):
- The API key sits in React state while the app runs (spec 4.7 wanted it read from storage only at call time). It's never logged or sent anywhere but the provider.
- `useTranscribe` (run 09) is unused. Either wire it in or delete it during pass 13.
- Firefox / Safari manual smoke (27.2) hasn't been done yet. Playwright only covers Chromium.
