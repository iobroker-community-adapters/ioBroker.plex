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
var plexHttp_exports = {};
__export(plexHttp_exports, {
  PlexHttp: () => PlexHttp
});
module.exports = __toCommonJS(plexHttp_exports);
var import_axios = __toESM(require("axios"));
var https = __toESM(require("node:https"));
const PLEX_DEFAULT_PORT = 32400;
const PLEX_TV_RESOURCES_URL = "https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1";
const PLEX_TV_DEVICES_URL = "https://plex.tv/devices.xml";
const NETWORK_ERROR_CODES = [
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNABORTED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH"
];
function isErrorWithCode(err) {
  return typeof err === "object" && err !== null;
}
function isNetworkErrorCode(code) {
  return code !== void 0 && NETWORK_ERROR_CODES.includes(code);
}
function makeCodedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
function makeStatusError(status, text) {
  const e = new Error(`Plex Server responded with HTTP ${status} (${text})`);
  e.statusCode = status;
  return e;
}
function normalizeError(err) {
  if (!err) {
    return new Error("Unknown error");
  }
  if (isErrorWithCode(err)) {
    const code = err.code;
    if (isNetworkErrorCode(code)) {
      return makeCodedError(code, `${code}: ${err.message || code}`);
    }
    if (code === "ERR_CANCELED") {
      return makeCodedError("ETIMEDOUT", "ETIMEDOUT: request canceled");
    }
    if (code === "ERR_NETWORK") {
      return makeCodedError("ECONNREFUSED", `ECONNREFUSED: ${err.message || "network error"}`);
    }
  }
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === "string" || typeof err === "number" || typeof err === "boolean") {
    return new Error(String(err));
  }
  return new Error("Unknown error");
}
function statusText(code) {
  if (code === 401) {
    return "Unauthorized";
  }
  if (code === 403) {
    return "Forbidden";
  }
  if (code === 404) {
    return "Not Found";
  }
  if (code === 500) {
    return "Internal Server Error";
  }
  if (code === 502) {
    return "Bad Gateway";
  }
  if (code === 503) {
    return "Service Unavailable";
  }
  if (code === 504) {
    return "Gateway Timeout";
  }
  return "";
}
class PlexHttp {
  hostname;
  port;
  https;
  token;
  timeout;
  plexHeaders;
  requestOptions;
  httpsAgent;
  constructor(opts) {
    this.hostname = opts.hostname;
    this.port = opts.port || PLEX_DEFAULT_PORT;
    this.https = opts.https === true || opts.https === void 0 && this.port === 443;
    this.token = opts.token;
    this.timeout = opts.timeout || 1e4;
    this.plexHeaders = this.buildPlexHeaders(opts.options || {});
    const reqOpts = { ...opts.requestOptions || {} };
    const cert = reqOpts.cert;
    const key = reqOpts.key;
    const ca = reqOpts.ca;
    const passphrase = reqOpts.passphrase;
    const rejectUnauthorized = reqOpts.rejectUnauthorized;
    delete reqOpts.cert;
    delete reqOpts.key;
    delete reqOpts.ca;
    delete reqOpts.passphrase;
    delete reqOpts.rejectUnauthorized;
    delete reqOpts.secureConnection;
    delete reqOpts._protocol;
    if (typeof reqOpts.timeout === "number") {
      this.timeout = reqOpts.timeout;
      delete reqOpts.timeout;
    }
    this.requestOptions = reqOpts;
    if (this.https) {
      const agentOpts = { rejectUnauthorized: rejectUnauthorized === true };
      if (cert) {
        agentOpts.cert = cert;
      }
      if (key) {
        agentOpts.key = key;
      }
      if (ca) {
        agentOpts.ca = ca;
      }
      if (passphrase) {
        agentOpts.passphrase = passphrase;
      }
      this.httpsAgent = new https.Agent(agentOpts);
    }
    if (typeof this.hostname !== "string" || this.hostname === "") {
      throw new TypeError("Invalid Plex Server hostname");
    }
  }
  buildPlexHeaders(o) {
    const h = {
      // python-plexapi sends X-Plex-Provides on every request; "controller" tells Plex
      // we control players but don't expose one ourselves.
      "X-Plex-Provides": "controller"
    };
    if (o.identifier) {
      h["X-Plex-Client-Identifier"] = o.identifier;
    }
    if (o.product) {
      h["X-Plex-Product"] = o.product;
    }
    if (o.version) {
      h["X-Plex-Version"] = o.version;
    }
    if (o.deviceName) {
      h["X-Plex-Device-Name"] = o.deviceName;
    }
    if (o.platform) {
      h["X-Plex-Platform"] = o.platform;
    }
    if (o.platformVersion) {
      h["X-Plex-Platform-Version"] = o.platformVersion;
    }
    if (o.device) {
      h["X-Plex-Device"] = o.device;
    }
    if (o.language) {
      h["X-Plex-Language"] = o.language;
    }
    return h;
  }
  buildUrl(path) {
    const proto = this.https ? "https" : "http";
    return `${proto}://${this.hostname}:${this.port}${path}`;
  }
  buildHeaders(extra) {
    const h = {
      Accept: "application/json",
      ...this.plexHeaders,
      ...extra || {}
    };
    if (this.token) {
      h["X-Plex-Token"] = this.token;
    }
    return h;
  }
  /**
   * Perform an HTTP request against the Plex server and return the parsed JSON body.
   *
   * @param path Request path relative to the Plex server root (must start with `/`)
   * @param opts Optional request overrides (method, headers, data)
   */
  async query(path, opts) {
    var _a;
    const merged = opts || {};
    const config = {
      ...this.requestOptions,
      method: merged.method || "GET",
      url: this.buildUrl(path),
      headers: this.buildHeaders(merged.headers),
      timeout: (_a = merged.timeout) != null ? _a : this.timeout,
      responseType: "json",
      validateStatus: null
    };
    if (this.httpsAgent) {
      config.httpsAgent = this.httpsAgent;
    }
    if (merged.data !== void 0) {
      config.data = merged.data;
    }
    let response;
    try {
      response = await (0, import_axios.default)(config);
    } catch (err) {
      throw normalizeError(err);
    }
    if (response.status < 200 || response.status > 299) {
      throw makeStatusError(response.status, statusText(response.status));
    }
    return response.data;
  }
  /**
   * Fetch the user's resources (servers + clients) from plex.tv. Used for player
   * discovery — `/clients` on the local PMS is GDM-only and returns size:0 for
   * modern Plex apps (Plexamp, mobile, newer TVs), so plex.tv is the canonical source.
   *
   * On 401/403 throws a coded error `PLEX_TV_UNAUTHORIZED` so callers can fall back to
   * PMS-only discovery without crashing the adapter.
   *
   * @param token X-Plex-Token of the account whose resources to enumerate.
   */
  async fetchPlexTvResources(token) {
    if (!token) {
      throw makeCodedError("PLEX_TV_UNAUTHORIZED", "plex.tv token is empty");
    }
    let response;
    try {
      response = await (0, import_axios.default)({
        method: "GET",
        url: PLEX_TV_RESOURCES_URL,
        headers: {
          Accept: "application/json",
          ...this.plexHeaders,
          "X-Plex-Token": token
        },
        timeout: this.timeout,
        responseType: "json",
        validateStatus: null
      });
    } catch (err) {
      throw normalizeError(err);
    }
    if (response.status === 401 || response.status === 403) {
      throw makeCodedError(
        "PLEX_TV_UNAUTHORIZED",
        `plex.tv rejected token (HTTP ${response.status}). Discovery falls back to PMS endpoints.`
      );
    }
    if (response.status < 200 || response.status > 299) {
      throw makeStatusError(response.status, statusText(response.status));
    }
    const data = response.data;
    if (!Array.isArray(data)) {
      return [];
    }
    return data;
  }
  /**
   * Fetch ALL account-attached devices from plex.tv — including Companion-only apps
   * (Plex iOS/Android, Plexamp, PlexHTPC) that don't appear in /api/v2/resources.
   * The legacy `/devices.xml` endpoint is what python-plexapi's `MyPlexAccount.devices()`
   * uses; it's the only Plex.tv source that lists Companion players.
   *
   * Returns minimal device descriptors normalized to a JSON shape regardless of whether
   * Plex responds with JSON or XML (defensive — Plex sometimes ignores Accept header).
   *
   * Throws `PLEX_TV_UNAUTHORIZED` on 401/403, mirroring `fetchPlexTvResources()`.
   *
   * @param token X-Plex-Token of the account whose devices to enumerate.
   */
  async fetchPlexTvDevices(token) {
    var _a;
    if (!token) {
      throw makeCodedError("PLEX_TV_UNAUTHORIZED", "plex.tv token is empty");
    }
    let response;
    try {
      response = await (0, import_axios.default)({
        method: "GET",
        url: PLEX_TV_DEVICES_URL,
        headers: {
          Accept: "application/json",
          ...this.plexHeaders,
          "X-Plex-Token": token
        },
        timeout: this.timeout,
        responseType: "text",
        validateStatus: null,
        transformResponse: [(d) => d]
      });
    } catch (err) {
      throw normalizeError(err);
    }
    if (response.status === 401 || response.status === 403) {
      throw makeCodedError(
        "PLEX_TV_UNAUTHORIZED",
        `plex.tv rejected token (HTTP ${response.status}) at /devices.xml.`
      );
    }
    if (response.status < 200 || response.status > 299) {
      throw makeStatusError(response.status, statusText(response.status));
    }
    const body = typeof response.data === "string" ? response.data : "";
    const ct = (typeof ((_a = response.headers) == null ? void 0 : _a["content-type"]) === "string" ? response.headers["content-type"] : "").toLowerCase();
    if (ct.includes("json") && body.trim().startsWith("{")) {
      return parseDevicesJson(body);
    }
    return parseDevicesXml(body);
  }
}
function parseDevicesJson(body) {
  try {
    const parsed = JSON.parse(body);
    const mc = parsed && parsed.MediaContainer;
    const list = mc && mc.Device || [];
    if (!Array.isArray(list)) {
      return [];
    }
    return list.map((d) => normalizeDevice(d));
  } catch {
    return [];
  }
}
function parseDevicesXml(body) {
  const result = [];
  const deviceRe = /<Device\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Device>)/g;
  const attrRe = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
  const connRe = /<Connection\b([^>]*?)\/>/g;
  let m;
  while ((m = deviceRe.exec(body)) !== null) {
    const attrs = {};
    let am;
    while ((am = attrRe.exec(m[1])) !== null) {
      attrs[am[1]] = am[2];
    }
    const inner = m[2] || "";
    const connections = [];
    let cm;
    while ((cm = connRe.exec(inner)) !== null) {
      const cAttrs = {};
      let cam;
      while ((cam = attrRe.exec(cm[1])) !== null) {
        cAttrs[cam[1]] = cam[2];
      }
      connections.push(cAttrs);
    }
    result.push(normalizeDevice({ ...attrs, Connection: connections }));
  }
  return result;
}
function normalizeDevice(d) {
  const conns = Array.isArray(d.Connection) ? d.Connection : [];
  return {
    clientIdentifier: typeof d.clientIdentifier === "string" ? d.clientIdentifier : "",
    name: typeof d.name === "string" ? d.name : void 0,
    product: typeof d.product === "string" ? d.product : void 0,
    productVersion: typeof d.productVersion === "string" ? d.productVersion : void 0,
    platform: typeof d.platform === "string" ? d.platform : void 0,
    platformVersion: typeof d.platformVersion === "string" ? d.platformVersion : void 0,
    device: typeof d.device === "string" ? d.device : void 0,
    model: typeof d.model === "string" ? d.model : void 0,
    vendor: typeof d.vendor === "string" ? d.vendor : void 0,
    provides: typeof d.provides === "string" ? d.provides : "",
    publicAddress: typeof d.publicAddress === "string" ? d.publicAddress : void 0,
    lastSeenAt: typeof d.lastSeenAt === "string" ? d.lastSeenAt : void 0,
    connections: conns.map((c) => ({
      uri: typeof c.uri === "string" ? c.uri : "",
      address: typeof c.address === "string" ? c.address : void 0,
      port: c.port !== void 0 ? Number(c.port) : void 0,
      protocol: typeof c.protocol === "string" ? c.protocol : void 0,
      local: c.local === "1" || c.local === 1 || c.local === true
    }))
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PlexHttp
});
//# sourceMappingURL=plexHttp.js.map
