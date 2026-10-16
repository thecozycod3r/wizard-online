# Games4free

Free card games to play with friends in the browser: start a table, share the link, play. No accounts.

| Path | Game |
|---|---|
| `/` | Games4free hub |
| `/wizard/` | Wizard — AMIGO 30th-anniversary rules, all 9 special cards |
| `/lodestone/` | Lodestone — Splendor rules with an ore theme; twin-deck mode for 5–6 players |
| `/shared/` | Table logic every game uses: `room.js` (lobby, share link, join by name, failover, seat reclaim, turn timer) and `net.js` (Supabase Realtime) |

Every game exports a pure engine (`newGame, act, viewFor, waitingOn, autoAction, smartAction`) and builds its UI on `shared/room.js`.

Tests (serve this folder with `python3 -m http.server 8765` first):
- `node wizard/test/sim.mjs`, `node wizard/test/smart.mjs`, `node lodestone/test/sim.mjs` — rules engines
- `python3 wizard/test/mobile.py <url> 3 <players>`, `python3 lodestone/test/e2e.py <url> <players>` — full games on emulated phones
- `python3 wizard/test/failover.py <url>`, `python3 lodestone/test/failover.py <url>` — host drops, takeover, rejoin from a phone
- `python3 shared/test/timer.py <game> [url]` — turn timer + takeover mid-countdown
- `python3 shared/test/edge.py <game> [url]` — 16 edge cases
