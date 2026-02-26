# SRC KNOWLEDGE BASE

## OVERVIEW

All plugin source. Entry: `index.ts`. Three submodules: `dock/` (UI+API), `ai/` (LLM client), `i18n/` (strings).

## WHERE TO LOOK

| Task | File |
|------|------|
| Plugin lifecycle (`onload`, `onLayoutReady`, `onunload`) | `index.ts` |
| Settings panel (all 5 fields) | `index.ts` `initSettings()` |
| Config type shape + defaults | `types.ts` `MessageNoteConfig` + `DEFAULT_CONFIG` |
| Dock UI, message send/load, AI trigger | `dock/MessageDock.ts` |
| OpenAI-compatible HTTP call | `ai/AIClient.ts` |
| User-visible strings | `i18n/en_US.json` + `i18n/zh_CN.json` |
| All CSS | `index.scss` |

## CONVENTIONS

- `types.ts` is the single source of truth for config shape — add fields there first, then wire up in `initSettings()`
- `AIProvider` is a union type — adding a provider requires: union entry + `DEFAULT_CONFIG` entry + settings UI sync
- `mergeConfig()` in `index.ts` must be updated when adding nested provider config keys
- i18n keys must be added to **both** JSON files simultaneously — no partial additions

## ANTI-PATTERNS

- Do NOT import `MessageNotePlugin` into `MessageDock.ts` — use the `getConfig()` closure pattern
- Do NOT add provider-specific logic outside `types.ts` defaults + `MessageDock.generateDiary()`
- Do NOT skip `escapeHtml()` when rendering user content into innerHTML
