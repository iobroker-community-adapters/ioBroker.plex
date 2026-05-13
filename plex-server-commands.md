# Plex Media Server — Verfügbare Server-Kommandos

> Referenz für die ioBroker.plex-Implementierung der Server-Verwaltungsbefehle.
> Alle Endpunkte erfordern den Header `X-Plex-Token: {token}`.
> Basis-URL: `http(s)://{plexIp}:{plexPort}`

---

## 1. Library-Verwaltung (pro Bibliothek)

Diese Kommandos werden pro Library-Ordner als Buttons angelegt unter:
`libraries.{key}-{title}._commands.{cmdName}`

| State-Name        | HTTP     | Endpunkt                                      | Beschreibung                                      |
|-------------------|----------|-----------------------------------------------|---------------------------------------------------|
| `_refresh`        | POST     | `/library/sections/{id}/refresh?force=1`      | Scan + Force-Metadatenaktualisierung (**kaputt**: derzeit type:channel, write:false — wird mitgefixxt) |
| `scan`            | GET      | `/library/sections/{id}/refresh`              | Nur Festplatte scannen (schnell, kein Metadaten-Re-Download) |
| `scanForce`       | GET      | `/library/sections/{id}/refresh?force=1`      | Scan + Metadaten aller Einträge erzwungen neu laden (langsam) |
| `emptyTrash`      | PUT      | `/library/sections/{id}/emptyTrash`           | Papierkorb dieser Bibliothek leeren               |
| `analyze`         | PUT      | `/library/sections/{id}/analyze`              | Audiospuren/Untertitel analysieren                |

**Notizen:**
- `{id}` = numerische Section-Key aus `/library/sections` (z.B. `1`, `2`, `3`)
- `emptyTrash` entfernt Einträge aus dem Papierkorb (gelöschte Dateien, die PMS noch kennt)
- `analyze` lässt PMS Audiospuren und Untertitel-Streams neu einlesen (z.B. nach Codec-Änderung)

---

## 2. Globale Wartungs-Kommandos (Server-weit)

Angelegt einmalig beim Adapter-Start unter: `maintenance.{cmdName}`

| State-Name           | HTTP | Endpunkt                          | Beschreibung                                             |
|----------------------|------|-----------------------------------|----------------------------------------------------------|
| `refreshAllLibraries`| GET  | `/library/sections/all/refresh`   | Alle Bibliotheken gleichzeitig aktualisieren             |
| `cleanBundles`       | PUT  | `/library/clean/bundles`          | Verwaiste Metadaten-Bundle-Dateien entfernen             |
| ~~`emptyTrashAll`~~  | ~~PUT~~ | ~~`/library/emptyTrash`~~      | ~~Kein globaler Endpunkt in PMS~~ → per-Library `emptyTrash` nutzen |
| `optimize`           | PUT  | `/library/optimize`               | Datenbank vakuumieren und Indizes optimieren             |

**Notizen:**
- `cleanBundles`: Löscht `.bundle`-Dateien im PMS-Datenverzeichnis, die keiner Mediendatei mehr zugeordnet sind. Dauert je nach Größe einige Sekunden.
- `emptyTrashAll`: Schneller globaler Papierkorb-Leerer ohne Library-ID. Nicht das Gleiche wie `DELETE /library/sections/{id}/trash`.
- `optimize`: Entspricht "Datenbank optimieren" in den PMS-Einstellungen. Kann einige Minuten dauern.

---

## 3. Metadaten-Kommandos (pro laufendem Medium)

Angelegt dynamisch beim `media.play`-Event unter: `_playing.{player-id}._Commands.{cmdName}`

| State-Name          | HTTP | Endpunkt                                                                         | Beschreibung                                    |
|---------------------|------|----------------------------------------------------------------------------------|-------------------------------------------------|
| `refreshMetadata`   | PUT  | `/library/metadata/{ratingKey}/refresh`                                          | Metadaten des laufenden Mediums neu laden       |
| `markWatched`       | GET  | `/:/scrobble?key={ratingKey}&identifier=com.plexapp.plugins.library`            | Als "gesehen" markieren                         |
| `markUnwatched`     | GET  | `/:/unscrobble?key={ratingKey}&identifier=com.plexapp.plugins.library`          | Als "ungesehen" markieren                       |
| `rate`              | PUT  | `/:/rate?key={ratingKey}&identifier=com.plexapp.plugins.library&rating={val}`   | Bewertung setzen (0–10, `0` = zurücksetzen)     |

