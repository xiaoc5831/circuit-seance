You are updating the spec task list only. Edit exactly one file: `.kiro/specs/circuit-seance/tasks.md`. Do not create, edit or run anything else (no npm, no tests, no other files). Keep every existing line and requirement link; only change checkboxes and append short notes.

Context: since your last run the remaining MVP was implemented by hand (logged in `docs/kiro-runs/hand-fixes.md`). Bring tasks.md in line with the code:

1. Change `- [ ]` to `- [x]` for these sub-tasks and parent groups, appending the italic note in brackets where given:
   4.6 [_SettingsDialog.tsx; key kept only in localStorage by owner decision_]; 5.3; 7.5 [_Scope.tsx overlay_]; 10.6 [_magnitude only; phase not drawn_]; 10.8 [_Scope.tsx .op table_];
   12, 12.1, 12.2, 12.3 [_capture/compress.ts + "Your own drawing" card in SeanceTable.tsx; ≤1600 px JPEG instead of 5 MB loop_];
   13.3 [_lib/llm/factory.ts_]; 15.2 [_TranscriptionStage.tsx_]; 15.3;
   16, 16.1, 16.2 [_offline-explainer.ts `offlineExplanation()`; quotes measured numbers_];
   17, 17.1 [_logic lives in App.tsx, no separate hook_], 17.2, 17.3, 17.4, 17.5 [_homework-check.ts_];
   18 (parent, already x), 18.3, 18.5, 18.6, 18.7 [_Simulate disabled when empty/busy; live features hidden without key_];
   19, 19.1, 19.2, 19.3 [_e2e at 390×844, no horizontal overflow_];
   20, 20.1, 20.2, 20.3, 20.4, 20.5;
   21.2 [_engine warm-up during intro_];
   22 (parent); 25, 25.1, 25.2 [_tests/e2e/smoke.spec.ts, 10 tests, run via scripts/e2e.sh_]; 26, 26.1;
   27.1, 27.3, 27.4, 27.5, 27.6 [_e2e asserts zero non-localhost requests_];
   28, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7 [_recorded responses + manifest in features/haunted/catalog.ts; waveform at ≈8.4 s incl. intro_];
   30, 30.1–30.9 [_netlists in features/haunted/netlists, drawings in public/classics, blurbs/recorded responses inline in catalog.ts, gallery is a tab in SeanceTable.tsx_], 30.10 [_verified by tests/integration/catalog.test.ts instead of the MCP server_];
   31, 31.1, 31.2.

2. Leave these unchecked: 5.4, 6.3, 7.4, 10.7, 13.4, 21 (parent), 21.1, 21.3, 22.2, 25.3, 27 (parent), 27.2, and all of 29 (SPICE MCP server, deferred).

3. Append at the very end a section:

## Status — 2026-11-03
- Core path and stretch items above are done; see docs/kiro-runs/hand-fixes.md for which parts were written by hand.
- Deferred to the next Kiro pass: task 29 (SPICE MCP server), 5.4 (CodeMirror), 13.4 (Anthropic adapter), 22.2 (property test), 21.1/21.3, 25.3 (CI). See docs/next-kiro-passes.md.

Reply with one line: DONE and the number of checkboxes you changed.
