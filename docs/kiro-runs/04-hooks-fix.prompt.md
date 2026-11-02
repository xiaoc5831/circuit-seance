Review of `.kiro/hooks/lint-on-save.json` and `.kiro/hooks/netlist-guard.json` found a bug: the commands read the event from `$KIRO_HOOK_INPUT`, but per https://kiro.dev/docs/hooks/actions Kiro passes hook event data as JSON on **STDIN**, and the exact field holding the saved path is not documented (it may be `filePath`, `file_path`, `path`, or nested under `tool_input`).

Fix both command hooks:
- Move the logic into small Node scripts `scripts/hooks/lint-on-save.mjs` and `scripts/hooks/netlist-guard.mjs` (no dependencies, ESM), and make the hook commands just `node scripts/hooks/<name>.mjs`.
- Each script reads all of STDIN, parses JSON defensively, finds the saved file path by checking `filePath`, `file_path`, `path`, `tool_input.path`, `tool_input.file_path`, and also any string field ending in `.ts`, `.tsx`, `.cir`, or `.sp`; exits 0 quietly when nothing is found, when `package.json` or `node_modules` is missing, or when the file is outside `src/`.
- lint-on-save runs `npx --no-install eslint --fix <file>` then `npx --no-install prettier --write <file>`; netlist-guard runs `npx --no-install vitest related --run <file>` and exits non-zero with the test output on stderr if tests fail (so the agent sees the failure).
- Add a `timeout` of 60 seconds for netlist-guard.

Then test both scripts yourself by piping sample JSON (`echo '{"filePath":"src/examples/rc.cir"}' | node scripts/hooks/netlist-guard.mjs`) and confirm exit 0 in the current repo (no package.json yet). Do not run git commands. Report the result in two sentences.
