# DOCK KNOWLEDGE BASE

## OVERVIEW

`MessageDock.ts` is the largest file (283 lines) and owns all dock behavior: rendering, message persistence, AI generation. No other files in this directory.

## ARCHITECTURE

```
MessageDock
├── init()            → render → bindEvents → ensureNotebook → ensureDoc → loadMessages
├── sendMessage()     → appendBlock → setBlockAttrs → push to local array + DOM
├── generateDiary()   → AIClient.chat() → createDailyNote → appendBlock
├── loadMessages()    → SQL query on root_id → parse IAL for custom-mn-ts
└── ensureNotebook/Doc → idempotent setup; called once on init, lazily on send if docId missing
```

## KEY PATTERNS

- **Block attributes**: messages tagged with `custom-mn-type="message"` and `custom-mn-ts="{ISO}"` via IAL + `/api/attr/setBlockAttrs`
- **Message query**: SQL on `blocks` table filtering `ial LIKE '%custom-mn-type="message"%'` ordered by `created`
- **Daily note target**: first non-MessageNote, non-closed notebook via `lsNotebooks` → `createDailyNote`
- **Loading state**: AI button gets `mn__ai-btn--loading` class during generation (CSS handles opacity + spin)

## ANTI-PATTERNS

- Do NOT call `fetchPost` directly — use `apiPost<T>()`
- Do NOT render user content with raw innerHTML — always pass through `escapeHtml()`
- Do NOT add new user-visible strings as hardcoded literals — add to both i18n files and use `this.i18n.*`
- Do NOT call `ensureNotebook()` when `this.notebookId` is already set — check first to avoid redundant API calls

## NOTES

- `notebookId` and `docId` are instance state — reset on dock destroy/reinit
- `messages` array is the in-memory source of truth; DOM is always derived from it via `createBubble()`
- `isoTime` stored on `Message` for potential future sorting/filtering; `timestamp` is display-only `HH:mm`