**Notizen:**
- `{ratingKey}` wird aus `_playing.{player}.Metadata.ratingkey` gelesen (State im laufenden Event).
- `rate`: Wert `0` löscht die Bewertung. Plex-interne Skala: 1–10 (0.5-Schritte möglich). Im ioBroker-State: `type: number`, `min: 0`, `max: 10`.
- `markWatched` / `markUnwatched`: Für Episoden wird das spezifische Element markiert, nicht die gesamte Serie.
- Diese Commands bleiben beim nächsten `media.play` überschrieben (neuer ratingKey).

---

## 4. Server-Einstellungen (GET/PUT)

Angelegt einmalig durch `getSettings()` unter: `settings.{group}.{settingId}`

| Endpunkt       | HTTP | Beschreibung                              |
|----------------|------|-------------------------------------------|
| `/:/prefs`     | GET  | Alle Einstellungen abrufen (bereits impl.)|
| `/:/prefs`     | PUT  | Eine Einstellung schreiben (neu!)         |

**PUT-Syntax:** `/:/prefs?{settingId}={encodedValue}`

**Beispiele für wichtige Setting-IDs:**

| Setting-ID                              | Typ     | Beschreibung                         |
|-----------------------------------------|---------|--------------------------------------|
| `FriendlyName`                          | string  | Anzeigename des Plex-Servers         |
| `TranscoderQuality`                     | int     | Transkodierungsqualität (0–4)        |
| `TranscoderTempDirectory`               | string  | Temp-Verzeichnis für Transkodierung  |
| `HardwareAcceleratedVideoDecoding`      | bool    | Hardware-Dekodierung aktivieren      |
| `GracenoteUser`                         | string  | Gracenote-Benutzerkonto              |
| `EnableIPv6`                            | bool    | IPv6 aktivieren                      |
| `ManualPortMappingPort`                 | int     | Manueller Port für Remote-Zugriff    |
| `SendCrashReports`                      | bool    | Absturzberichte senden               |
| `PushNotificationsEnabled`              | bool    | Push-Benachrichtigungen aktivieren   |

> **Alle verfügbaren Setting-IDs** werden zur Laufzeit von `GET /:/prefs` geliefert und als States angelegt — nicht statisch hardcoded.

---

## 5. Noch nicht implementiert (mögliche Zukunft)

| Kategorie           | Methode   | Endpunkt                                          | Beschreibung                               |
|---------------------|-----------|---------------------------------------------------|--------------------------------------------|
| Playlist erstellen  | POST      | `/playlists?type=video&title=...&uri=...`         | Neue Playlist anlegen                      |
| Playlist löschen    | DELETE    | `/playlists/{id}`                                 | Playlist entfernen                         |
| Playlist-Item add   | PUT       | `/playlists/{id}/items?uri=...`                   | Item zu Playlist hinzufügen                |
| Playlist-Item rm    | DELETE    | `/playlists/{id}/items/{itemId}`                  | Item aus Playlist entfernen                |
| Match suchen        | GET       | `/library/metadata/{key}/matches?manual=1`        | Alternative Metadaten-Quellen suchen       |
| Match anwenden      | PUT       | `/library/metadata/{key}/match?guid=...`          | Metadaten-Match übernehmen                 |
| Collection erstellen| POST      | `/library/collections?type=...&title=...&uri=...` | Neue Sammlung anlegen                      |
| Mediendatei löschen | DELETE    | `/library/metadata/{key}/media/{mediaId}`         | Datei dauerhaft von der Festplatte löschen |
| Poster setzen       | PUT       | `/library/metadata/{key}/poster?url=...`          | Poster-Bild aus Plex-Galerie setzen        |

---

## HTTP-Methodenübersicht

| Methode  | Verwendung                                           |
|----------|------------------------------------------------------|
| `GET`    | Daten abrufen, Refresh-Trigger, scrobble/unscrobble  |
| `PUT`    | Einstellungen setzen, emptyTrash, analyze, optimize  |
| `POST`   | Neue Objekte erstellen (Playlist, Collection)        |
| `DELETE` | Objekte löschen (Playlist, Mediendatei)              |

> **Quelle:** python-plexapi (https://github.com/pkkid/python-plexapi),
> Plex Developer Docs (https://developer.plex.tv/pms/),
> Plexopedia (https://www.plexopedia.com/plex-media-server/api/)
