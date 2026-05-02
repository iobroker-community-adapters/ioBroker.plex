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
var library_exports = {};
__export(library_exports, {
  Library: () => Library
});
module.exports = __toCommonJS(library_exports);
class Library {
  static get CONNECTION() {
    return {
      node: "info.connection",
      description: "Adapter Connection Status",
      role: "indicator.connected",
      type: "boolean"
    };
  }
  static garbageExcluded = [
    "Player.localAddress",
    "Player.port",
    "Player.protocolCapabilities",
    "Player.controllable"
  ];
  AXIOS_OPTIONS = {};
  _adapter;
  options;
  _plex;
  _nodes;
  _actions;
  _STATES = {};
  _SUBCSCRIPT_PLAYING = {};
  constructor(adapter, options = {}, plex) {
    this._adapter = adapter;
    this.options = options || {};
    this._plex = plex;
    this._nodes = this.options.nodes || {};
    this._actions = this.options.actions || {};
    this.options.updatesInLog = this.options.updatesInLog || false;
    this.options.updatesExceptions = this.options.updatesExceptions || [
      "timestamp",
      "datetime",
      "UTC",
      "localtime",
      "last_use_date",
      "lastSeen"
    ];
    void this.set({ node: "info", description: "Adapter Information", role: "channel" });
    void this.set(Library.CONNECTION, false);
    for (const a in this._nodes) {
      if (a != a.toLowerCase()) {
        this._adapter.log.warn(`${a} - ${a.toLowerCase()}`);
      }
    }
  }
  /**
   * Gets a node.
   *
   * @param node Node identifier
   * @param lowerCase Whether to convert the node identifier to lowercase
   */
  getNode(node, lowerCase = false) {
    const result = this._nodes[this.clean(node, lowerCase)] || this._nodes[this.clean(node.replace(RegExp(/\.\d+\./, "g"), "."), lowerCase)];
    return JSON.parse(
      JSON.stringify(
        result || {
          description: "(no description given)",
          role: "state",
          type: "string",
          convert: null,
          notExist: true
        }
      )
    );
  }
  /**
   * Terminate adapter.
   *
   * @param message Message to display
   * @param kill Whether to kill the adapter (red lights) or not (yellow lights)
   * @param reason Reason code for exit
   */
  terminate(message, kill, reason) {
    this.resetStates();
    void this.set(Library.CONNECTION, false);
    const msg = message ? message : "Terminating adapter due to error!";
    if (!kill) {
      this._adapter.log.warn(msg);
    } else if (kill === true) {
      this._adapter.log.error(msg);
      setTimeout(
        () => this._adapter && this._adapter.terminate ? this._adapter.terminate(msg, reason || 11) : process.exit(reason || 11),
        2e3
      );
    }
    return false;
  }
  /**
   * Remove special characters from string.
   *
   * @param string String to proceed
   * @param lowerCase If String shall be returned in lower case
   * @param n1 deprecated
   * @param n2 deprecated
   */
  clean(string, lowerCase = false, n1, n2) {
    if (!string && typeof string != "string") {
      return string;
    }
    if (n1 !== void 0 || n2 !== void 0) {
      this._adapter.log.warn("library error 101, please create a github issue");
    }
    const cleaned = string.replace(this._adapter.FORBIDDEN_CHARS, "#");
    return lowerCase ? cleaned.toLowerCase() : cleaned;
  }
  replaceDescription(description, a, b) {
    if (typeof description == "string") {
      return description.replace(a, b);
    }
    const result = {};
    for (const obj in description) {
      result[obj] = description[obj].replace(a, b);
    }
    return result;
  }
  appendToDescription(description, app) {
    if (typeof description == "string") {
      return description + app;
    }
    const result = {};
    for (const obj in description) {
      result[obj] = description[obj] + app;
    }
    return result;
  }
  async extendState(state) {
    var _a;
    if (state.indexOf("._refresh") !== -1) {
      return;
    }
    let node = void 0;
    if (state.indexOf("._Controls.") !== -1) {
      const appendix = state.substring(state.indexOf("._Controls.") + "._Controls.".length).split(".");
      if (this._actions[appendix[0]] && this._actions[appendix[0]][appendix[1]] && this._actions[appendix[0]][appendix[1]].type) {
        node = {
          type: this._actions[appendix[0]][appendix[1]].type,
          role: this._actions[appendix[0]][appendix[1]].role
        };
      }
    } else {
      const splitState = state.replace(`${this._adapter.name}.${this._adapter.instance}.`, "").toLowerCase().split(".");
      let prefix = (_a = splitState.shift()) != null ? _a : "";
      if (prefix == "_playing") {
        prefix = "playing";
      }
      for (const p of prefix === "events" ? ["events", "playing"] : [prefix]) {
        prefix = p;
        while (0 < splitState.length) {
          const n = `${prefix}.${splitState.join(".")}`;
          node = this.getNode(n);
          if (!node.notExist) {
            break;
          }
          splitState.shift();
        }
        if (node && !node.notExist) {
          break;
        }
      }
    }
    if (node !== void 0 && !node.notExist) {
      try {
        const roleAny = node.role;
        await this._adapter.extendObjectAsync(state, {
          common: {
            type: roleAny !== "device" || roleAny !== "channel" ? void 0 : node.type,
            role: roleAny !== "device" || roleAny !== "channel" ? void 0 : node.role
          }
        });
      } catch (error) {
        this._adapter.log.error(error instanceof Error ? error.message : String(error));
      }
    }
  }
  wait(time, callback) {
    return setTimeout(() => callback(), time);
  }
  encode(key, string) {
    let result = "";
    for (let i = 0; i < string.length; i++) {
      result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ string.charCodeAt(i));
    }
    return result;
  }
  decode(key, string) {
    return this.encode(key, string);
  }
  getKey(length) {
    const len = length || 8;
    let key = "";
    while (key.length < len) {
      key += parseInt(Math.random().toString().substring(2, 3)) >= 5 ? Math.random().toString(36).substring(2, 4) : Math.random().toString(36).substring(2, 4).toUpperCase();
    }
    return key.slice(0, len);
  }
  getIP(num) {
    const ip = [];
    ip.push(num & 255);
    ip.push(num >> 8 & 255);
    ip.push(num >> 16 & 255);
    ip.push(num >> 24 & 255);
    ip.reverse();
    return ip.join(".");
  }
  msg(receiver, command, message, callback) {
    this._adapter.sendTo(
      receiver,
      command,
      typeof message !== "object" ? { message } : message,
      callback === void 0 ? () => {
      } : callback
    );
  }
  ucFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  getTimestamp(date) {
    if (date === void 0 || !date) {
      return 0;
    }
    const ts = new Date(date).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  getDateTime(ts) {
    if (ts === void 0 || ts === "" || typeof ts === "number" && ts <= 0) {
      return "";
    }
    const date = new Date(ts);
    const day = `0${date.getDate()}`;
    const month = `0${date.getMonth() + 1}`;
    const year = date.getFullYear();
    const hours = `0${date.getHours()}`;
    const minutes = `0${date.getMinutes()}`;
    const seconds = `0${date.getSeconds()}`;
    return `${day.slice(-2)}.${month.slice(-2)}.${year} ${hours.slice(-2)}:${minutes.slice(-2)}:${seconds.slice(-2)}`;
  }
  getAdapterInstances(adapter, callback) {
    this._adapter.objects.getObjectView(
      "system",
      "instance",
      { startkey: `system.adapter.${adapter}.`, endkey: `system.adapter.${adapter}.\u9999` },
      (err, instances) => {
        if (instances && instances.rows) {
          const result = [];
          instances.rows.forEach(
            (instance) => result.push({
              id: instance.id.replace("system.adapter.", ""),
              config: instance.value.native.type
            })
          );
          callback(null, result);
        } else {
          callback(`Could not retrieve ${adapter} instances!`);
        }
      }
    );
  }
  runGarbageCollector = async (state, _del = false, offset = 6e4, whitelist = []) => {
    this._adapter.log.debug(`Running Garbage Collector for ${state}...`);
    return new Promise((resolve) => {
      this._adapter.getStates(`${state}.*`, async (err, states) => {
        var _a;
        try {
          if (err || !states) {
            resolve(false);
            return;
          }
          let key;
          for (const stateId in states) {
            key = stateId.replace(`${this._adapter.name}.${this._adapter.instance}.`, "");
            const entry = this._STATES[key];
            if (entry && entry.ts !== void 0 && entry.ts < Date.now() - offset && !(whitelist.length > 0 && RegExp(whitelist.join("|")).test(stateId))) {
              this._adapter.log.debug(`Garbage Collector: Emptied ${stateId}!`);
              try {
                const val = await this._adapter.getObjectAsync(key);
                let emptyVal;
                switch ((_a = val == null ? void 0 : val.common) == null ? void 0 : _a.type) {
                  case "string":
                    emptyVal = "";
                    break;
                  case "number":
                    emptyVal = 0;
                    break;
                  case "boolean":
                    emptyVal = false;
                    break;
                  default:
                    emptyVal = null;
                }
                void this._setValue(key, emptyVal, { force: true });
              } catch (error) {
                this._adapter.log.warn(error instanceof Error ? error.message : String(error));
              }
            }
          }
        } catch (error) {
          this._adapter.log.warn(`error 123${error instanceof Error ? error.message : String(error)}`);
        }
        resolve(true);
      });
    });
  };
  getDeviceState(state, property = "val") {
    const entry = this._STATES[state];
    return entry !== void 0 && entry ? entry[property] || false : null;
  }
  getDeviceStateJson(state, property = "val") {
    const result = {};
    for (const id in this._STATES) {
      if (id.startsWith(`${state}.`)) {
        const entry = this._STATES[id];
        const val = entry !== void 0 && entry ? entry[property] || false : null;
        Object.assign(result, _helper(result, id.replace(`${state}.`, "").split("."), val));
      }
    }
    return result;
    function _helper(res, key, val, deep = 0) {
      if (key.length > 1) {
        const k = key.splice(0, 1);
        res[k] = res[k] || {};
        try {
          Object.assign(res[k], _helper(res[k], key, val, deep + 1));
        } catch {
          res[k] = res[k] || {};
        }
      } else {
        if (key[0] == "_data") {
          res = JSON.parse(val);
        } else if (deep == 0) {
          res[key[0]] = val;
        }
      }
      return res;
    }
  }
  setDeviceState(state, value) {
    const entry = this._STATES[state];
    if ((entry === null || entry === void 0 || entry.val != value) && this._adapter && this._adapter.log && (this.options.updatesInLog && !this.options.updatesExceptions || this.options.updatesInLog && this.options.updatesExceptions && Array.isArray(this.options.updatesExceptions) && this.options.updatesExceptions.indexOf(state.slice(state.lastIndexOf(".") + 1)) == -1)) {
      this._adapter.log.debug(`Updated state ${state} to value ${value} (from ${entry && entry.val}).`);
    }
    return this.setDeviceProperties(state, { val: value });
  }
  setDeviceProperties(state, properties) {
    const oldval = this._STATES[state] && this._STATES[state].val;
    this._STATES[state] = { ...this._STATES[state] || {}, ...properties || {}, ts: Date.now() };
    this.checkSubscribeNode(state, this._STATES[state].val, oldval);
    return true;
  }
  checkSubscribeNode(state, val, oldval) {
    if (!state || this._STATES[state] === void 0 || !state.startsWith("_playing") || state.indexOf("_recent") !== -1) {
      return false;
    }
    const stateParts = state.split("-").pop();
    const node = stateParts ? stateParts.split(".").slice(1).join(".") : "";
    const lowNode = node.toLowerCase();
    if (oldval != val && this._SUBCSCRIPT_PLAYING[lowNode] !== void 0) {
      const prefix = state.replace(`.${node}`, "");
      this._SUBCSCRIPT_PLAYING[lowNode](state, prefix, val, oldval);
      this._adapter.log.debug(
        `Internal subscripted node:${lowNode} state: ${state} change from: ${oldval} to: ${val}`
      );
      return true;
    }
    return false;
  }
  subscribeNode(node, callback) {
    if (node && this._SUBCSCRIPT_PLAYING[node] !== void 0) {
      if (callback !== void 0 && typeof callback == "function") {
        this._SUBCSCRIPT_PLAYING[node] = callback;
      } else {
        delete this._SUBCSCRIPT_PLAYING[node];
      }
    }
  }
  clearStateCache(prefix) {
    for (const key of Object.keys(this._STATES)) {
      if (key === prefix || key.startsWith(`${prefix}.`)) {
        this._STATES[key] = void 0;
      }
    }
  }
  async del(state, nested, callback) {
    this._adapter.getStates(nested ? `${state}.*` : state, async (_err, objects) => {
      const objectIds = Object.keys(objects || {});
      for (const objectId of objectIds) {
        const key = objectId.replace(`${this._adapter.namespace}.`, "");
        try {
          await this._setValue(key, null, { force: true });
        } catch (error) {
          this._adapter.log.warn(`del: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      this._adapter.log.debug(`Reset ${objectIds.length} states under ${state}.`);
      if (callback) {
        callback();
      }
    });
  }
  async setMultiple(values, nodes, options = {}) {
    for (const key in values) {
      if (nodes[key] && nodes[key].node && nodes[key].description) {
        const node = nodes[key];
        let value = values[key];
        options.placeholders = options.placeholders || {};
        for (const placeholder in options.placeholders) {
          node.node = node.node.replace(placeholder, options.placeholders[placeholder]);
          node.description = node.description.replace(placeholder, options.placeholders[placeholder]);
        }
        switch (node.convert) {
          case "string":
            if (value && Array.isArray(value)) {
              value = value.join(", ");
            }
            break;
          case "datetime":
            await this.set(
              {
                node: `${node.node}Datetime`,
                description: node.description.replace("Timestamp", "Date-Time"),
                common: { type: "string", role: "text" }
              },
              value ? this.getDateTime(value * 1e3) : ""
            );
            break;
        }
        await this.set(node, value, options);
      }
    }
  }
  confirmNode(node, value) {
    if (!node || node.node === void 0 || this._STATES[node.node] === void 0) {
      this._adapter.log.debug(`confimNode node.node not exist: ${node ? node.node : "node undefined"}`);
      return;
    }
    void this._setValue(node.node, value, { force: true });
  }
  async set(node, value, options = {}) {
    var _a;
    if (!node || !node.node || node.name === void 0 && node.description === void 0) {
      this._adapter.log.error(`Error: State not properly defined (${JSON.stringify(node)})!`);
    }
    if (this._STATES[node.node] === void 0) {
      if (value !== "" || node.role == "channel") {
        await this._createNode(node);
        this._STATES[node.node] = (_a = this._STATES[node.node]) != null ? _a : null;
        await this.set(node, value, options);
      }
    } else {
      if (node.role == "device" || node.role == "channel") {
        return;
      }
      const type = node.common && node.common.type || node.type || "string";
      const converted = this.convertToType(value, type);
      await this._setValue(node.node, converted, options);
    }
  }
  async _createNode(node) {
    if (!this._adapter) {
      return Promise.reject(new Error("Adapter not defined!"));
    }
    const type = node.role == "device" || node.role == "channel" ? node.role == "device" ? "device" : "channel" : "state";
    let common = {
      name: node.name || node.description,
      role: node.common && node.common.role || node.role || "state",
      type: node.common && node.common.type || node.type || "string",
      write: false,
      ...node.common || {}
    };
    if (common.role.indexOf("button") > -1) {
      common = { ...common, type: "boolean", read: false, write: true };
    }
    if (common.role == "device" || common.role == "channel") {
      common = { ...common, type: void 0, role: void 0 };
    }
    await this._adapter.extendObject(node.node, {
      common,
      type,
      native: node.native || {}
    });
  }
  convertToType(value, type) {
    if (type === void 0) {
      return value;
    }
    if (value == void 0) {
      value = "";
    }
    const old_type = typeof value;
    let newValue = value;
    try {
      if (type !== old_type) {
        switch (type) {
          case "string":
            newValue = value.toString() || "";
            break;
          case "number":
            newValue = value ? Number(value) : 0;
            break;
          case "boolean":
            newValue = !!value;
            break;
        }
      }
    } catch {
      this._adapter.log.warn(`State has wrong common.typ:${type} should be:${old_type}`);
      return value;
    }
    return newValue;
  }
  async _setValue(state, value, options = {}) {
    if (state !== void 0) {
      try {
        const entry = this._STATES[state];
        if (value !== void 0 && (options.force || entry == null || entry.val != value)) {
          await this._adapter.setState(
            state,
            value === null ? null : {
              val: typeof value === "object" ? JSON.stringify(value) : value,
              ts: Date.now(),
              ack: true
            }
          );
          this.setDeviceState(state, value);
        } else {
          if ((entry == null ? void 0 : entry.val) !== value) {
            this.setDeviceProperties(state);
          }
        }
      } catch (err) {
        this._adapter.log.debug(
          `_setValue(${state}) failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  resetStates() {
    this._STATES = {};
  }
  async readData(key, data, prefix, properties, expandNestedData = false) {
    if (data === void 0 || data === "undefined") {
      return false;
    }
    let nodeKey = key;
    nodeKey = nodeKey.replace(/\[0-9]{3}\./gi, ".");
    nodeKey = nodeKey.search(/\.[0-9]{3}/gi) != -1 && `${nodeKey.replace(/\.[0-9]{3}/gi, "")}.list` || nodeKey;
    nodeKey = nodeKey.indexOf("_playing") > -1 ? `playing${nodeKey.substr(nodeKey.indexOf(".", prefix.length))}` : nodeKey;
    let node = this.getNode(nodeKey, true);
    if (node.notExist && prefix == "events") {
      nodeKey = nodeKey.replace(/^events\./gi, "playing.");
      node = this.getNode(nodeKey, true);
    }
    if (typeof data == "object" && data !== null) {
      if (Array.isArray(data) && !this._adapter.config.getMetadataTrees) {
        if (data.length) {
          await this.set(
            {
              node: key,
              type: node.type,
              role: node.role,
              description: node.description
            },
            data.map(
              (item) => item.url ? item.url : item.id ? item.id : item.tag ? item.tag : item.name
            ).join(", "),
            properties
          );
        }
        key = `${key}Tree`;
      }
      if (Object.keys(data).length > 0 && (key.indexOf("Tree") === -1 || key.indexOf("Tree") > -1 && this._adapter.config.getMetadataTrees)) {
        await this.set(
          {
            node: key,
            role: node.notExist ? "channel" : node.role,
            description: node.notExist ? RegExp(".[0-9]{3}$").test(key.substr(-4)) ? `Index ${key.substr(key.lastIndexOf(".") + 1)}` : `${this.ucFirst(key.substr(key.lastIndexOf(".") + 1).replace("Tree", ""))} Information` : node.description
          },
          void 0,
          properties
        );
        let indexKey;
        for (const nestedKey in data) {
          indexKey = typeof nestedKey === "string" && !isNaN(parseInt(nestedKey)) ? `00${nestedKey}`.slice(-3) : nestedKey;
          if (data[nestedKey] !== void 0 && data[nestedKey] !== "undefined") {
            if (typeof data[nestedKey] == "object" && (!Array.isArray(data[nestedKey]) || Array.isArray(data[nestedKey]) && this._adapter.config.getMetadataTrees) && !expandNestedData) {
              await this.set(
                {
                  node: `${key}.${Array.isArray(data[nestedKey]) ? `${nestedKey}Tree` : indexKey}._data`,
                  role: this.getNode("_data").role,
                  type: this.getNode("_data").type,
                  description: this.getNode("_data").description
                },
                JSON.stringify(data[nestedKey]),
                properties
              );
            }
            await this.readData(`${key}.${indexKey}`, data[nestedKey], prefix, void 0, expandNestedData);
          }
        }
      }
    } else {
      node.key = key;
      node.nodeKey = nodeKey;
      const converted = await this.convertNode(node, data);
      await this.set(
        {
          node: key,
          type: node.type,
          role: node.role,
          description: node.description,
          common: node.common != void 0 ? node.common : void 0
        },
        converted,
        properties
      );
    }
  }
  async convertNode(node, data) {
    if (!(node && node.convert)) {
      return data;
    }
    let date;
    switch (node.convert.func) {
      case "date-timestamp":
        if (data.toString().indexOf("-") > -1) {
          date = data;
          data = Math.floor(new Date(data).getTime() / 1e3);
        } else {
          const ts = new Date(data * 1e3);
          date = `${ts.getFullYear()}-${`0${ts.getMonth()}`.substr(-2)}-${`0${ts.getDate()}`.substr(-2)}`;
        }
        await this.set(
          {
            node: `${node.key}Date`,
            type: "string",
            role: "text",
            description: this.getNode(`${node.nodeKey}Date`, true).description
          },
          date
        );
        break;
      case "seconds-readable": {
        const d = new Date(Number(data));
        let value = d.getUTCHours() > 0 ? d.getUTCHours().toString() : "";
        value += value ? `:${`0${d.getUTCMinutes()}`.slice(-2)}` : `${d.getUTCMinutes().toString()}:${`0${d.getUTCSeconds().toString()}`.slice(-2)}`;
        await this.set(
          {
            node: `${node.key}human`,
            type: "string",
            role: "text",
            description: this.getNode(`${node.nodeKey}human`, true).description
          },
          value
        );
        await this.set(
          {
            node: `${node.key}Seconds`,
            type: "number",
            role: "media.elapsed",
            description: this.getNode(`${node.nodeKey}Seconds`, true).description
          },
          Math.floor(Number(data) / 1e3)
        );
        break;
      }
      case "ms-min": {
        const duration = data / 1e3;
        await this.set(
          {
            node: `${node.key}Seconds`,
            type: "number",
            role: "media.duration",
            description: this.getNode(`${node.nodeKey}Seconds`, true).description
          },
          duration < 1 ? data * 60 : Math.floor(duration)
        );
        return duration < 1 ? data : Math.floor(duration / 60);
      }
      case "create-link":
      case "create-link-only": {
        const link = data ? `${this.AXIOS_OPTIONS._protocol}//${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${data}?X-Plex-Token=${this._adapter.config.plexToken}` : "";
        if (node.convert.func == "create-link-only") {
          return link;
        }
        await this.set(
          {
            node: node.key + node.convert.key,
            type: node.convert.type,
            role: node.convert.role,
            description: this.getNode(node.nodeKey + node.convert.key, true).description
          },
          link
        );
        break;
      }
    }
    return data;
  }
  async getItem(item) {
    if (!item || typeof item !== "string" || !this._plex) {
      return {};
    }
    const result = await this._plex.query(item);
    if (!result || !result.MediaContainer) {
      return {};
    }
    return result.MediaContainer;
  }
  static cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Library
});
//# sourceMappingURL=library.js.map
