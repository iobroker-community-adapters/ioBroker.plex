"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var players_exports = {};
__export(players_exports, {
  Controller: () => Controller,
  Player: () => Player
});
module.exports = __toCommonJS(players_exports);
var import_axios = __toESM(require("axios"));
class Controller {
  static garbageExcluded = ["Player", "_Controls"];
  players = [];
  serverUuid = "";
  controllerIdentifier;
  plexToken;
  plex;
  // Internal references — the surrounding adapter / library types are deliberately loose
  // because Library is migrated separately and its surface is JSON-driven.
  _adapter;
  _library;
  _actions;
  _nodes;
  _playerdetails;
  noRefresh;
  constructor(adapter, options, library) {
    this._adapter = adapter;
    this.controllerIdentifier = options.controllerIdentifier;
    this.plexToken = options.plexToken;
    this.plex = options.plex;
    this._actions = options.actions || {};
    this._nodes = options.nodes || {};
    this._library = library;
    this._playerdetails = options.playerdetails || {};
    this.noRefresh = this._adapter.config.getPlayerRefresh == 0;
  }
  setServerId(uuid) {
    this.serverUuid = uuid;
  }
  getServerId() {
    return this.serverUuid;
  }
  existPlayer(prefix = "") {
    const i = this.players.findIndex((p) => p.prefix.toLowerCase() == prefix.toLowerCase());
    return i > -1 ? this.players[i] : null;
  }
  /**
   * Creates a player if it does not already exist.
   *
   * @param options Player options
   */
  createPlayerIfNotExist(options) {
    if (!options.config.title || !options.config.uuid) {
      throw new Error(
        `createPlayerIfNotExist called without title: ${options.config.title} or uuid ${options.config.uuid}`
      );
    }
    const prefix = `_playing.${this._library.clean(`${options.config.title}`, true)}-${options.config.uuid}`;
    let player = this.existPlayer(prefix);
    if (!player) {
      player = new Player({ ...options, prefix }, this);
      this.players.push(player);
    }
    return player;
  }
}
class Player {
  unload = false;
  prefix;
  address;
  port;
  config;
  details;
  refresh;
  refreshDetails;
  /**
   * Discovery sources that found this player (e.g. `['plex.tv/devices', '/status/sessions']`).
   * `/player/timeline/poll` only works for legacy GDM clients (`/clients` source); for
   * Companion devices PMS returns 404 because they're reachable via pubsub-websocket
   * instead. The PMS notifications WebSocket replaces the timeline poll for those.
   */
  sources = [];
  /**
   * The Plex `provides` declaration for this device. Empty for Companion-only mobile/web
   * apps (Plex iOS/Android, Plex Web). HTTP control commands only work when this includes
   * `player` or `pubsub-player` (Apple TV, Plexamp Desktop, PMP, PHT) or when the device
   * was discovered via `/clients` (GDM, implicit `provides=player`).
   */
  provides = "";
  updatedStates = true;
  updateTrys = 0;
  commandID = 0;
  PLEX_HEADERS;
  refreshTimeout = void 0;
  latelyActionCall = "";
  lyric = null;
  media;
  _controller;
  _updater;
  constructor(options, controller) {
    this._controller = controller;
    this.config = options.config;
    this.prefix = options.prefix || "";
    this.refresh = this._controller._adapter.config.getPlayerRefresh > 1 ? this._controller._adapter.config.getPlayerRefresh : 60;
    this.details = this._controller._library.getDeviceStateJson(`${this.prefix}.Player.details`) || {};
    this.config.protocolCapabilities = this._controller._library.getDeviceState(`${this.prefix}.Player.protocolCapabilities`) || "none";
    this.address = options.address || this._controller._library.getDeviceState(`${this.prefix}.Player.localAddress`) || "";
    this.port = options.port || this._controller._library.getDeviceState(`${this.prefix}.Player.port`) || 0;
    this.config.controllable = !!this._controller._library.getDeviceState(`${this.prefix}.Player.controllable`);
    this.refreshDetails = !!this._controller._library.getDeviceState(`${this.prefix}._Controls.timeline.refreshDetails`) || true;
    this.details.state = "stopped";
    this.config.connected = true;
    this.PLEX_HEADERS = {
      "X-Plex-Token": this._controller._adapter.config.plexToken,
      "X-Plex-Target-Client-Identifier": this.config.uuid,
      "X-Plex-Client-Identifier": this._controller.controllerIdentifier,
      "X-Plex-Device-Name": "ioBroker",
      "X-Plex-Product": "Plex for ioBroker",
      "X-Plex-Provides": "controller"
    };
    this._controller._library.set({
      node: "_playing",
      role: "channel",
      description: this._controller._library.getNode("playing").description
    });
    this._controller._library.set({
      node: this.prefix,
      role: "channel",
      description: `Player ${this.config.title}`
    });
    this._controller._adapter.log.debug(
      `Create player with prefix "${this.prefix}", localAddress "${this.address || "no ip"}" and port "${this.port || "no port"}"`
    );
    this._controller._adapter.setTimeout(() => {
      this.setControls();
      this.startUpdater();
    }, 400);
  }
  setNotificationData(data) {
    if (data && typeof data === "object") {
      for (const d in data.Player) {
        if (data.Player[d] === "undefined") {
          delete data.Player[d];
        }
      }
      this.updateStates(this.cleanUpConfig(data.Player));
      data = this.cleanUpMetadata(data);
      if (!this.refreshDetails) {
        const playSwitch = data.event && ["media.play", "media.resume"].includes(data.event) || false;
        const actions = { play_switch: playSwitch };
        Object.keys(actions).forEach((key) => {
          var _a, _b;
          const node = (_b = (_a = this._controller._playerdetails.playerDetails) == null ? void 0 : _a.action) == null ? void 0 : _b[key];
          if (node) {
            let val = this._controller._library.convertToType(this.details[key], node.type);
            val = node.values !== void 0 ? node.values.includes(val) : val;
            if (!node.notDetails) {
              this.details[key] = val;
            }
            this._controller._library.confirmNode({ node: `${this.prefix}._Controls.${node.node}` }, val);
          }
        });
      }
      for (const key in data) {
        this._controller._library.readData(`${this.prefix}.${key}`, data[key], this.prefix);
      }
      if (!this.config.controllable) {
        this.setControls();
      }
      this.startUpdater();
    }
  }
  cleanUpMetadata(data, ca = false) {
    data = ca && { Metadata: data } || data;
    delete data.Player;
    if (data.Metadata) {
      if (data.Metadata.stream) {
        delete data.Metadata.stream.player;
      }
      if (!this._controller._adapter.config.getMetadataTrees) {
        delete data.Metadata.Media;
      }
    }
    return ca && data.Metadata || data;
  }
  setClientData(data) {
    if (data && typeof data === "object") {
      this._controller._adapter.log.debug(
        `setClientData ${this.prefix}: addr=${data.address || "?"}:${data.port || "?"} product=${data.product || "?"} state=${data.state || "?"} caps=${data.protocolCapabilities || "?"} sources=${data._sources && data._sources.join("+") || "?"}`
      );
      if (Array.isArray(data._sources)) {
        this.sources = data._sources.slice();
      }
      if (typeof data._provides === "string") {
        this.provides = data._provides;
      }
      this.cleanUpConfig(data);
      this.config.connected = true;
      this.updateStates(data);
      if (!this.config.controllable) {
        this.setControls();
      }
      this.startUpdater();
    }
  }
  cleanUpConfig(config) {
    const o = { config };
    this.config.uuid = o.config.machineIdentifier || config.uuid || this.config.uuid;
    this.config.title = o.config.title || o.config.name || this.config.title;
    if (o.config.address === "127.0.0.1") {
      o.config.address = 0;
    }
    this.address = o.config.address || this.address || this.config.localAddress || "";
    this.port = o.config.port || this.config.port || this.port;
    this.config.port = this.port;
    this.config.publicAddress = o.config.remotePublicAddress || o.config.publicAddress || this.config.publicAddress;
    ["address", "machineIdentifier", "remotePublicAddress", "name", "config", "_sources", "_provides"].forEach(
      (key) => delete o.config[key]
    );
    Object.assign(this.config, o.config);
  }
  updateStates(data) {
    if (data) {
      Object.assign(this.config, data);
    }
    this.address = this.address || this.config.localAddress || "";
    this._controller._library.set(
      {
        node: `${this.prefix}.Player.localAddress`,
        ...this._controller._library.getNode("playing.player.localaddress")
      },
      this.address
    );
    this._controller._library.readData(`${this.prefix}.Player`, this.config, `${this.prefix}`, void 0);
  }
  delete() {
    this.unload = true;
    this._controller._library.runGarbageCollector(this.prefix, true, 1, Controller.garbageExcluded);
    if (this.refreshTimeout) {
      this._controller._adapter.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.config.connected = false;
    if (this.lyric) {
      this.lyric.delete();
    }
  }
  startUpdater() {
    if (!this.refreshDetails || this._controller.noRefresh || !this.config.controllable) {
      return;
    }
    if (this.sources.length > 0 && !this.sources.includes("/clients")) {
      return;
    }
    if (this.updateTrys > 0) {
      this.updateTrys = 1;
      return;
    }
    this.updateTrys++;
    this.details = this.details || {};
    this._controller._library.set(
      { ...this._controller._library.getNode("playing.player.details"), node: `${this.prefix}.Player.details` },
      void 0
    );
    this._controller._library.set(
      {
        ...this._controller._library.getNode("playing.player.details.video"),
        node: `${this.prefix}.Player.details.video`
      },
      void 0
    );
    this._controller._library.set(
      {
        ...this._controller._library.getNode("playing.player.details.music"),
        node: `${this.prefix}.Player.details.music`
      },
      void 0
    );
    this._controller._library.set(
      {
        ...this._controller._library.getNode("playing.player.details.photo"),
        node: `${this.prefix}.Player.details.photo`
      },
      void 0
    );
    this._controller._adapter.log.debug(
      `Start getting client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`
    );
    if (this.refreshTimeout) {
      return;
    }
    this._updater = async () => {
      try {
        if (!this.refreshDetails || this.unload || this._controller.noRefresh) {
          return;
        }
        await this.updateTimeline();
        if (this.details.state == "stopped" || this.unload) {
          throw new Error("stop");
        }
        this.updateTrys = 1;
        this.latelyActionCall = "";
      } catch (error) {
        this.latelyActionCall = "";
        if ((error == null ? void 0 : error.message) != "timeout" && (error == null ? void 0 : error.message) != "stop") {
          this._controller._adapter.log.error(`Error 114: ${error == null ? void 0 : error.message} `);
          this.refreshTimeout = null;
          return;
        }
        if (this.updateTrys++ > 2) {
          this.updateTrys = 0;
          this.updateStates();
          if ((error == null ? void 0 : error.message) == "timeout") {
            this._controller._adapter.log.info(`Player ${this.getReadableID()} is disconnected`);
          } else if ((error == null ? void 0 : error.message) == "stop") {
            this._controller._adapter.log.debug(
              `Stop getting client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`
            );
          }
          this.refreshTimeout = null;
          return;
        }
      }
      if (this._updater) {
        this.refreshTimeout = this._controller._adapter.setTimeout(this._updater, this.refresh * 1e3);
      }
    };
    this.refreshTimeout = this._controller._adapter.setTimeout(this._updater, 300);
  }
  async updateTimeline() {
    var _a;
    if (!this.config.controllable) {
      return;
    }
    const saveValues = { state: this.details.state, type: this.details.type, metadata: this.details.key };
    const path = `/player/timeline/poll?wait=0&commandID=${this.commandID++}`;
    this.details = {
      ...this.details,
      state: "stopped",
      type: "none",
      time: 0,
      duration: 0,
      location: "none",
      url: "",
      percent: 0
    };
    this.config.connected = false;
    try {
      const data = await this._controller.plex.query(path, {
        headers: this.PLEX_HEADERS,
        timeout: 3e3
      });
      try {
        this.config.connected = true;
        const container = data && data.MediaContainer || {};
        this.details.location = container.location || "none";
        let timelines = container.Timeline || [];
        for (const t of timelines) {
          for (const a of [
            "address",
            "containerKey",
            "guid",
            "machineIdentifier",
            "audioStreamID",
            "videoStreamID"
          ]) {
            delete t[a];
          }
          this.details[t.type] = t;
        }
        timelines = timelines.filter((a) => a.state != "stopped");
        if (timelines.length == 0) {
          this.details.type = "all";
        } else {
          timelines = timelines.sort((a, b) => {
            const def = { photo: 1, musik: 2, video: 3 };
            return def[a.type] - def[b.type];
          });
          for (const k in this.details) {
            delete this.details[k].type;
            const d = this.details[k];
            if (typeof d != "object") {
              continue;
            }
            if (d.state == "stopped" || k == "photo") {
              continue;
            }
            this.details.time = d.time || 0;
            this.details.duration = d.duration || 0;
            this.details.type = k;
            this.details.state = d.state;
            this.details.key = d.key;
            this.details.volume = d.volume || 0;
            this.details.shuffle = d.shuffle != 0 || false;
            this.details.repeat = d.repeat || 0;
            this.details.percent = this.details.duration ? Math.floor(this.details.time / this.details.duration * 100) : 0;
            break;
          }
          if (this.details.type == "music") {
            if (((_a = this.details.music) == null ? void 0 : _a.state) === "playing" && this.lyric) {
              this.lyric.updateTime(this.details.time);
            }
          } else {
            if (this.lyric) {
              this.lyric.stop();
            }
          }
          Object.keys(this.details).forEach((key) => {
            var _a2;
            if (typeof this.details[key] == "object") {
              return;
            }
            for (const mode in this._controller._playerdetails.playerDetails) {
              const node = (_a2 = this._controller._playerdetails.playerDetails[mode]) == null ? void 0 : _a2[key];
              if (node) {
                let val = this.details[key];
                val = node.values !== void 0 ? node.values.indexOf(val) > -1 : val;
                val = node && node.type && this._controller._library.convertToType(val, node.type);
                if (!node.notDetails) {
                  this.details[key] = val;
                }
                if (this.latelyActionCall != node.node) {
                  this._controller._library.confirmNode(
                    { node: this.prefix + (mode == "action" ? "._Controls." : ".") + node.node },
                    val
                  );
                }
              }
            }
          });
        }
        this._controller._library.readData(
          `${this.prefix}.Player.details`,
          this.details,
          `${this.prefix}`,
          void 0,
          true
        );
      } catch (err) {
        this._controller._adapter.log.debug(`catch() 121: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (error) {
      if ((error == null ? void 0 : error.code) === "ECONNABORTED") {
        throw new Error("timeout");
      } else if ((error == null ? void 0 : error.code) === "ECONNRESET") {
        this._controller._adapter.log.debug(
          `catch() 122 no problem when player is gone: ${JSON.stringify(error.toJSON ? error.toJSON() : String(error))}`
        );
        throw new Error("timeout");
      } else {
        this._controller._adapter.log.debug(
          `catch() 122: ${JSON.stringify((error == null ? void 0 : error.toJSON) ? error.toJSON() : String(error))}`
        );
        throw new Error("timeout");
      }
    }
    try {
      if (saveValues.metadata != this.details.key || saveValues.state == "stopped" && saveValues.state != this.details.state) {
        void this.getMetadataUpdate();
        let data = await this._controller._library.getItem(this.details.key);
        data = this.getMetadataSelection(data, this._controller._playerdetails.deepVal, "");
        for (const key in data) {
          const node = this._controller._library.getNode(`playing.${key}`, true);
          if (node && node.convert && node.convert.complex) {
            const complex = node.convert.complex;
            switch (complex.func) {
              case "lyric": {
                let dp = complex.data.split(".").slice(1).join(".");
                const keys = Object.keys(data);
                const index = keys.findIndex((i) => i.toLowerCase() == dp);
                if (index > -1) {
                  dp = keys[index];
                  if (data[key] && data[dp]) {
                    if (this.lyric) {
                      void this.lyric.updateData(
                        data[dp],
                        `${this.prefix}.${dp.split(".").slice(0, -1).join(".")}`
                      );
                    } else {
                      this.lyric = new Lyric(
                        this._controller._adapter,
                        this._controller._library,
                        data[dp],
                        `${this.prefix}.${dp.split(".").slice(0, -1).join(".")}`
                      );
                    }
                  }
                }
              }
            }
          }
          this._controller._library.readData(`${this.prefix}.${key}`, data[key], this.prefix);
        }
      }
    } catch (err) {
      this._controller._adapter.log.error(err instanceof Error ? err.message : String(err));
    }
  }
  getReadableID() {
    return `${this.config.title}-${this.config.uuid}`;
  }
  /**
   * Whether HTTP `/player/...` commands actually reach this device.
   *
   * Reverse-engineered from real Plex behavior (verified 2026-05-01):
   *   - `/clients` GDM clients (Plex Media Player, Plex Home Theater, older TVs) — yes,
   *     they host their own control endpoint.
   *   - Devices with `provides ∋ player|pubsub-player` (Apple TV, Plexamp Desktop, PHT)
   *     — yes, PMS proxies the HTTP command via Companion pubsub.
   *   - Devices with empty `provides` (Plex iOS, Plex Android, Plex Web) — **no**, HTTP
   *     command paths return 404 even with correct Target-Client-Identifier+commandID+type
   *     because PMS routes those exclusively through pubsub.plex.tv, which is undocumented.
   *
   * State updates still work for non-controllable devices via the WebSocket notifications
   * stream — they just can't be commanded.
   */
  isCompanionControllable() {
    if (this.sources.includes("/clients")) {
      return true;
    }
    const tokens = this.provides.split(",").map((s) => s.trim());
    return tokens.includes("player") || tokens.includes("pubsub-player");
  }
  setControls() {
    const controls = `${this.prefix}._Controls`;
    if (!this.config.protocolCapabilities) {
      return;
    }
    if (!this.isCompanionControllable()) {
      this.config.controllable = false;
      this._controller._library.set(
        {
          node: `${this.prefix}.Player.controllable`,
          ...this._controller._library.getNode("playing.player.controllable")
        },
        false
      );
      this._controller._adapter.log.debug(
        `setControls skipped for ${this.prefix}: not HTTP-controllable (provides="${this.provides}", sources=${this.sources.join("+") || "?"}); pruning _Controls subtree.`
      );
      void this._controller._adapter.delObjectAsync(controls, { recursive: true }).catch((err) => {
        const m = err instanceof Error ? err.message : String(err);
        if (!/Not exists/i.test(m)) {
          this._controller._adapter.log.debug(`prune _Controls failed for ${this.prefix}: ${m}`);
        }
      });
      return;
    }
    this.config.protocolCapabilities.split(",").forEach((mode) => {
      if (mode === "none") {
        return;
      }
      this._controller._library.set({
        node: controls,
        role: "channel",
        description: "Playback & Navigation Controls"
      });
      this.config.controllable = true;
      this.updateStates(null);
      if (this._controller._actions[mode] === void 0) {
        return;
      }
      this._controller._library.set({
        node: `${controls}.${mode}`,
        role: "channel",
        description: `${this._controller._library.ucFirst(mode)} Controls`
      });
      let button;
      for (const key in this._controller._actions[mode]) {
        const newVal = this._controller._actions[mode][key].default !== void 0 ? this._controller._actions[mode][key].default : false;
        button = typeof this._controller._actions[mode][key] == "string" ? { key, description: this._controller._actions[mode][key] } : this._controller._actions[mode][key];
        const common = this._controller._actions[mode][key].common || {};
        if (this._controller._library.getDeviceState(`${controls}.${mode}.${key}`) === null) {
          this._controller._library.set(
            {
              node: `${controls}.${mode}.${key}`,
              description: `${mode.slice(0, 1).toUpperCase() + mode.slice(1)} ${this._controller._library.ucFirst(button.description)}`,
              role: this._controller._actions[mode][key].role !== void 0 ? this._controller._actions[mode][key].role : this._controller._actions[mode][key].attribute !== void 0 || this._controller._actions[mode][key].default !== void 0 ? this._controller._actions[mode][key].values || Number.isInteger(this._controller._actions[mode][key].default) ? "value" : "text" : "button",
              type: this._controller._actions[mode][key].type !== void 0 ? this._controller._actions[mode][key].type : this._controller._actions[mode][key].attribute !== void 0 || this._controller._actions[mode][key].default !== void 0 ? this._controller._actions[mode][key].values || Number.isInteger(this._controller._actions[mode][key].default) ? "number" : "string" : "boolean",
              common: {
                ...common,
                write: true,
                read: true,
                states: this._controller._actions[mode][key].values
              }
            },
            newVal
          );
        }
      }
      this._controller._adapter.subscribeStates(`${controls}.${mode}.*`);
    });
  }
  /**
   * Executes a specified action on the player.
   *
   * @param actionVal The action details.
   */
  async action(actionVal) {
    if (!this.isCompanionControllable()) {
      this._controller._adapter.log.warn(
        `Ignoring ${actionVal.mode}.${actionVal.action} on ${this.getReadableID()}: device is Companion-only (provides="${this.provides}"). Plex iOS / Plex Android / Plex Web don't accept HTTP control via PMS \u2014 the only way to control them is from the Plex app itself.`
      );
      return;
    }
    if (this._controller._actions[actionVal.mode] !== void 0 && this._controller._actions[actionVal.mode][actionVal.action] !== void 0) {
      let attribute = void 0;
      this._controller._adapter.log.info(
        `Triggered action -${actionVal.action}- on player ${this.getReadableID()} (proxied via PMS).`
      );
      let newVal = actionVal.val;
      let key = this._controller._actions[actionVal.mode][actionVal.action].key || actionVal.action;
      if (this._controller._actions[actionVal.mode][actionVal.action].true !== void 0) {
        key = newVal ? this._controller._actions[actionVal.mode][actionVal.action].true : this._controller._actions[actionVal.mode][actionVal.action].false;
      }
      if (this._controller._actions[actionVal.mode][actionVal.action].convert !== void 0) {
        let json = null;
        switch (this._controller._actions[actionVal.mode][actionVal.action].convert) {
          case "percent":
            newVal = this.details !== void 0 && this.details.duration > 0 ? Math.floor(this.details.duration * newVal / 100) : 0;
            break;
          case "lastPlayed":
            attribute = `key=${this.details.key}&address=${this._controller._adapter.config.plexIp}&port=${this._controller._adapter.config.plexPort}&machineIdentifier=${this._controller.getServerId()}&offset=${this.details.time}&`;
            break;
          case "playKey":
            try {
              json = JSON.parse(newVal);
              if (json.key === void 0 || typeof json.key !== "string" || json.offset === void 0 || isNaN(json.offset)) {
                throw new Error("invalid value");
              }
            } catch {
              this._controller._adapter.log.error(
                `Error convert json of ${actionVal.id}.${actionVal.mode}.${actionVal.action} should be like {key: "/library/metadata/45156", offset: "123456"} but is ${newVal}!`
              );
              return;
            }
            attribute = `key=${json.key}&address=${this._controller._adapter.config.plexIp}&port=${this._controller._adapter.config.plexPort}&machineIdentifier=${this._controller.getServerId()}&offset=${json.offset}`;
            break;
        }
      }
      if (this._controller._actions[actionVal.mode][actionVal.action].saveToPlayer == void 0) {
        const fromPlex = this._controller._actions[actionVal.mode][actionVal.action].fromPlex;
        if (fromPlex !== void 0) {
          for (const a in fromPlex) {
            if (fromPlex[a] === newVal) {
              newVal = a;
            }
          }
        }
        attribute = attribute || this._controller._actions[actionVal.mode][actionVal.action].attribute && `${this._controller._actions[actionVal.mode][actionVal.action].attribute}=${newVal}&` || void 0;
        const mtypeRaw = this.details && this.details.type;
        const mtype = mtypeRaw === "video" || mtypeRaw === "music" || mtypeRaw === "photo" ? mtypeRaw : "video";
        const cid = `commandID=${this.commandID++}`;
        const attr = attribute != void 0 ? attribute : "";
        const sep = attr && !attr.endsWith("&") ? "&" : "";
        const path = `/player/${actionVal.mode}/${key}?${attr}${sep}type=${mtype}&${cid}`;
        try {
          this.latelyActionCall = `${actionVal.mode}.${actionVal.action}`;
          await this._controller.plex.query(path, { headers: this.PLEX_HEADERS });
          this.config.connected = true;
          this._controller._adapter.log.debug(
            `Successfully triggered ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}.`
          );
          this._controller._library.confirmNode(
            { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
            actionVal.val
          );
          this._controller._adapter.log.debug(`path: ${path}`);
        } catch (err) {
          this._controller._adapter.log.warn(
            `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}! See debug log for details.`
          );
          const dbg = err instanceof Error ? err.message : String(err);
          this._controller._adapter.log.debug(`catch() 133: ${dbg}`);
          this._controller._adapter.log.debug(`path: ${path}`);
          this.latelyActionCall = "";
        }
      } else {
        this[this._controller._actions[actionVal.mode][actionVal.action].key] = newVal;
        this.startUpdater();
        this._controller._library.confirmNode(
          { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
          actionVal.val
        );
      }
    } else {
      this._controller._adapter.log.warn(
        `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}! Action not supported!`
      );
    }
  }
  getMetadataSelection(data, list, k = "", lastData = {}) {
    if (!data || typeof data !== "object") {
      return {};
    }
    const def = JSON.parse(JSON.stringify(list));
    let result = {};
    result = _findData(data, def, k, lastData);
    const res = {};
    for (const key in result) {
      for (const a in result[key]) {
        for (const n in result[key][a]) {
          const newkey = n.replace(".track.", ".Music.");
          res[newkey] = result[key][a][n];
        }
      }
    }
    return res;
    function _findData(data2, list2, k2 = "", lastData2 = {}) {
      if (typeof data2 === "object") {
        if (Array.isArray(data2)) {
          data2.forEach((item) => _findData(item, list2, k2, data2));
        } else {
          Object.keys(data2).forEach((key) => _findData(data2[key], list2, k2 ? `${k2}.${key}` : key, data2));
        }
      } else {
        if (list2[k2] !== void 0) {
          list2[k2].forEach((l) => {
            if (l.value && l.value != data2) {
              return;
            }
            if (l.nodes) {
              const res2 = {};
              l.nodes.forEach((n) => {
                res2[l.node + n.node] = lastData2[n.key];
              });
              result[l.node] = result[l.node] || [];
              result[l.node].push(res2);
            } else if (l.call) {
              const nl = {};
              Object.keys(l.call).forEach((n) => {
                nl[n] = nl[n] || [];
                l.call[n].forEach((m) => {
                  nl[n].push({
                    node: `${l.node}${l.valueAsKey ? `.${data2}` : ""}${m.node}`,
                    app: m.app
                  });
                });
              });
              _findData(lastData2, nl, k2.split(".").slice(0, -1).join("."));
            } else if (l.node) {
              const newKey = l.node + (l.app ? l.app : "");
              result[l.node] = result[l.node] || [];
              const res2 = {};
              res2[newKey] = data2;
              result[l.node].push(res2);
            }
          });
        }
      }
      return result;
    }
  }
  async getMetadataUpdate() {
    try {
      const sessions = await this._controller._library.getItem("/status/sessions");
      if (!sessions || !sessions.Metadata) {
        return;
      }
      for (let s of sessions.Metadata) {
        if (s.Player.machineIdentifier === this.config.uuid) {
          this.cleanUpConfig(s.Player);
          s = this.cleanUpMetadata(s, true);
          if (s.Player && s.Player.state) {
            delete s.Player.state;
          }
          this.media = s.Media;
          s.media = void 0;
          this._controller._library.readData(`${this.prefix}.Metadata`, s, `${this.prefix}`, void 0);
        }
      }
    } catch (err) {
      this._controller._adapter.log.debug(`Error 124: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
class Lyric {
  _adapter;
  _library;
  prefix;
  key;
  lyric = [];
  fullText = [];
  unload = false;
  stopped = false;
  time = 0;
  lasttext = "";
  noTimes = false;
  updaterRef = void 0;
  updater = () => {
  };
  constructor(adapter, library, key, prefix) {
    this._adapter = adapter;
    this._library = library;
    this.prefix = prefix;
    this.key = key;
    void this.updateData(this.key, this.prefix);
  }
  updateTime(ms) {
    this.time = Date.now() - ms;
    if (this.updaterRef) {
      return;
    }
    this.lasttext = "";
    this.updater = () => {
      if (this.unload || this.stopped) {
        this.updaterRef = null;
        return;
      }
      const elapsed = this.time ? Date.now() - this.time : 1e3;
      const result = this.lyric.filter((l) => l.startOffset <= elapsed && l.endOffset >= elapsed) || [];
      const texts = [];
      for (const r of result) {
        texts.push(r.text);
      }
      const newtext = texts.join(" - ") || "";
      if (this.lasttext !== newtext) {
        this.lasttext = newtext;
        this._library.set(
          {
            node: `${this.prefix}.currentText`,
            role: "text",
            type: "string",
            description: "Lyrics currently being played"
          },
          this.lasttext
        );
      }
      this.updaterRef = this._adapter.setTimeout(this.updater, 100);
    };
  }
  stop() {
    this.stopped = true;
    if (this.updaterRef) {
      this._adapter.clearTimeout(this.updaterRef);
    }
    this.updaterRef = null;
    this._library.set(
      {
        node: `${this.prefix}.currentText`,
        role: "text",
        type: "string",
        description: "Lyrics currently being played"
      },
      ""
    );
  }
  delete() {
    this.unload = true;
    this.stop();
  }
  async updateData(key, prefix) {
    this.key = key;
    this.prefix = prefix;
    this.stopped = false;
    if (this.key && this.prefix) {
      this.lyric = [];
      this.fullText = [];
      try {
        const options = {
          ...this._library.AXIOS_OPTIONS,
          method: "GET",
          url: `http://${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${key}?X-Plex-Token=${this._adapter.config.plexToken}`,
          Accept: "application/xml"
        };
        this._adapter.log.debug(`${options.url}`);
        const result = await (0, import_axios.default)(options);
        if (result) {
          const templyric = result.data.MediaContainer && result.data.MediaContainer.Lyrics && result.data.MediaContainer.Lyrics[0] && result.data.MediaContainer.Lyrics[0].Line || [];
          let counter = 0;
          this.noTimes = false;
          for (let c = 0; c < templyric.length; c++) {
            const o = templyric[c];
            if (!o.Span) {
              if (++counter > 1) {
                break;
              }
              continue;
            }
            if (o.Span[0]) {
              this.lyric.push(o.Span[0]);
              if (o.Span[0].text) {
                this.fullText.push(o.Span[0].text);
              }
              if (o.Span[0].startOffset) {
                this.noTimes = true;
              }
            }
            counter = 0;
          }
          this._library.set(
            {
              node: `${this.prefix}.fullText`,
              role: "json",
              type: "json",
              description: "Complete lyrics currently being played as an array"
            },
            JSON.stringify(this.fullText)
          );
          this._library.set(
            {
              node: `${this.prefix}.currentText`,
              role: "text",
              type: "string",
              description: "Lyrics currently being played"
            },
            ""
          );
          this._adapter.log.debug(`Lyric: ${JSON.stringify(this.lyric)}`);
        }
      } catch (error) {
        this._adapter.log.debug(
          `Error(141) ${error instanceof Error && error.message ? error.message : String(error)}`
        );
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Controller,
  Player
});
//# sourceMappingURL=players.js.map
