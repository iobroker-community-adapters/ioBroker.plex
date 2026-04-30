# Plex Admin-UI Umbau — Stand 2026-04-30

## Was wurde gemacht

- `admin/jsonConfig.json` (5 Tabs) ersetzt das alte `admin/index_m.html`.
- `src-admin/` mit Vite + Module Federation + MUI v6 + `@iobroker/json-config`/`@iobroker/adapter-react-v5`. Federation-Container heißt **`ConfigCustomPlexSet`**, Komponente **`TokenWizard`**.
- `tasks.ts` kopiert nach jedem Build `admin/custom/{customComponents.js, assets/*.js, i18n/*.json}` (cleant das Zielverzeichnis vorher).
- `plex.js` patched: neue Modulvariable `lastErrorKind` (`'unauthorized'|'network'|null`), neuer `getConnectionStatus`-Message-Handler (vor dem switch), Tracking in den Fehler/Erfolgs-Pfaden, Tautulli-Token mit Heuristik-Fallback (XOR-decode nur bei nicht-druckbaren Zeichen + Warnung), SSL-Cert-Felder mit Fallback `*Val || *`.
- `io-package.json`: `adminUI.config: "json"`, `materialize` raus, `globalDependencies: admin >=7.8.0`.
- `package.json` Scripts: `npm:admin`, `build:admin`, `build:all`, `lint:admin`, `dev:admin`, plus `tsx` als devDep im Root.
- `src-admin/package.json`: Versionen exakt gepinnt wie ticaki/icloud (`@module-federation/vite@1.14.1`, `vite@7.3.1`, `adapter-react-v5@8.1.6`, `json-config@8.2.18`). Mit aktuelleren Versionen produziert Vite ein 4-KB-Init-Bundle statt des 188-Byte-Stubs, das der Admin-Loader nicht akzeptiert.
- `src-admin/`: `npm run build` = Vite + Copy (~35 s, ohne tsc); `npm run check` für reinen Type-Check separat.
- `.gitignore`: `src-admin/node_modules`, `src-admin/build`, `src-admin/.__mf__temp`.
- `README.md` WIP-Bullet ergänzt.

## Bugfix: Token übernehmen leerte alle Felder (gefixt 2026-04-30 nachmittag)

**Symptom:** Token-Wizard übernimmt Token, alle anderen Felder werden geleert, danach jeder Eingabe gibt GUI-Fehler.

**Ursache:** In `TokenWizard.applyToken()` wurde `this.props.onChange('plexToken', r.token)` aufgerufen. Die korrekte API ist `this.onChange(attr, value)` — die geerbte Klassenmethode aus `ConfigGeneric`, die intern `JSON.parse(JSON.stringify(this.props.data))` klont, das Feld setzt und _dann_ `props.onChange(modifiedData)` aufruft. Direkter `props.onChange(attr, value)` ersetzt das gesamte data-Objekt durch `{plexToken: ...}`.

**Fix in `src-admin/src/TokenWizard.tsx` Zeile ~270:**
```ts
await this.onChange('plexToken', r.token);
```
(Build mit dem Fix wurde frisch erstellt.)

## Build-Speicher-Hinweis

Bei knappem RAM/Swap (System hatte 7.3/9.5 GB benutzt, Swap voll) wurde der Vite-Build per OOM-Killer beendet ("Killed" nach "rendering chunks..."). Workaround:
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```
Erstmal 2 GB statt 4 GB versuchen — bei ganz knappem System hilft mehr Heap nicht (OS-OOM-Killer).

## Was noch offen ist

1. **Browser-Test**: Adapter neu hochladen (`iobroker upload plex` oder dev-server upload), Browser hard-reloaden (Strg+Shift+R), in der Plex-Instanz konfigurieren:
   - Alle 5 Tabs erscheinen.
   - Leerer Token → roter Button "Token nötig".
   - Wizard durchspielen → PIN kopieren → plex.tv/link → Token übernehmen → Dialog schließt → **andere Felder bleiben gefüllt** (Bugfix verifizieren).
   - Speichern → Adapter startet → Button wird grün.
   - Token kaputtmachen → innerhalb 3 s wieder rot.

2. **Falls "Cannot load ConfigCustomPlexSet" erneut auftritt**: `iobroker version admin` checken, sollte ≥7.8.0 sein. icloud verlangt nur `>=7.6.20` und funktioniert — Versionsthema ist daher unwahrscheinlich, eher Browser-Cache (alte 4-KB customComponents.js) oder Adapter nicht hochgeladen.

3. **Legacy-Dateien löschen** nach erfolgreichem Test:
   ```bash
   rm admin/index_m.html admin/admin.js admin/admin.css admin/words.js
   ```

4. **Optional**: Andere i18n-Sprachen für TokenWizard-Texte (es/fr/it/nl/pl/pt/ru/uk/zh-cn) — aktuell Fallback auf en. Files in `src-admin/src/i18n/{lang}.json` analog zu en.json/de.json anlegen, dann `npm run build:admin`.

## Architektur-Erinnerungen

- Federation-Name `ConfigCustomPlexSet` ist in `src-admin/vite.config.ts` definiert und wird beim Build überall hineingebrannt. **Niemals** auch in `src-admin/index.html` schreiben — die ist nur Dev-Harness für `vite --port 4173`. Bei icloud steht der Name dort auch nicht in der Source-index.html (nur in der generierten `build/index.html`).
- jsonConfig referenziert ihn als `"name": "ConfigCustomPlexSet/Components/TokenWizard"`, `"url": "custom/customComponents.js"`, `"bundlerType": "module"`.
- Wenn Versionen drift: `cd src-admin && rm -rf node_modules package-lock.json && npm install` macht clean install.
