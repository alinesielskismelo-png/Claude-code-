/**
 * Script injetado no início de cada artefato, antes do código dele.
 * Recria, fora do claude.ai, as APIs de runtime que os artefatos usam:
 *  - localStorage / sessionStorage (o iframe sandbox não tem storage próprio);
 *  - window.storage (API de armazenamento persistente dos artefatos do Claude);
 *  - window.claude.complete(prompt) e window.claude.use("db" | "sample");
 * Tudo que persiste é enviado à página pai por um MessagePort; a página pai grava no servidor.
 *
 * Regras deste arquivo: o JS fica numa string crua, sem crases nem "${" dentro.
 */
export const SHIM_JS = String.raw`(function(){
"use strict";
var BOOT = window.__ART_BOOT || {};
try { delete window.__ART_BOOT; } catch (e) { window.__ART_BOOT = undefined; }
var port = BOOT.port || null;
var kv = BOOT.kv || {};
var seq = 0, pending = {};
function send(msg){ if (port) port.postMessage(msg); }
function clone(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function err(code, message){ var e = new Error(message || code); e.code = code; return e; }

if (port) {
  port.onmessage = function(ev){
    var m = ev.data || {};
    if (m.type === "rpc:result" && pending[m.id]) {
      var p = pending[m.id]; delete pending[m.id];
      if (m.error) { var e = err(m.error.code || "error", m.error.message); p.reject(e); }
      else p.resolve(m.result);
    }
  };
}
function rpc(method, args){
  return new Promise(function(resolve, reject){
    if (!port) { reject(err("unavailable", "Sem conexão com a plataforma")); return; }
    var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
    send({ type: "rpc", id: id, method: method, args: args });
  });
}
function persist(key, value){
  if (value === undefined || value === null) delete kv[key]; else kv[key] = value;
  send({ type: "kv:set", key: key, value: value === undefined ? null : value });
}

/* ---------- localStorage / sessionStorage ---------- */
function makeStorage(prefix, persistent){
  var map = Object.create(null);
  if (persistent) Object.keys(kv).forEach(function(k){ if (k.indexOf(prefix) === 0) map[k.slice(prefix.length)] = String(kv[k]); });
  var api = {
    getItem: function(k){ k = String(k); return k in map ? map[k] : null; },
    setItem: function(k, v){ k = String(k); v = String(v); map[k] = v; if (persistent) persist(prefix + k, v); },
    removeItem: function(k){ k = String(k); if (!(k in map)) return; delete map[k]; if (persistent) persist(prefix + k, null); },
    clear: function(){ Object.keys(map).forEach(function(k){ api.removeItem(k); }); },
    key: function(i){ var ks = Object.keys(map); return i < ks.length ? ks[i] : null; }
  };
  return new Proxy(api, {
    get: function(t, p){ if (p === "length") return Object.keys(map).length; if (p in t) return t[p]; if (typeof p === "string" && p in map) return map[p]; return undefined; },
    set: function(t, p, v){ if (typeof p === "string") api.setItem(p, v); return true; },
    deleteProperty: function(t, p){ api.removeItem(p); return true; },
    has: function(t, p){ return p in t || p in map; },
    ownKeys: function(){ return Object.keys(map); },
    getOwnPropertyDescriptor: function(t, p){ if (typeof p === "string" && p in map) return { value: map[p], enumerable: true, configurable: true, writable: true }; return undefined; }
  });
}
try { Object.defineProperty(window, "localStorage", { value: makeStorage("ls:", true), configurable: true }); } catch (e) {}
try { Object.defineProperty(window, "sessionStorage", { value: makeStorage("ss:", false), configurable: true }); } catch (e) {}

/* ---------- window.storage (artefatos do Claude) ---------- */
window.storage = {
  get: function(key){ var k = "st:" + key; return Promise.resolve(k in kv ? { key: key, value: kv[k], shared: false } : null); },
  set: function(key, value){ persist("st:" + key, value); return Promise.resolve({ key: key, value: value, shared: false }); },
  delete: function(key){ persist("st:" + key, null); return Promise.resolve({ key: key, deleted: true, shared: false }); },
  list: function(prefix){
    var pre = "st:" + (prefix || "");
    var keys = Object.keys(kv).filter(function(k){ return k.indexOf(pre) === 0; }).map(function(k){ return k.slice(3); });
    return Promise.resolve({ keys: keys, prefix: prefix || "", shared: false });
  }
};

/* ---------- db (documentos no estilo Firestore) ---------- */
var listeners = Object.create(null), colListeners = Object.create(null);
function snap(path){
  var k = "db:" + path;
  return { id: path.split("/").pop(), ref: docRef(path), exists: k in kv, data: function(){ return clone(kv[k]); },
           metadata: { fromCache: false, hasPendingWrites: false } };
}
function parentOf(path){ var i = path.lastIndexOf("/"); return i > 0 ? path.slice(0, i) : ""; }
function colSnap(path){
  var pre = "db:" + path + "/";
  var d = Object.keys(kv).filter(function(k){ return k.indexOf(pre) === 0 && k.slice(pre.length).indexOf("/") < 0; })
    .map(function(k){ return snap(k.slice(3)); });
  return { docs: d, size: d.length, empty: d.length === 0, forEach: function(f){ d.forEach(f); },
           docChanges: function(){ return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
}
function emit(path){
  (listeners[path] || []).slice().forEach(function(cb){ try { cb(snap(path)); } catch (e) { console.error(e); } });
  var col = parentOf(path);
  if (col) (colListeners[col] || []).slice().forEach(function(cb){ try { cb(colSnap(col)); } catch (e) { console.error(e); } });
}
function docRef(path){
  path = String(path).replace(/^\/+|\/+$/g, "");
  var k = "db:" + path;
  return {
    id: path.split("/").pop(), path: path,
    get: function(){ return Promise.resolve(snap(path)); },
    set: function(data, opts){
      var v = opts && opts.merge ? Object.assign({}, kv[k] || {}, clone(data)) : clone(data);
      persist(k, v); emit(path); return Promise.resolve();
    },
    update: function(data){ persist(k, Object.assign({}, kv[k] || {}, clone(data))); emit(path); return Promise.resolve(); },
    delete: function(){ persist(k, null); emit(path); return Promise.resolve(); },
    onSnapshot: function(cb){
      (listeners[path] = listeners[path] || []).push(cb);
      setTimeout(function(){ cb(snap(path)); }, 0);
      return function(){ listeners[path] = (listeners[path] || []).filter(function(f){ return f !== cb; }); };
    }
  };
}
function collectionRef(path){
  path = String(path).replace(/^\/+|\/+$/g, "");
  return {
    id: path.split("/").pop(), path: path,
    doc: function(id){ return docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))); },
    add: function(data){ var r = docRef(path + "/" + Math.random().toString(36).slice(2, 12)); return r.set(data).then(function(){ return r; }); },
    get: function(){ return Promise.resolve(colSnap(path)); },
    onSnapshot: function(cb){
      (colListeners[path] = colListeners[path] || []).push(cb);
      setTimeout(function(){ cb(colSnap(path)); }, 0);
      return function(){ colListeners[path] = (colListeners[path] || []).filter(function(f){ return f !== cb; }); };
    }
  };
}
var dbApi = { doc: docRef, collection: collectionRef };

/* ---------- IA ---------- */
function complete(prompt){
  return rpc("complete", [typeof prompt === "string" ? prompt : JSON.stringify(prompt)]).then(function(r){ return r && r.text != null ? r.text : String(r || ""); });
}
function sample(prompt, opts){
  opts = opts || {};
  return new Promise(function(resolve, reject){
    var done = false;
    if (opts.signal) {
      if (opts.signal.aborted) { var a = err("cancelled", "Cancelado"); a.name = "AbortError"; reject(a); return; }
      opts.signal.addEventListener("abort", function(){ if (done) return; done = true; var a = err("cancelled", "Cancelado"); a.name = "AbortError"; reject(a); });
    }
    complete(prompt).then(function(text){
      if (done) return; done = true;
      try { if (typeof opts.onText === "function") opts.onText({ text: text, delta: text }); } catch (e) {}
      resolve({ text: text });
    }, function(e){ if (done) return; done = true; reject(e); });
  });
}

/* ---------- mcp: conectores do Google pelo servidor do site ---------- */
var watchers = [];
/* Datas sem fuso ("2026-11-25T08:00:00") ganham o fuso do aparelho, como no claude.ai. */
var NAIVE_DT = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?$/;
function withOffset(v){
  if (typeof v !== "string" || !NAIVE_DT.test(v)) return v;
  var d = new Date(v); if (isNaN(d)) return v;
  var m = -d.getTimezoneOffset(), sign = m >= 0 ? "+" : "-"; m = Math.abs(m);
  var hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
  return (v.length === 16 ? v + ":00" : v) + sign + hh + ":" + mm;
}
function fixArgs(server, args){
  args = args && typeof args === "object" ? clone(args) : {};
  if (/calendar|agenda/i.test(String(server))) {
    ["startTime", "endTime", "timeMin", "timeMax", "start", "end"].forEach(function(k){ if (k in args) args[k] = withOffset(args[k]); });
    if (!args.timeZone) { try { args.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {} }
  }
  return args;
}
function callTool(server, tool, args){
  return rpc("mcp", [String(server), String(tool), fixArgs(server, args)]);
}
function runWatcher(w){
  callTool(w.server, w.tool, w.args).then(function(r){
    if (!w.off) { try { w.cb({ type: "data", result: r }); } catch (e) { console.error(e); } }
  }, function(e){
    if (!w.off) { try { w.cb({ type: "error", error: { code: e.code || "error", message: e.message } }); } catch (x) { console.error(x); } }
  });
}
function sameArgs(a, b){ try { return JSON.stringify(a || {}) === JSON.stringify(b || {}); } catch (e) { return false; } }
var mcpApi = {
  callTool: function(server, tool, args){ return callTool(server, tool, args); },
  watchTool: function(server, tool, args, cb, opts){
    var w = { server: server, tool: tool, args: args, cb: cb, off: false, timer: null };
    watchers.push(w);
    runWatcher(w);
    var every = opts && Number(opts.refetchInterval);
    if (every && every >= 5000) w.timer = setInterval(function(){ runWatcher(w); }, every);
    return function(){ w.off = true; if (w.timer) clearInterval(w.timer); watchers = watchers.filter(function(x){ return x !== w; }); };
  },
  invalidate: function(server, tool, args){
    watchers.forEach(function(w){
      if (w.server !== server) return;
      if (tool && w.tool !== tool) return;
      if (args && !sameArgs(args, w.args)) return;
      runWatcher(w);
    });
    return Promise.resolve();
  }
};

/* ---------- assets: fotos e arquivos guardados no site ("/_blob/<id>") ---------- */
var assetsApi = {
  upload: function(blob){
    if (!blob || typeof blob.size !== "number") return Promise.reject(err("invalid_argument", "Envie um arquivo"));
    if (blob.size > 4 * 1024 * 1024) return Promise.reject(err("too_large", "Arquivo grande demais (máx. 4 MB)"));
    return rpc("asset:upload", [blob]).then(function(r){
      return { id: r.id, url: r.url, size: r.size, contentType: r.contentType };
    });
  },
  url: function(id){ return "/_blob/" + id; }
};

window.claude = {
  complete: complete,
  use: function(name){
    if (name === "db") return Promise.resolve(dbApi);
    if (name === "sample") return Promise.resolve(sample);
    if (name === "mcp") return Promise.resolve(mcpApi);
    if (name === "assets") return Promise.resolve(assetsApi);
    return Promise.reject(err("not_granted", "Recurso \"" + name + "\" ainda não existe nesta plataforma"));
  }
};

/* ---------- links para outros artefatos do claude.ai abrem a cópia do site ---------- */
var ART_RE = /^https?:\/\/claude\.ai\/(?:code\/)?artifact\/([A-Za-z0-9-]{1,64})/i;
function artRef(u){ var m = String(u || "").match(ART_RE); return m ? m[1] : null; }
var nativeOpen = window.open;
window.open = function(u){
  var ref = artRef(u);
  if (ref) { send({ type: "open", ref: ref }); return null; }
  return nativeOpen.apply(window, arguments);
};

/* ---------- links externos abrem em nova aba ---------- */
document.addEventListener("click", function(ev){
  var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
  if (!a) return;
  var h = a.getAttribute("href") || "";
  var ref = artRef(h);
  if (ref) { ev.preventDefault(); ev.stopPropagation(); send({ type: "open", ref: ref }); return; }
  if (/^(https?:|mailto:|tel:)/i.test(h)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
}, true);

/* ---------- erros e console para a plataforma ---------- */
function fmt(args){ return Array.prototype.map.call(args, function(x){
  if (x instanceof Error) return x.name + ": " + x.message;
  if (typeof x === "object") { try { return JSON.stringify(x); } catch (e) { return String(x); } }
  return String(x); }).join(" ").slice(0, 2000); }
["error", "warn"].forEach(function(level){
  var orig = console[level];
  console[level] = function(){ send({ type: "log", level: level, message: fmt(arguments) }); return orig.apply(console, arguments); };
});
window.addEventListener("error", function(e){ send({ type: "log", level: "error", message: (e.message || "Erro") + (e.lineno ? " (linha " + e.lineno + ")" : "") }); });
window.addEventListener("unhandledrejection", function(e){ var r = e.reason; send({ type: "log", level: "error", message: "Promise rejeitada: " + (r && r.message ? r.message : String(r)) }); });
})();`;
