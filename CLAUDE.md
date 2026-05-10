# CLAUDE.md — ioBroker.plex

Project-specific guidance for Claude Code. Read this before making changes.

## Changelog discipline

- **Do not add `WORK IN PROGRESS` entries for regressions introduced and fixed within the same dev session.** A bullet in the changelog describes what changes between releases. If feature X worked before the last release, you broke it during development, and you fixed it before pushing — that round-trip is invisible to users and must stay out of the README and `io-package.json` news. The changelog is for users, not a development diary.
- Bullets in WORK IN PROGRESS should be 1–2 short, user-facing lines. No implementation detail (internal module names, library swaps, etc.) unless it affects how the user configures or operates the adapter.

## Release preparation

When the user asks to "prepare a release" / "release vorbereiten":

1. **`README.md` `### **WORK IN PROGRESS**` section must exist and be non-empty.** Bullets must be user-relevant only, terse (1–2 lines each), no implementation detail. If missing/empty, stop and ask.
2. **Decide bump kind from the WIP bullets** (semver): new feature → minor, fix-only → patch, incompatible change → major.
3. **Add a news entry** to `io-package.json` under `common.news`, keyed by the new version, as the *first* (newest) key. Translate into all eleven languages already present there: `en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn`. Multiple bullets are joined with `\n`. Reuse the README WIP wording (condense if needed).
4. **Do NOT touch the `version` field** in `io-package.json` or `package.json` — the release workflow bumps both. Only the news *key* gets the new version number.
5. **Keep README WIP and io-package.json news content in sync** (same bullets in same order). Also verify that any version constraints mentioned in WIP bullets match the actual values in `io-package.json` (e.g. `globalDependencies.admin`).

## Plex domain knowledge

- **Primary reference for Plex API behavior: `python-plexapi`** (https://github.com/pkkid/python-plexapi, docs at https://python-plexapi.readthedocs.io/). Actively maintained, used by Home Assistant. When Plex API questions come up (which endpoint to call, what a field means, how Plex actually behaves), consult its source before guessing or pulling random forum posts.
- **Plex API auth reference (local copy):** `docs/plex-api-auth.md` — extracted from `developer.plex.tv/pms/` (May 2026). Covers: X-Plex-* headers, JWT auth flow (new), legacy PIN flow, token refresh. The docs page is a Redoc SPA — WebFetch returns only navigation skeleton; use `curl + python3 html.unescape + tag-strip` to re-extract (method is in the file header).
- **Two token types exist; only the new JWT tokens expire.** Legacy opaque tokens (obtained via the old `plex.tv/api/v2/pins` flow, ~15 chars) do **not** expire. New JWT tokens (obtained via `clients.plex.tv/api/v2/pins` with a JWK, long `eyJ...` strings) expire after **7 days** and must be refreshed. Do not assume token expiry is the cause of offline without checking which token type is in use.
- **JWT token refresh** requires: (1) Ed25519 key pair per device, (2) `GET clients.plex.tv/api/v2/auth/nonce`, (3) sign a Device JWT, (4) `POST clients.plex.tv/api/v2/auth/token`. See `docs/plex-api-auth.md` for full details.
- **Plex Media Server HTTPS certs don't validate against IP addresses.** PMS presents either a self-signed cert or a `*.plex.direct` wildcard cert; both fail standard hostname validation when accessed by IP on the LAN. The adapter sets `rejectUnauthorized: false` on the `https.Agent` by design — this is the correct configuration for typical home setups, not a security oversight.
- **PIN flow (adapter's current implementation) uses `https://plex.tv/api/v2/pins` without `strong=true`.** This returns a 4-character human-readable code for entry at `plex.tv/link`. The new JWT PIN flow uses `clients.plex.tv/api/v2/pins` with a JWK body and `strong=true`.

## Code conventions

- **axios does not accept top-level `cert` / `key` / `ca` / `rejectUnauthorized`.** They must be wrapped in `httpsAgent: new https.Agent({…})`. The legacy `request` package accepted them at the root, which is why this pattern looks fine in code review but silently fails at runtime.
- **Do not reintroduce `plex-api` (npm) or `request-promise` as a direct dependency.** Plex API access goes through `lib/plexHttp.js`; PIN auth through `lib/plexPinAuth.js`. `request-promise` is still pulled in transitively via `tautulli-api` — that's out of our control until `tautulli-api` is replaced.
- **ioBroker `Foreign*` APIs are for objects/states OUTSIDE the adapter's own namespace.** For our own `plex.<instance>.*` tree, use the non-Foreign variants: `getObject` / `getObjectAsync` / `setObject` / `extendObject` / `extendObjectAsync` (relative ID, no `<adapter>.<instance>.` prefix); `getStates` / `getState` / `setState` for state values; `getAdapterObjectsAsync()` to enumerate all of the adapter's own objects. Reach for `getForeignObject*` / `extendForeignObject*` / `getForeignStates*` only when touching another adapter's namespace.

## Tooling

- **ESLint mit `--fix` aufrufen**, damit einfache Formatierungsprobleme (Prettier-Style, Einrückung, Zeilenumbrüche) automatisch behoben werden: `npx eslint --fix <datei>`. Erst danach `tsc --noEmit` zum Prüfen auf echte Typfehler.

## Reviewing & fixing

- **Verify audit findings against the actual code before fixing.** Exploration / audit subagents hallucinate; they read excerpts and miss surrounding context. Expect roughly 1 in 5 findings to be false positives or unsafe to apply. Read the relevant lines yourself before editing.
- **Do not "fix" long-standing NO-OPs without a strong reason.** A line that has been a no-op for years is effectively part of the working system. Changing it can surface latent bugs in the data it touches. Document the no-op or leave it.
- **No fabricated diagnoses.** If the root cause of a bug is unclear, say "unclear" or "unknown" in commits and logs. Inventing a plausible-sounding cause (JWT expiry, 2FA invalidation, …) to make a fix sound justified misleads future debugging.

## Git-Workflow

- **Commit und Push nur auf direkte Anfrage.** Nach Änderungen immer fragen, ob committet und gepusht werden soll — niemals eigenständig.

## Communication style

- **The user writes in German; reply in German.**
- **No trailing summaries when the diff is already visible.** Short status updates during a task are fine; recapping the entire change at the end as a table is noise.
