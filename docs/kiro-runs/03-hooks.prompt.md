Create Kiro agent hooks for this project as standalone JSON files in `.kiro/hooks/` (schema `"version": "v1"`, `hooks` array, PascalCase triggers). Read `.kiro/steering/` and `.kiro/specs/circuit-seance/` first so the hooks match the planned structure. The app code does not exist yet, so every command hook must exit 0 quietly when `package.json` or `node_modules` is missing. Do not write application code and do not run git commands.

Hooks to create:
1. `lint-on-save.json` — PostFileSave on `src/**/*.ts(x)`: run ESLint --fix and Prettier on the saved file (path comes in on STDIN JSON).
2. `netlist-guard.json` — PostFileSave on files under `src/features/netlist/`, `src/features/simulate/`, or `src/examples/`: run the related Vitest tests (`vitest related --run <file>`) so a broken parser/validator or a bad bundled example netlist is caught immediately.
3. `i18n-sync.json` — agent hook, PostFileSave on `src/app/i18n/en.ts`: prompt the agent to add any new or changed keys to `src/app/i18n/zh-CN.ts` with natural Simplified Chinese translations suitable for EE students, keeping key order identical.
4. `spirit-tone.json` — agent hook, PostFileSave on `src/features/spirit/**` or `src/lib/llm/**`: prompt the agent to check that prompts sent to LLMs never include the user's API key, send only the compact numeric summary (never raw waveform arrays), and keep the spirit's voice playful-spooky but technically correct.

After writing them, validate each file is valid JSON and list what you created in one short paragraph.
