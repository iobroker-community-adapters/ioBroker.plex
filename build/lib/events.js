"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var events_exports = {};
__export(events_exports, {
  EVENTS: () => EVENTS
});
module.exports = __toCommonJS(events_exports);
const EVENTS = {
  new: {
    "library.on.deck": { title: "A new item is added that appears in the user\u2019s On Deck.", subtitle: "" },
    "library.new": { title: "A new item is added to a library.", subtitle: "" }
  },
  playback: {
    "media.play": {
      title: "%Metadata.title% (%Metadata.year%) playing",
      subtitle: "Played by %Account.title% on %Player.title%"
    },
    "media.pause": {
      title: "%Metadata.title% (%Metadata.year%) paused",
      subtitle: "Played by %Account.title% on %Player.title%"
    },
    "media.stop": {
      title: "%Metadata.title% (%Metadata.year%) stopped",
      subtitle: "Played by %Account.title% on %Player.title%"
    },
    "media.resume": {
      title: "%Metadata.title% (%Metadata.year%) resumed",
      subtitle: "Played by %Account.title% on %Player.title%"
    },
    "media.rate": {
      title: "%Metadata.title% (%Metadata.year%) rated",
      subtitle: "Played by %Account.title% on %Player.title%"
    },
    "media.scrobble": {
      title: "%Metadata.title% (%Metadata.year%) watched",
      subtitle: "Played by %Account.title% on %Player.title%"
    }
  },
  server: {
    "admin.database.backup": {
      title: "A database backup is completed successfully via scheduled tasks.",
      subtitle: ""
    },
    "admin.database.corrupted": { title: "Corruption is detected in the server database.", subtitle: "" },
    "device.new": { title: "A new device is using the Plex Media Server.", subtitle: "" },
    "playback.started": { title: "Playback is started by a shared user.", subtitle: "" }
  },
  tautulli: {
    "update.plex": { title: "Plex Update %update_version% (%update_release_date%) available!", subtitle: "" },
    "update.tautulli": { title: "Tautulli Update %tautulli_update_version% available!", subtitle: "" }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENTS
});
//# sourceMappingURL=events.js.map
