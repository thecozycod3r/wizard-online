// One shared Supabase Realtime channel per table. Everyone sends and listens; whoever is currently
// running the table broadcasts the full state, so any player can take over if that device drops.
//   const bus = await openBus(code)
//   bus.on("state" | "hello" | "act" | "err", payload => …)
//   bus.send(event, payload)        bus.track({ pid })        bus.onPresence(setOfPids => …)
//   bus.onStatus(ok => …)           true = connected, false = connection lost (auto-reconnects)
//   bus.revive(hard)                after the phone wakes up: reconnect now instead of waiting for the next heartbeat

import { CONFIG } from "./config.js";
import { debugShow } from "./debug.js";

// Channel names are "<prefix><code>"; each game passes its own prefix.

// Room codes: 4 characters, the first names the game (see shared/games.js), e.g. "IKQ7" is an Incan Gold table.
// Friends can type one on the home page. (Older 6-letter lowercase codes still work — links never expire.)
export function newCode(letter) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(letter ? 3 : 4)), b => abc[b % abc.length]).join("");
  return (letter || "") + tail;
}
export const normCode = g => (g && g.length === 4 ? g.toUpperCase() : g);

let client = null;
async function supabase() {
  if (client) return client;
  if (!window.supabase) {
    await new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = new URL("./supabase.min.js", import.meta.url).href;
      s.onload = ok; s.onerror = () => bad(new Error("Couldn't load the game's network library. Check your internet and reload."));
      document.head.append(s);
    });
  }
  client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    realtime: { params: { eventsPerSecond: 30 }, heartbeatIntervalMs: 10000 },
  });
  return client;
}

export async function openBus(code, prefix = "g4f-") {
  const sb = await supabase();
  const handlers = {}, presenceFns = [], statusFns = [];
  let tracked = null, ok = false;
  const ch = sb.channel(prefix + code, {
    config: { broadcast: { self: false, ack: false }, presence: { key: Math.random().toString(36).slice(2, 12) } },
  });
  const setOk = now => { if (now !== ok) { ok = now; statusFns.forEach(f => f(ok)); } };
  for (const ev of ["state", "hello", "act", "err", "claim", "move"]) {
    ch.on("broadcast", { event: ev }, ({ payload }) => { setOk(true); (handlers[ev] || []).forEach(f => { try { f(payload); } catch (e) { console.error(e); debugShow(ev + ": " + (e.stack || e)); } }); });
  }
  const online = () => new Set(Object.values(ch.presenceState()).flat().map(p => p.pid).filter(Boolean));
  ch.on("presence", { event: "sync" }, () => { const s = online(); presenceFns.forEach(f => f(s)); });

  const ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Couldn't reach the game server. Check your internet and try again.")), 15000);
    ch.subscribe(status => {
      const now = status === "SUBSCRIBED";
      if (now) { clearTimeout(t); resolve(); if (tracked) ch.track(tracked); }
      if (now !== ok && (now || ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status))) { ok = now; statusFns.forEach(f => f(ok)); }
    });
  });
  addEventListener("offline", () => setOk(false));
  await ready;
  // The subscribe callback doesn't always fire again after a blip, so check the real socket + channel state.
  setInterval(() => { try { setOk(navigator.onLine !== false && sb.realtime.isConnected() && ch.state === "joined"); } catch { /* keep last */ } }, 2000);
  return {
    on: (ev, f) => (handlers[ev] ||= []).push(f),
    send: (ev, payload) => ch.send({ type: "broadcast", event: ev, payload }).catch(() => {}),
    track: obj => { tracked = obj; return ch.track(obj).catch(() => {}); },
    onPresence: f => presenceFns.push(f),
    onStatus: f => statusFns.push(f),
    connected: () => ok,
    // After the phone wakes: reconnect a socket that died while asleep (hard = drop a socket that only looks open).
    revive(hard) {
      const rt = sb.realtime;
      try {
        // close the socket the normal way (not disconnect(), which silences it): the client then flags its channels,
        // reconnects and re-joins them by itself
        if (hard && rt.conn) rt.conn.close();
        else if (!rt.isConnected()) rt.connect();
      } catch { /* the client keeps retrying by itself */ }
    },
  };
}
