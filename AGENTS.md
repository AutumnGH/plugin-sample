# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-26
**Commit:** 4f8ad7b
**Branch:** main

## OVERVIEW

SiYuan note-taking app plugin. Users type messages into a chat-like dock panel; an AI button summarizes them into a daily note. Stack: TypeScript + Webpack + SiYuan Plugin API.

## STRUCTURE

```
plugin-sample/
├── src/
│   ├── index.ts          # Plugin entry point — lifecycle hooks, settings panel
│   ├── index.scss        # All styles (BEM-like mn__ prefix)
│   ├── types.ts          # Shared types + DEFAULT_CONFIG
│   ├── dock/
│   │   └── MessageDock.ts  # All dock UI + SiYuan API calls
│   ├── ai/
│   │   └── AIClient.ts   # Thin fetch wrapper for OpenAI-compatible APIs
│   └── i18n/
│       ├── en_US.json
│       └── zh_CN.json
├── webpack.config.js     # Dev → repo root; Prod → dist/ + package.zip
├── plugin.json           # Marketplace metadata (name must match repo name)
├── CLAUDE.md             # Build commands + architecture notes
└── eslint.config.mjs
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a new setting field | `src/index.ts` `initSettings()` + `src/types.ts` `MessageNoteConfig` |
| Change dock UI/layout | `src/dock/MessageDock.ts` `render()` + `src/index.scss` |
| Add a new AI provider | `src/types.ts` `AIProvider` union + `DEFAULT_CONFIG` |
| Add i18n string | `src/i18n/en_US.json` + `zh_CN.json` (both required) |
| Change message storage format | `MessageDock.ts` `sendMessage()` + `loadMessages()` |
| Register a new SVG icon | `src/index.ts` `addIcons()` call in `onload()` |

## CODE MAP

| Symbol | File | Role |
|--------|------|------|
| `MessageNotePlugin` | `src/index.ts` | Plugin root class; owns `config`, settings panel |
| `MessageDock` | `src/dock/MessageDock.ts` | All dock logic; instantiated per dock `init` callback |
| `AIClient` | `src/ai/AIClient.ts` | Stateless; one `chat()` call per generation |
| `apiPost<T>()` | `src/dock/MessageDock.ts:19` | Promise wrapper around SiYuan `fetchPost` |
| `DEFAULT_CONFIG` | `src/types.ts` | Source of truth for config shape and defaults |
| `mergeConfig()` | `src/index.ts:64` | Deep-merges saved config with defaults (preserves new keys) |

## CONVENTIONS

- **CSS prefix**: all classes use `mn__` (e.g. `mn__bubble`, `mn__list`)
- **API calls**: always go through `apiPost<T>()` — never call `fetchPost` directly in business logic
- **Config access in dock**: via `getConfig()` callback (closure over plugin instance) — never import plugin directly
- **Error messages**: prefix with `[MessageNote]` for console, use `this.i18n.*` for `showMessage()` user-facing strings
- **Timestamps**: store full ISO string in `custom-mn-ts` block attribute; display as `HH:mm` only
- **Quotes**: double quotes enforced by ESLint; semicolons required
- **`any` type**: allowed by ESLint config — but prefer typed where practical

## ANTI-PATTERNS (THIS PROJECT)

- **Do NOT use `fs` or Node.js file APIs** — use `/api/file/*` kernel endpoints only (sync conflict risk)
- **Do NOT call `fetchPost` directly** — wrap in `apiPost<T>()` for consistent error handling
- **Do NOT add i18n keys to only one language file** — both `en_US.json` and `zh_CN.json` must stay in sync
- **Do NOT register SVG icons used in dock HTML without `addIcons()`** — they silently render blank
- **Do NOT access `this.config` in `onload()`** — it's still `DEFAULT_CONFIG` until `onLayoutReady()` resolves

## LIFECYCLE ORDER

```
onload()         → register icons, dock, settings panel (config = DEFAULT_CONFIG here)
onLayoutReady()  → loadData() resolves → this.config updated (kernel ready)
dock.init()      → MessageDock.init() called (uses getConfig() closure, always current)
```

## COMMANDS

```bash
pnpm i              # install
pnpm run dev        # watch mode → index.js / index.css at repo root
pnpm run build      # production → dist/ + package.zip
pnpm run lint       # eslint --fix
```

## NOTES

- `siyuan` package is **external** — not bundled. All `import { ... } from "siyuan"` are runtime-provided by the host app.
- Dev output goes to **repo root** (place repo folder in `{workspace}/data/plugins/{name}/` for live reload).
- `plugin.json` `name` field must exactly match the GitHub repo name.
- `minAppVersion` is `3.5.3` — do not use APIs introduced after that version without bumping it.
- No test suite exists in this project.
