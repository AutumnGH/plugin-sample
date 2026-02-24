# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Install dependencies (use pnpm, not npm):
```
pnpm i
```

Development (watch mode, outputs to repo root as `index.js` / `index.css`):
```
pnpm run dev
```

Production build (outputs to `dist/` and creates `package.zip` for marketplace release):
```
pnpm run build
```

Lint with auto-fix:
```
pnpm run lint
```

There are no automated tests in this project.

## Architecture

This is a SiYuan note-taking app plugin. The entire plugin logic lives in a single entry point: `src/index.ts`, which exports a default class extending `Plugin` from the `siyuan` package.

The `siyuan` package is an external dependency — it is NOT bundled into the output. Webpack externalizes it as `commonjs2 siyuan`, meaning SiYuan itself provides the runtime API. All imports from `"siyuan"` are available at runtime in the host app.

### Plugin lifecycle

The main class overrides these lifecycle hooks:
- `onload()` — register icons, tabs, commands, dock panels, settings, slash commands, toolbar options
- `onLayoutReady()` — add top bar icons and status bar items (DOM is ready here)
- `onunload()` — cleanup
- `uninstall()` — remove persisted data
- `updateCards()` — flashcard sorting hook

### Key patterns

**Persistent storage**: Use `this.saveData(key, data)` / `this.loadData(key)` / `this.removeData(key)`. Never use `fs` or Node.js APIs directly — always go through the kernel API (`/api/file/*`) to avoid sync conflicts.

**i18n**: Strings live in `src/i18n/en_US.json` and `src/i18n/zh_CN.json`. Access them via `this.i18n.keyName` in the plugin class.

**Event bus**: Subscribe/unsubscribe with `this.eventBus.on(eventName, handler)` / `this.eventBus.off(eventName, handler)`. Bind `this` before passing handlers as callbacks if you need to unsubscribe later (see `blockIconEventBindThis` pattern).

**Mobile detection**: Check `getFrontend() === "mobile" || "browser-mobile"` in `onload()` and branch UI accordingly.

### Build output

- Dev: `index.js`, `index.css`, `i18n/` at repo root — place the repo folder directly in `{workspace}/data/plugins/{plugin-name}/` for live development
- Prod: `dist/` folder + `package.zip` — the zip is what gets uploaded to GitHub releases for marketplace distribution

### plugin.json

Defines plugin metadata. `name` must match the GitHub repo name exactly. `minAppVersion` controls the minimum SiYuan version required. `backends` and `frontends` arrays control where the plugin runs.
