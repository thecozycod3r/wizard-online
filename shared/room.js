// Games4free table logic shared by every game: lobby, share link, join by name, seat reclaim from any
// device, and failover. The device that "runs the table" applies actions with the game's engine and
// broadcasts the full state; if it goes quiet for 7 s the next online player takes over (epoch + 1).
//
//   const room = createRoom({ prefix, engine, defaults, minPlayers, maxPlayers, hostOnly, timers, onUpdate, toast })
//   room.create(name) · room.join(name) · room.claim(pid) · room.act(action) · room.start()
//   room.settings(patch) · room.kick(pid) · room.playFor(pid) · room.backToLobby() · room.leave() · room.rejoin()
//   room.S  — { mode, code, me, lobby, view, online, status, error, net, isHost }
//
// engine: { newGame(players, settings), act(G, pid, a), viewFor(G, pid), waitingOn(G), autoAction(G, pid) }
// timers(G) → null | { ms, action }: a follow-up the table runner applies by itself (e.g. Wizard's trick pause).
// Turn timer: settings.timer (seconds: 30 / 60 / 120). When it runs out, the runner plays engine.smartAction (or
// autoAction) for whoever the game is waiting on. engine.timerKey(G) says when the clock should restart.
// Leaving: in the lobby the seat is removed; mid-game a bot takes the seat (plays smartAction about once a second) so the
// game can finish. The player can take the seat back from any device with "This is me".

import { openBus, newCode } from "./net.js";

const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } },
};
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

