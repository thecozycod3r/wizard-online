// Bot-vs-bot Bluff games at every table size and deck count: cards are conserved, refused moves change nothing, every game ends.
import * as E from "../engine.js";
const N = +(process.argv[2] || 200);
let games = 0, turns = 0, maxT = 0, bad = 0;
for (let n = E.MIN_PLAYERS; n <= E.MAX_PLAYERS; n++) for (const decks of [0, 1, 2, 3]) for (let g = 0; g < N / 40; g++) {
  const G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { decks });
  const total = 52 * G.decks;
  let t = 0;
  while (G.phase !== "gameOver") {
    const pid = E.waitingOn(G)[0];
    const a = Math.random() < 0.5 ? E.botAction(G, pid) : E.smartAction(G, pid);
    E.act(G, pid, a);
    // a random illegal move must be refused without touching the state
    const before = JSON.stringify(G), who = G.players[Math.floor(Math.random() * n)].id;
    const junk = [{ type: "play", cards: [] }, { type: "play", cards: ["99Z"] }, { type: "call" }, { type: "pass" }, { type: "play", cards: G.hands[who].slice(0, 5), rank: 7 }, null][Math.floor(Math.random() * 6)];
    if (G.phase !== "gameOver" && who !== E.waitingOn(G)[0]) { try { E.act(G, who, junk); bad++; } catch { /* refused */ } if (JSON.stringify(G) !== before) throw new Error("refused move changed state"); }
    const held = Object.values(G.hands).reduce((s, h) => s + h.length, 0);
    if (held + G.pile.length + G.cleared !== total) throw new Error(`cards lost: ${held}+${G.pile.length}+${G.cleared} != ${total}`);
    if (++t > 5000) throw new Error(`no end n=${n} decks=${G.decks}`);
  }
  games++; turns += t; maxT = Math.max(maxT, t);
}
console.log({ games, avgTurns: (turns / games).toFixed(0), maxT, acceptedJunk: bad });
