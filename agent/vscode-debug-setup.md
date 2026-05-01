# VSCode-Debugging für ioBroker.plex mit `dev-server`

Setup, um Breakpoints in `plex.js` und `lib/*.js` zu setzen, während der Adapter
über `@iobroker/dev-server` läuft. Funktioniert auch über VSCode Remote-SSH.

## TL;DR

1. Im Terminal: `dev-server watch -n` starten (`-n` = `--noStart`, dev-server
   synct nur und startet den Adapter NICHT selbst).
2. In VSCode F5 → "Launch Adapter (dev-server watch -n)".
3. Der Adapter pausiert auf der ersten Zeile, einmal Continue (F5) drücken.
4. Breakpoints in `plex.js` / `lib/*.js` greifen.

## launch.json

In `.vscode/launch.json` enthalten — beide Configs sind eingerichtet:

- **"Launch Adapter (dev-server watch -n)"** — startet den Adapter selbst aus
  VSCode mit `--inspect-brk`, ideal für initial-Debugging und kontrollierten
  Start.
- **"Attach to remote"** — hängt sich an einen bereits via
  `dev-server watch` (ohne `-n`) gestarteten Adapter, der mit `--inspect`
  läuft. Auto-Restart via nodemon, dafür kein Initial-Break.

## Warum diese Settings — die Stolperfallen

Drei nicht-offensichtliche Fallen:

### 1. `cwd` muss das dev-server-Profilverzeichnis sein, NICHT das Adapterverzeichnis

`dev-server watch -n` gibt selbst die Anleitung aus:

> You can now start the adapter manually by running
>     `node node_modules/iobroker.plex/plex.js --debug 0`
> from within `<profileDir>`

Das `cwd` ist also `${workspaceFolder}/.dev-server/default` (nicht
`.../node_modules/iobroker.plex`). Aus diesem cwd findet der Adapter das
js-controller-Setup, die States/Objects der Profile-Instanz usw.

### 2. `console: integratedTerminal` startet KEINEN Inspector — Trace-Diagnose

Die wichtigste Falle. Im Trace-Log (`trace: true` in launch.json setzen,
Logfile unter `~/.vscode-server/data/logs/.../ms-vscode.js-debug/*.json`
öffnen) sieht man das tatsächlich gestartete Kommando:

```
/usr/bin/node --experimental-network-inspection ./node_modules/iobroker.plex/plex.js --debug 0
```

Es fehlt **`--inspect-brk`**. vscode-js-debug versucht in moderneren Versionen
einen Bootloader-Mode via `NODE_OPTIONS=--require .../bootloader.js` und einen
IPC-Socket unter `/tmp/node-cdp.*.sock`. In manchen Setups (insbesondere VSCode
Remote-SSH, Node 22, vscode-js-debug 1.117+) verbindet sich der Bootloader
nicht zurück — null `Debugger.scriptParsed`-Events, der Inspector ist nie
attached, alle Breakpoints bleiben grau.

Lösung: Bootloader umgehen, expliziten Inspector-Port erzwingen:

```jsonc
"console": "internalConsole",
"outputCapture": "std",
"attachSimplePort": 9230,
"runtimeArgs": ["--inspect-brk=9230"]
```

`outputCapture: "std"` sorgt dafür, dass Adapter-stdout/stderr in die VSCode
Debug Console gespiegelt werden (inkl. ANSI-Farben).

### 3. Port-Belegung — js-controller nutzt 9228, Default-Inspect ist 9229

Wenn `dev-server watch` den Adapter selbst startet, läuft er typischerweise
auf 9229. js-controller im dev-server bindet 9228. Daher 9230 für die
Launch-Config — frei und kollidiert nicht. Wer "Attach to remote" nutzt,
bleibt bei 9229 (das ist der Standard, mit dem nodemon den Adapter startet).

## Workflows

### A) Kontrollierter Start mit Initial-Break

```bash
dev-server watch -n   # nur sync, kein Adapter-Start
```

In VSCode F5 → "Launch Adapter (dev-server watch -n)".

Bei Code-Änderung an `plex.js` / `lib/*.js`:

1. dev-server synct das geänderte File automatisch ins Profil
2. Im VSCode Debug-Panel: Stop + F5 (kein Auto-Restart)

### B) Auto-Restart via Attach

```bash
dev-server watch      # ohne -n; startet Adapter selbst mit --inspect
```

In VSCode F5 → "Attach to remote" (Port 9229). nodemon restartet den Adapter
bei File-Änderungen automatisch. Nachteil: kein Initial-Break, Breakpoints
müssen vor dem Trigger gesetzt sein, der den Code-Pfad auslöst.

## Diagnose-Checkliste, falls Breakpoints grau bleiben

1. **Stimmt der `program`-Pfad?** Der absolute Pfad
   `${workspaceFolder}/.dev-server/default/node_modules/iobroker.plex/plex.js`
   muss existieren — sonst hat dev-server noch nicht gesynct. Einmal
   `dev-server watch -n` laufen lassen und warten bis "Watching for file
   changes" steht.

2. **Inspector-Attach prüfen:** `"trace": true` in der Config setzen, F5,
   ausgegebenen Logfile-Pfad öffnen. Suche nach `runtime.cdp.*` oder
   `scriptParsed`. Wenn nichts auftaucht → Inspector nicht attached →
   Stolperfalle 2.

3. **Falscher Inspector-Port?** Wenn 9230 anderweitig belegt ist, kommt der
   Debugger nicht durch. Beide Werte (`attachSimplePort` und `runtimeArgs`)
   müssen identisch sein.

## Hinweis: `agent/`-Ordner und npm-Pack

Diese Anleitung liegt unter `agent/`. `package.json#files` ist eine Allowlist
— `agent/` ist nicht aufgeführt, also nicht im npm-Tarball. Der Ordner ist
nur in Git enthalten (für Mit-Entwickler), nicht im veröffentlichten Adapter.
