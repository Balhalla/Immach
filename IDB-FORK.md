# IDB fork (ImmichDriveBridge)

Internal Immich fork, branched off upstream `v3.2.0` (commit `1b6098c9d`).

Branch: **`idb/main`**

Purpose:

- tag badges underneath photos in the timeline grid (global on/off toggle)
- first-class grid tagging (bulk add and remove)
- asset-viewer toolbar integration for Google Drive originals (download original + open original)

Entry point / spec: `C:\BalhallaFestival\Workspace4\ImmichDriveBridge\docs\FORK-HANDOFF.md`

Upgrade policy: no continuous upstream tracking. Rebase onto a new Immich tag only when new
upstream functionality is actually wanted, then rebuild and smoke-test.

Build (web only):

```powershell
pnpm install --frozen-lockfile
pnpm --filter @immich/sdk build
pnpm --filter immich-web build   # -> web/build
```

Deploy (local stack): bind-mount `web/build` over `/build/www` via
`ImmichDriveBridge/compose/fork-web.yml`.
