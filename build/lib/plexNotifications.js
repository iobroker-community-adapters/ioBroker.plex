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
var plexNotifications_exports = {};
__export(plexNotifications_exports, {
  PlexNotifications: () => PlexNotifications
});
module.exports = __toCommonJS(plexNotifications_exports);
var import_ws = __toESM(require("ws"));
const WS_PATH = "/:/websockets/notifications";
const RECONNECT_DELAYS_MS = [1e3, 2e3, 5e3, 15e3, 3e4];
const IDLE_TIMEOUT_MS = 5 * 6e4;
class PlexNotifications {
  opts;
  ws;
  reconnectAttempt = 0;
  reconnectTimer;
  idleTimer;
  framesSeen = 0;
  stopped = false;
  onEvent = () => {
  };
  constructor(opts) {
    this.opts = opts;
  }
  setHandler(handler) {
    this.onEvent = handler;
  }
  start() {
    this.stopped = false;
    this.connect();
  }
  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = void 0;
    }
    this.clearIdleTimer();
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
      }
      this.ws = void 0;
    }
  }
  buildUrl() {
    const proto = this.opts.https ? "wss" : "ws";
    return `${proto}://${this.opts.hostname}:${this.opts.port}${WS_PATH}?X-Plex-Token=${encodeURIComponent(this.opts.token)}`;
  }
  connect() {
    if (this.stopped) {
      return;
    }
    const url = this.buildUrl();
    this.opts.log.debug(`PlexNotifications: connecting to ${url.replace(this.opts.token, "***")}`);
    try {
      this.ws = new import_ws.default(url, {
        rejectUnauthorized: this.opts.rejectUnauthorized === true,
        handshakeTimeout: 1e4,
        headers: {
          "X-Plex-Token": this.opts.token,
          ...this.opts.headers || {}
        }
      });
    } catch (err) {
      this.opts.log.warn(
        `PlexNotifications: connect threw \u2014 ${err instanceof Error ? err.message : String(err)}`
      );
      this.scheduleReconnect();
      return;
    }
    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.framesSeen = 0;
      this.opts.log.info("PlexNotifications: WebSocket connection established.");
      this.armIdleTimer();
    });
    this.ws.on("message", (raw) => this.handleMessage(raw));
    this.ws.on("error", (err) => {
      this.opts.log.debug(`PlexNotifications: WebSocket error \u2014 ${err.message}`);
    });
    this.ws.on("close", (code, reason) => {
      this.clearIdleTimer();
      const reasonStr = reason && reason.length ? reason.toString() : "";
      this.opts.log.debug(
        `PlexNotifications: WebSocket closed (code=${code}, reason="${reasonStr}", framesSeen=${this.framesSeen})`
      );
      this.ws = void 0;
      this.scheduleReconnect();
    });
  }
  handleMessage(raw) {
    let text;
    if (typeof raw === "string") {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString("utf8");
    } else if (Array.isArray(raw)) {
      text = Buffer.concat(raw).toString("utf8");
    } else {
      text = Buffer.from(raw).toString("utf8");
    }
    if (!text) {
      return;
    }
    this.framesSeen++;
    this.armIdleTimer();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.opts.log.debug(`PlexNotifications: non-JSON frame ignored (${text.length} bytes)`);
      return;
    }
    const container = parsed && parsed.NotificationContainer;
    if (!container || typeof container.type !== "string") {
      return;
    }
    const type = container.type;
    if (this.framesSeen <= 5 || type === "playing" || type === "status") {
      this.opts.log.debug(`PlexNotifications: frame #${this.framesSeen} type=${type}`);
    }
    let payload;
    switch (type) {
      case "playing":
        payload = container.PlaySessionStateNotification;
        break;
      case "activity":
        payload = container.ActivityNotification;
        break;
      case "progress":
        payload = container.ProgressNotification;
        break;
      case "transcodeSession.start":
      case "transcodeSession.update":
      case "transcodeSession.end":
        payload = container.TranscodeSession;
        break;
      case "status":
        payload = container.StatusNotification;
        break;
      case "library.update":
        payload = container.LibraryUpdateNotification;
        break;
      case "timeline":
        payload = container.TimelineEntry;
        break;
      default:
        payload = container;
    }
    try {
      this.onEvent({ type, payload });
    } catch (err) {
      this.opts.log.warn(
        `PlexNotifications: handler threw on type=${type} \u2014 ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * (Re-)arm the idle timer: if no frame arrives within `IDLE_TIMEOUT_MS`, terminate
   * the socket and let the reconnect path take over. Plex pushes status/activity
   * frames frequently enough at idle that 5min silence reliably means a dead socket.
   */
  armIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.opts.log.debug(
        `PlexNotifications: idle timeout (${IDLE_TIMEOUT_MS / 1e3}s without frame), forcing reconnect`
      );
      if (this.ws) {
        try {
          this.ws.terminate();
        } catch {
        }
      }
    }, IDLE_TIMEOUT_MS);
  }
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = void 0;
    }
  }
  scheduleReconnect() {
    if (this.stopped) {
      return;
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;
    this.opts.log.debug(`PlexNotifications: reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = void 0;
      this.connect();
    }, delay);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PlexNotifications
});
//# sourceMappingURL=plexNotifications.js.map
