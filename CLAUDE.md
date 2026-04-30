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

- **X-Plex-Tokens from the PIN flow do not normally expire.** Don't write log messages or code comments suggesting "the token has expired, please renew" without evidence. Other Plex clients (Home Assistant, Plexamp, …) run for years on the same token. If the adapter goes offline, look for the real cause first — token expiry is almost never it.
- **Plex Media Server HTTPS certs don't validate against IP addresses.** PMS presents either a self-signed cert or a `*.plex.direct` wildcard cert; both fail standard hostname validation when accessed by IP on the LAN. The adapter sets `rejectUnauthorized: false` on the `https.Agent` by design — this is the correct configuration for typical home setups, not a security oversight.
- **PIN flow uses `https://plex.tv/api/v2/pins` without `strong=true`.** `strong=true` returns a long opaque code for headless clients; the default (omitted) returns the 4-character human-readable code that users enter at `plex.tv/link`.

## Code conventions

- **axios does not accept top-level `cert` / `key` / `ca` / `rejectUnauthorized`.** They must be wrapped in `httpsAgent: new https.Agent({…})`. The legacy `request` package accepted them at the root, which is why this pattern looks fine in code review but silently fails at runtime.
- **Do not reintroduce `plex-api` (npm) or `request-promise` as a direct dependency.** Plex API access goes through `lib/plexHttp.js`; PIN auth through `lib/plexPinAuth.js`. `request-promise` is still pulled in transitively via `tautulli-api` — that's out of our control until `tautulli-api` is replaced.

## Reviewing & fixing

- **Verify audit findings against the actual code before fixing.** Exploration / audit subagents hallucinate; they read excerpts and miss surrounding context. Expect roughly 1 in 5 findings to be false positives or unsafe to apply. Read the relevant lines yourself before editing.
- **Do not "fix" long-standing NO-OPs without a strong reason.** A line that has been a no-op for years is effectively part of the working system. Changing it can surface latent bugs in the data it touches. Document the no-op or leave it.
- **No fabricated diagnoses.** If the root cause of a bug is unclear, say "unclear" or "unknown" in commits and logs. Inventing a plausible-sounding cause (JWT expiry, 2FA invalidation, …) to make a fix sound justified misleads future debugging.

## Communication style

- **The user writes in German; reply in German.**
- **No trailing summaries when the diff is already visible.** Short status updates during a task are fine; recapping the entire change at the end as a table is noise.
