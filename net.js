// Transport between the host's browser (runs the engine) and players' browsers.
// PeerJS (WebRTC data channels) by default; Supabase Realtime broadcast when configured in config.js.
// Both expose the same tiny interface:
//   host:   const h = await hostNet(code); h.onMessage((connId, msg) => …); h.onClose(connId => …); h.send(connId, msg)
//   client: const c = await joinNet(code); c.onMessage(msg => …); c.onStatus(s => …); c.send(msg)

import { CONFIG } from "./config.js";

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];
const PREFIX = "wizard30-";

export function newCode() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => abc[b % abc.length]).join("");
}

function emitter() {
  const fns = [];
  return { on: f => fns.push(f), fire: (...a) => fns.forEach(f => { try { f(...a); } catch (e) { console.error(e); } }) };
}

// ---------------- Supabase Realtime ----------------

async function supabaseClient() {
  if (!window.supabase) {
    await new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = "vendor/supabase.min.js";
      s.onload = ok; s.onerror = () => bad(new Error("Couldn't load the Supabase library."));
      document.head.append(s);
    });
  }
  return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { realtime: { params: { eventsPerSecond: 20 } } });
}

async function sbChannel(code, self) {
  const sb = await supabaseClient();
  const ch = sb.channel(PREFIX + code, { config: { broadcast: { self: false, ack: false }, presence: { key: self } } });
  return { sb, ch };
}

async function hostSupabase(code) {
  const msg = emitter(), close = emitter();
  const { ch } = await sbChannel(code, "host");
  ch.on("broadcast", { event: "c2h" }, ({ payload }) => msg.fire(payload.from, payload.msg));
  ch.on("presence", { event: "leave" }, ({ leftPresences }) => leftPresences.forEach(p => p.conn && close.fire(p.conn)));
  await new Promise((ok, bad) => ch.subscribe(s => (s === "SUBSCRIBED" ? ok() : s === "CHANNEL_ERROR" && bad(new Error("Realtime channel failed.")))));
  await ch.track({ conn: "host" });
  return {
    kind: "supabase",
    onMessage: msg.on, onClose: close.on,
    send: (to, m) => ch.send({ type: "broadcast", event: "h2c", payload: { to, msg: m } }),
  };
}

async function joinSupabase(code) {
  const msg = emitter(), status = emitter();
  const me = "c" + Math.random().toString(36).slice(2, 10);
  const { ch } = await sbChannel(code, me);
  ch.on("broadcast", { event: "h2c" }, ({ payload }) => { if (payload.to === me || payload.to === "*") msg.fire(payload.msg); });
  await new Promise((ok, bad) => ch.subscribe(s => {
    if (s === "SUBSCRIBED") { status.fire("open"); ok(); }
    else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") { status.fire("lost"); bad?.(new Error("Couldn't reach the game.")); }
  }));
  await ch.track({ conn: me });
  return { kind: "supabase", onMessage: msg.on, onStatus: status.on, send: m => ch.send({ type: "broadcast", event: "c2h", payload: { from: me, msg: m } }) };
}

// ---------------- PeerJS ----------------

function newPeer(id) {
  return new Promise((ok, bad) => {
    const p = id ? new window.Peer(id, { config: { iceServers: ICE }, debug: 1 }) : new window.Peer({ config: { iceServers: ICE }, debug: 1 });
    const t = setTimeout(() => bad(new Error("The connection service didn't answer. Check your internet and try again.")), 15000);
    p.on("open", () => { clearTimeout(t); ok(p); });
    p.on("error", e => { clearTimeout(t); bad(e); });
  });
}

async function hostPeer(code) {
  const msg = emitter(), close = emitter();
  let peer;
  // After a reload the old id can stay reserved for a few seconds; retry.
  for (let i = 0; i < 6; i++) {
    try { peer = await newPeer(PREFIX + code); break; }
    catch (e) { if (e.type !== "unavailable-id" || i === 5) throw e; await new Promise(r => setTimeout(r, 2500)); }
  }
  const conns = new Map();
  peer.on("connection", conn => {
    conn.on("open", () => conns.set(conn.connectionId, conn));
    conn.on("data", d => msg.fire(conn.connectionId, d));
    conn.on("close", () => { conns.delete(conn.connectionId); close.fire(conn.connectionId); });
    conn.on("error", () => { conns.delete(conn.connectionId); close.fire(conn.connectionId); });
  });
  peer.on("disconnected", () => { try { peer.reconnect(); } catch { /* destroyed */ } });
  return {
    kind: "peer", onMessage: msg.on, onClose: close.on,
    send: (to, m) => { const c = conns.get(to); if (c?.open) c.send(m); },
  };
}

async function joinPeer(code) {
  const msg = emitter(), status = emitter();
  const peer = await newPeer();
  let conn;
  const connect = () => new Promise((ok, bad) => {
    conn = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
    const t = setTimeout(() => bad(new Error("Couldn't reach the host. Ask them to keep the game open, then try again.")), 15000);
    conn.on("open", () => { clearTimeout(t); status.fire("open"); ok(); });
    conn.on("data", d => msg.fire(d));
    conn.on("close", () => { status.fire("lost"); retry(); });
    conn.on("error", () => { status.fire("lost"); });
  });
  let retrying = false;
  const retry = async () => {
    if (retrying) return; retrying = true;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, Math.min(1000 * (i + 1), 5000)));
      try { if (peer.disconnected) peer.reconnect(); await connect(); retrying = false; return; } catch { /* keep trying */ }
    }
    retrying = false; status.fire("gone");
  };
  peer.on("error", e => { if (e.type === "peer-unavailable") status.fire("lost"); });
  await connect();
  return { kind: "peer", onMessage: msg.on, onStatus: status.on, send: m => conn?.open && conn.send(m) };
}

export const useSupabase = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
export const hostNet = code => (useSupabase() ? hostSupabase(code) : hostPeer(code));
export const joinNet = code => (useSupabase() ? joinSupabase(code) : joinPeer(code));