export function createRoom(cfg) {
  const { prefix, engine, defaults = {}, minPlayers = 2, maxPlayers = 6, hostOnly = [], timers = () => null, onUpdate = () => {}, toast = () => {} } = cfg;
  const S = { bots: [], left: false, mode: "landing", code: new URLSearchParams(location.search).get("g"), me: null, lobby: null, view: null, online: {}, status: "", error: "", net: true, isHost: false };
  let H = null, BUS = null, ME = null, last = null, lastAt = 0, pending = null, wasSeated = false, onlineSet = new Set(), timer = null;
  let clockSeen = null, clockAt = 0, lastNote = null, botTimer = null;
  // Phones pause pages in the background (screen lock, switching apps). On waking, everything this device knows is stale:
  // it must not take the table over, and if it was running the table it holds off until it hears from the others.
  let tickAt = Date.now(), wokeAt = 0, heardAt = 0, reviveT = null, rearm = false, hiddenAt = 0;
  const heard = () => { heardAt = Date.now(); };
  const holding = () => wokeAt && heardAt < wokeAt && Date.now() - wokeAt < 5000;
  function woke(away = 0) {
    wokeAt = Date.now(); lastAt = wokeAt; clockAt = wokeAt;
    if (!BUS) return;
    if (H) { clearTimeout(timer); clearTimeout(botTimer); rearm = true; }
    BUS.revive(away > 5000);   // phones close sockets in the background: after more than a few seconds away, reconnect at once
    if (!H && ME) BUS.send("hello", { token: ME.token, name: ME.name });
    clearTimeout(reviveT);
    reviveT = setTimeout(() => { if (heardAt < wokeAt) { BUS.revive(true); if (!H && ME) setTimeout(() => BUS.send("hello", { token: ME.token, name: ME.name }), 1500); } }, 2500);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else woke(hiddenAt ? Date.now() - hiddenAt : 0);
  });
  addEventListener("pageshow", e => { if (e.persisted) woke(); });
  addEventListener("online", () => woke());
  const meKey = () => `${prefix}me-${S.code}`, stKey = () => `${prefix}state-${S.code}`;
  const isOnline = pid => (pid === S.me ? S.net : onlineSet.has(pid));
  const seat = (st, pid) => st.players.findIndex(p => p.id === pid);

  // ------------------------------------------------ running the table
  const snap = () => ({ code: H.code, epoch: H.epoch, n: H.n, hostPid: H.me, players: H.players, settings: H.settings, G: H.G,
    clock: H.clock ? { key: H.clock.key, left: Math.max(0, H.clock.deadline - Date.now()), total: (H.settings.timer || 60) * 1000, waiting: H.clock.waiting } : null,
    note: H.note || null, bots: H.bots || [] });
  const timerKey = G => (engine.timerKey ? engine.timerKey(G) : String(G.seq));
  function updateClock() {
    if (!H) return;
    const G = H.G;
    const w = G && G.phase !== "gameOver" ? engine.waitingOn(G) : [];
    if (!w.length) { H.clock = null; return; }
    const key = timerKey(G);
    if (!H.clock || H.clock.key !== key) H.clock = { key, deadline: Date.now() + (H.settings.timer || 60) * 1000, waiting: w };
    else H.clock.waiting = w;
  }
  function expire() {
    const G = H.G, who = engine.waitingOn(G);
    const names = [];
    for (const pid of who) {
      let a = null;
      try { a = (engine.smartAction || engine.autoAction)(G, pid); } catch { a = null; }
      if (!a) continue;
      const before = G.seq;
      applyAct(pid, a, true, true);
      if (H.G.seq !== before) names.push(H.players.find(p => p.id === pid)?.name || "a player");
    }
    if (names.length) { H.note = { n: H.n + 1, msg: `Time's up: a move was made for ${names.join(", ")}.` }; broadcast(); }
    else if (H.clock) H.clock.deadline = Date.now() + 5000; // nothing applied; try again shortly
  }
  // Seats whose player left are played by a bot, at a human-ish pace.
  function botTick() {
    if (!H?.G || !H.bots?.length || H.G.phase === "gameOver") return;
    for (const pid of engine.waitingOn(H.G).filter(p => H.bots.includes(p))) {
      let a = null;
      try { a = (engine.smartAction || engine.autoAction)(H.G, pid); } catch { a = null; }
      if (a) { applyAct(pid, a, true, true); return; }
    }
  }
  function broadcast(bump = true) {
    if (!H) return;
    if (bump) H.n += 1;
    if (H.bots?.length && H.G) { clearTimeout(botTimer); botTimer = setTimeout(botTick, 1100); }
    updateClock();
    const st = structuredClone(snap());
    LS.set(stKey(), st);
    BUS?.send("state", st);
    apply(st);
  }
  function schedule() {
    clearTimeout(timer);
    const t = H?.G ? timers(H.G) : null;
    if (!t) return;
    const seq = H.G.seq;
    timer = setTimeout(() => { if (H?.G && H.G.seq === seq) applyAct(H.me, t.action, true, true); }, t.ms);
  }
  function leaveSeat(pid) {
    const p = H.players.find(p => p.id === pid); if (!p) return;
    if (!H.G) { H.players = H.players.filter(x => x.id !== pid); broadcast(); return; }
    p.token = "left-" + rid();
    H.bots = [...new Set([...(H.bots || []), pid])];
    H.note = { n: H.n + 1, msg: `${p.name} left the game. A bot is playing their seat.` };
    broadcast();
  }
  function applyAct(pid, a, quiet, internal) {
    if (a?.type === "_leave") return H && leaveSeat(pid);
    if (!H?.G) return;
    if (hostOnly.includes(a?.type) && !internal && pid !== H.me) return;
    try { engine.act(H.G, pid, a); } catch (e) { if (!quiet) sendErr(pid, e.message); return; }
    schedule(); broadcast();
  }
  function sendErr(pid, m) {
    if (pid === H.me) return toast(m);
    const p = H.players.find(p => p.id === pid);
    if (p) BUS?.send("err", { token: p.token, msg: m });
  }
  function takeOver(from, why) {
    H = { ...structuredClone(from), me: S.me, epoch: from.epoch + 1 };
    delete H.hostPid; delete H.clock;
    if (from.clock) H.clock = { key: from.clock.key, waiting: from.clock.waiting, deadline: Date.now() + Math.max(4000, from.clock.left - (Date.now() - clockAt)) };
    if (why) toast(why);
    schedule(); broadcast();
  }

  // ------------------------------------------------ messages
  function onHello(m) {
    heard();
    if (!H || !m?.token) return;
    const name = String(m.name || "").trim().slice(0, 18) || "Player";
    let p = H.players.find(p => p.token === m.token);
    if (!p && !H.G) {
      p = H.players.find(x => x.name.toLowerCase() === name.toLowerCase() && !isOnline(x.id) && x.id !== H.me);
      if (p) p.token = String(m.token).slice(0, 40);
    }
    if (!p) {
      if (H.G) return broadcast();
      if (H.players.length >= maxPlayers) return BUS.send("err", { token: m.token, msg: `The table is full (${maxPlayers} players).` });
      p = { id: "p" + rid().slice(0, 6), token: String(m.token).slice(0, 40), name };
      H.players.push(p);
    } else if (!H.G) p.name = name;
    broadcast();
  }
  function onClaim(m) {
    const p = H?.players.find(p => p.id === m?.pid);
    if (p && m.token) { p.token = String(m.token).slice(0, 40); H.bots = (H.bots || []).filter(x => x !== p.id); broadcast(); }
  }
  function onAct(m) {
    heard();
    const p = H?.players.find(p => p.token === m?.token);
    if (p) applyAct(p.id, m.a, m.retry);
  }
  function onState(st) {
    if (!st || st.code !== S.code) return;
    heard();
    if (H && st.hostPid !== H.me) {
      if (st.epoch > H.epoch || (st.epoch === H.epoch && seat(st, st.hostPid) < seat(st, H.me))) { H = null; clearTimeout(timer); toast("Back online. Another player kept the game going."); }
      else return;
    }
    if (last && st.epoch === last.epoch && st.n === last.n) { lastAt = Date.now(); clockSeen = st.clock; clockAt = lastAt; return; }
    if (last && !H && (st.epoch < last.epoch || (st.epoch === last.epoch && st.n < last.n))) return;
    apply(st);
  }
  function onErr(m) {
    if (m?.token !== ME?.token) return;
    toast(m.msg);
    if (S.mode === "connecting") { S.mode = "join"; S.error = m.msg; onUpdate(null); }
  }

  function apply(st) {
    last = st; lastAt = Date.now(); S.status = "";
    clockSeen = st.clock; clockAt = lastAt;
    if (lastNote === null) lastNote = st.note?.n ?? 0;
    else if (st.note && st.note.n > lastNote) { lastNote = st.note.n; (S.notes ||= []).push(st.note.msg); toast(st.note.msg); }
    LS.set(stKey(), st);
    const mine = st.players.find(p => p.token === ME?.token);
    S.me = mine?.id || null; S.isHost = !!H; S.bots = st.bots || [];
    if (mine) S.left = false;
    if (mine) { wasSeated = true; if (ME.pid !== mine.id) { ME.pid = mine.id; LS.set(meKey(), ME); BUS?.track({ pid: mine.id }); } }
    S.lobby = { code: st.code, hostId: st.hostPid, settings: st.settings, players: st.players.map(p => ({ id: p.id, name: p.name, online: isOnline(p.id) })) };
    S.online = Object.fromEntries(st.players.map(p => [p.id, isOnline(p.id)]));
    if (pending && st.n > pending.n) pending = null;
    const prev = S.view;
    if (!mine) {
      S.view = null;
      if (S.left) { S.mode = "left"; return onUpdate(prev); }
      if (st.G) { S.mode = "claim"; S.error = wasSeated ? "You're now playing on another device. Pick your seat to move back here." : ""; }
      else if (wasSeated) { S.mode = "join"; S.error = "The host removed you from the table."; }
      else S.mode = "connecting";
      return onUpdate(prev);
    }
    if (st.G) { S.view = engine.viewFor(st.G, S.me); S.mode = "game"; }
    else { S.view = null; S.mode = "lobby"; }
    onUpdate(prev);
  }

  async function connect() {
    BUS = await openBus(S.code, prefix);
    BUS.on("state", onState); BUS.on("hello", onHello); BUS.on("act", onAct); BUS.on("err", onErr); BUS.on("claim", onClaim);
    BUS.onPresence(set => {
      heard(); onlineSet = set;
      if (!last) return;
      S.online = Object.fromEntries(last.players.map(p => [p.id, isOnline(p.id)]));
      S.lobby?.players.forEach(p => (p.online = isOnline(p.id)));
      onUpdate(S.view);
    });
    BUS.onStatus(ok => { S.net = ok; if (ok && !H && ME) BUS.send("hello", { token: ME.token, name: ME.name }); onUpdate(S.view); });
    if (ME.pid) BUS.track({ pid: ME.pid });
  }

  // Heartbeat, resend, takeover watchdog.
  setInterval(() => {
    if (!BUS) return;
    const now = Date.now();
    if (now - tickAt > 4000) woke(now - tickAt);   // timers were frozen: the page slept without a visibility event
    tickAt = now;
    if (H && holding()) return;          // just woke while running the table: wait to hear whether someone took over
    if (H && rearm) {                    // nobody took over: carry on running the table, with a little grace on the turn clock
      rearm = false;
      if (H.clock) H.clock.deadline = Math.max(H.clock.deadline, now + 5000);
      schedule(); broadcast(false);
    }
    if (H) { if (H.clock && now >= H.clock.deadline && H.G) expire(); if (S.net && H) BUS.send("state", snap()); return; }
    if (pending && now - pending.at > 2500 && pending.tries < 4) { pending.tries++; pending.at = now; BUS.send("act", { token: ME.token, a: pending.a, retry: true }); }
    if (!last || !S.me || !S.net) return;
    if (wokeAt && heardAt < wokeAt) return;   // asleep until just now: our picture of the table is stale, never take over on it
    const order = last.players.filter(p => p.id !== last.hostPid && isOnline(p.id)).map(p => p.id);
    const rank = order.indexOf(S.me);
    if (rank >= 0 && now - lastAt > 7000 + rank * 3500) {
      const name = last.players.find(p => p.id === last.hostPid)?.name || "The host";
      takeOver(last, `${name} lost connection. Your device is keeping the game going.`);
    }
  }, 1000);

  // ------------------------------------------------ public API
  return {
    S,
    get isHost() { return !!H; },
    get hostSettings() { return H?.settings; },
    async create(name) {
      S.code = newCode();
      ME = { token: rid(), name, pid: "p" + rid().slice(0, 6) };
      LS.set(meKey(), ME); LS.set("g4f-name", name);
      history.replaceState(null, "", `?g=${S.code}`);
      S.mode = "connecting"; S.status = "Opening the table…"; onUpdate(null);
      try { await connect(); } catch (e) { S.mode = "landing"; S.error = e.message; return onUpdate(null); }
      H = { code: S.code, epoch: 1, n: 0, me: ME.pid, players: [{ id: ME.pid, name, token: ME.token }], settings: structuredClone(defaults), G: null };
      broadcast();
    },
    async join(name) {
      ME = LS.get(meKey()) || { token: rid() };
      ME.name = name; LS.set(meKey(), ME); LS.set("g4f-name", name);
      S.mode = "connecting"; S.error = ""; S.status = "Connecting…"; onUpdate(null);
      try { await connect(); } catch (e) { S.mode = "join"; S.error = e.message; S.status = ""; return onUpdate(null); }
      S.status = "Finding the table…"; onUpdate(null);
      BUS.send("hello", { token: ME.token, name });
      setTimeout(() => {
        if (last || H) return;
        const saved = LS.get(stKey());
        if (saved?.players?.some(p => p.token === ME.token)) { apply(saved); takeOver(saved, "Nobody else was running this table, so your device has picked it up."); }
        else { S.status = "Waiting for the table… ask a player to open the game."; onUpdate(null); }
      }, 5000);
    },
    savedName: () => LS.get(meKey())?.name || null,
    lastName: () => LS.get("g4f-name") || "",
    claim(pid) {
      if (H) { const p = H.players.find(p => p.id === pid); if (p) { p.token = ME.token; H.bots = (H.bots || []).filter(x => x !== pid); broadcast(); } return; }
      BUS?.send("claim", { token: ME.token, pid }); S.status = "Taking your seat…"; onUpdate(S.view);
    },
    act(a) {
      if (H) return applyAct(H.me, a);
      BUS?.send("act", { token: ME.token, a });
      pending = { a, n: last?.n ?? 0, at: Date.now(), tries: 0 };
    },
    start() {
      if (!H) return;
      if (H.players.length < minPlayers) return toast(`You need at least ${minPlayers} players.`);
      try { H.G = engine.newGame(H.players, H.settings); } catch (e) { return toast(e.message); }
      schedule(); broadcast();
    },
    settings(patch) { if (H && !H.G) { Object.assign(H.settings, patch); broadcast(); } },
    kick(pid) { if (H && !H.G) { H.players = H.players.filter(p => p.id !== pid); broadcast(); } },
    playFor(pid) { if (!H?.G) return; const a = engine.autoAction(H.G, pid); if (a) applyAct(pid, a, false, true); },
    backToLobby() { if (H) { H.G = null; H.bots = []; broadcast(); } },
    // Leave the table. Mid-game a bot keeps the seat warm; if this device ran the table, another player's device takes over.
    leave() {
      if (!S.me) return;
      S.left = true;
      if (H) {
        const ingame = !!H.G;
        leaveSeat(S.me);
        if (ingame && H.players.some(p => p.id !== S.me && isOnline(p.id))) { BUS?.send("state", snap()); H = null; clearTimeout(timer); clearTimeout(botTimer); }
      } else BUS?.send("act", { token: ME.token, a: { type: "_leave" } });
      S.mode = "left"; S.view = null; onUpdate(null);
    },
    // Come back after leaving: pick the seat again mid-game, or rejoin the lobby.
    rejoin() {
      S.left = false;
      if (last?.G) { S.mode = "claim"; S.error = ""; onUpdate(null); }
      else if (H) { const name = ME.name; H.players.push({ id: "p" + rid().slice(0, 6), token: ME.token, name }); broadcast(); }
      else { BUS?.send("hello", { token: ME.token, name: ME.name }); S.mode = "connecting"; S.status = "Joining…"; onUpdate(null); }
    },
    linkFor: code => `${location.origin}${location.pathname}?g=${code}`,
    // { left, total, waiting } in ms for the current turn clock, counted down locally between heartbeats.
    clock() {
      const c = H ? (H.clock && { left: H.clock.deadline - Date.now(), total: (H.settings.timer || 60) * 1000, waiting: H.clock.waiting }) : clockSeen && { ...clockSeen, left: clockSeen.left - (Date.now() - clockAt) };
      return c ? { ...c, left: Math.max(0, c.left) } : null;
    },
  };
}
