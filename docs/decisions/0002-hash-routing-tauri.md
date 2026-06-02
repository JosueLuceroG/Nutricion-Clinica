# 0002 — Use hash routing for Tauri webview

* Status: Accepted
* Date: 2026-05-20
* Deciders: José Manuel, IA agent
* Source: `spec.md` §13 ADR-002

## Context and Problem Statement

The app will run inside a Tauri webview (Windows: `tauri://`, Linux: `tauri://localhost`,
macOS: `tauri://`). The browser history API does not behave well with custom protocols
or `file://` URLs, and we cannot rely on a server rewriting paths.

## Decision Drivers

* Routing must work identically in dev (Vite, `http://localhost:5173`) and in
  production (Tauri, `tauri://`).
* Deep links to a specific patient or consultation must survive page reloads.
* No server-side routing layer (this is a local-first desktop app).
* Minimal bundle size impact.

## Considered Options

* **A) `createHashRouter` (React Router 7)** — URL is `/#/pacientes/{id}`.
* **B) `createBrowserRouter` (history API)** — URL is `/pacientes/{id}`, requires
  history fallback config in Tauri.
* **C) Custom router** — minimal, but reinventing the wheel.

## Decision Outcome

Chosen option: **A) `createHashRouter`**, because it works identically in any
environment (dev, Tauri, static hosting) without requiring Tauri to intercept
navigation events. SEO is irrelevant (desktop app), so the `#` in URLs is a
non-issue.

### Positive Consequences

* Zero environment-specific configuration.
* Deep links work via plain `<a href="#/pacientes/abc">`.
* No 404s on page reload (no server rewrite needed).
* React Router 7 ships with TypeScript types out of the box.

### Negative Consequences

* URLs are uglier (`/#/pacientes/abc` vs `/pacientes/abc`).
* The `#` fragment is technically a different "page" for analytics tools (irrelevant here).
* Cannot use the URL path for static asset routing (irrelevant for an SPA).

## Pros and Cons of the Options

### A) `createHashRouter`

* Good, because it works in any environment with no extra config.
* Good, because React Router 7 supports it as a first-class API.
* Bad, because URLs have a `#` prefix.

### B) `createBrowserRouter` with Tauri history fallback

* Good, because URLs are prettier.
* Bad, because Tauri must intercept navigation and serve `index.html` for unknown routes
  (more moving parts).
* Bad, because the history API can be flaky inside webviews.

### C) Custom router

* Good, because total control.
* Bad, because re-implementing nested routes, params, and code splitting is wasteful.
* Bad, because the React Router team ships fixes for webview edge cases we don't see.

## Links

* ADR source: `spec.md` §13 ADR-002.
* React Router 7 docs: https://reactrouter.com/start/data/routing
* Router setup: `src/app/router.tsx`.
