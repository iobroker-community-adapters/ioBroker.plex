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
var plexPinAuth_exports = {};
__export(plexPinAuth_exports, {
  PlexPinAuth: () => PlexPinAuth
});
module.exports = __toCommonJS(plexPinAuth_exports);
var import_axios = __toESM(require("axios"));
const PLEX_TV_BASE = "https://plex.tv/api/v2";
const TOKEN_CACHE_MAX = 50;
const HEADER_MAP = {
  "X-Plex-Client-Identifier": "identifier",
  "X-Plex-Product": "product",
  "X-Plex-Version": "version",
  "X-Plex-Device": "device",
  "X-Plex-Device-Name": "deviceName",
  "X-Plex-Platform": "platform",
  "X-Plex-Platform-Version": "platformVersion",
  "X-Plex-Language": "language"
};
class PlexPinAuth {
  headers;
  tokens = /* @__PURE__ */ new Map();
  constructor(options) {
    this.headers = this.buildHeaders(options || {});
  }
  buildHeaders(options) {
    const h = {
      Accept: "application/json",
      "X-Plex-Provides": "controller"
    };
    for (const key of Object.keys(HEADER_MAP)) {
      const optKey = HEADER_MAP[key];
      const val = options[optKey];
      if (val) {
        h[key] = val;
      }
    }
    return h;
  }
  /**
   * Request a new PIN from plex.tv. The response includes the numeric `id`
   * and the user-visible 4-character `code` displayed at https://plex.tv/link.
   */
  async getPin() {
    const res = await import_axios.default.post(`${PLEX_TV_BASE}/pins`, null, {
      headers: this.headers,
      timeout: 1e4,
      responseType: "json"
    });
    return {
      ...res.data,
      token: null,
      status: "RETRIEVED_CODE"
    };
  }
  /**
   * Poll plex.tv to check whether the user has linked the PIN. Returns a
   * cached token if one was already retrieved for this PIN id.
   *
   * @param pinId The numeric id of a previously-issued PIN
   */
  async getToken(pinId) {
    const cached = this.tokens.get(pinId);
    if (cached) {
      const cachedExp = cached.expiresAt ? Date.parse(cached.expiresAt) : NaN;
      const cachedExpired = !isNaN(cachedExp) && Date.now() >= cachedExp;
      if (!cachedExpired) {
        return {
          token: true,
          status: "RETRIEVED_TOKEN",
          auth_token: cached.authToken
        };
      }
      this.tokens.delete(pinId);
    }
    const res = await import_axios.default.get(`${PLEX_TV_BASE}/pins/${pinId}`, {
      headers: this.headers,
      timeout: 1e4,
      responseType: "json"
    });
    const pin = res.data || {};
    const result = {
      ...pin,
      token: null,
      status: "RETRIEVING_TOKEN"
    };
    const exp = pin.expiresAt ? Date.parse(pin.expiresAt) : NaN;
    if (!isNaN(exp) && Date.now() >= exp) {
      result.token = false;
      result.status = "TIMEOUT_TOKEN";
    }
    if (pin.authToken) {
      result.token = true;
      result.status = "RETRIEVED_TOKEN";
      result.auth_token = pin.authToken;
      if (this.tokens.size >= TOKEN_CACHE_MAX) {
        const oldestKey = this.tokens.keys().next().value;
        if (oldestKey !== void 0) {
          this.tokens.delete(oldestKey);
        }
      }
      this.tokens.set(pinId, { authToken: pin.authToken, expiresAt: pin.expiresAt });
    }
    return result;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PlexPinAuth
});
//# sourceMappingURL=plexPinAuth.js.map
