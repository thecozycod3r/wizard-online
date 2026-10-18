# Games4free

Free card games to play with friends in the browser: start a table, share the link, play. No accounts.

| Path | Game |
|---|---|
| `/` | Games4free hub |
| `/wizard/` | Wizard — AMIGO 30th-anniversary rules, all 9 special cards |
| `/lodestone/` | Lodestone — Splendor rules with an ore theme; twin-deck mode for 5–6 players |
| `/marvels/` | Seven Marvels — 7 Wonders rules (3–7 players, simultaneous picks), original cities and art |
| `/shared/` | Table logic every game uses: `room.js` (lobby, share link, join by name, failover, seat reclaim, turn timer) and `net.js` (Supabase Realtime) |

Every game exports a pure engine (`newGame, act, viewFor, waitingOn, autoAction, smartAction`) and builds its UI on `shared/room.js`.

Tests (serve this folder with `python3 -m http.server 8765` first):
- `node wizard/test/sim.mjs`, `node wizard/test/smart.mjs`, `node lodestone/test/sim.mjs`, `node marvels/test/sim.mjs` — rules engines
- `python3 wizard/test/mobile.py <url> 3 <players>`, `python3 lodestone/test/e2e.py <url> <players>`, `python3 marvels/test/e2e.py <url> <players>` — full games on emulated phones
- `python3 wizard/test/failover.py <url>`, `python3 lodestone/test/failover.py <url>`, `python3 marvels/test/failover.py <url>` — host drops, takeover, rejoin from a phone
- `python3 shared/test/timer.py <game> [url]` — turn timer + takeover mid-countdown
- `python3 shared/test/edge.py <game> [url]` — 16 edge cases
- `python3 shared/test/fx.py <game> [url]` — animation probe: every effect a full game should show
- `python3 shared/test/leave.py <game> [url]` — a player leaves mid-game (bot takes the seat), the host leaves, the player rejoins

- `python3 shared/test/swipe.py <game> [url]` — phone swipes on every side-scrolling row (starting on a card) while moves land: the row follows the finger, stays put through updates, never picks a card up.
- `python3 shared/test/ergo.py <game> [url]` — full table, every seat on a different screen (SE, Pixel, phone sideways, iPad, laptop, S9+, Pro Max): no sideways scroll, tap targets ≥32px, no text <10px, nothing tappable covered, own area on screen. Screenshots to the scratchpad.
- `python3 shared/test/resume.py <game> [url]` — a phone goes to the background (page frozen, 40 s) mid-game, as a guest and as the device running the table: it catches up, the game never goes backwards, the table never splits. `QUIET=1` sleeps with no offline/visibility events.
- `python3 shared/test/slow.py <game> [url]` — joining on slow 4G (1.6 Mbps, 150 ms): join form, table and on-screen pictures timings, plus a 5 s signal drop.
- `SCALE=1.3 python3 shared/test/ergo.py <game>` — the ergonomics sweep with the phone's large-text setting.

## Avalon (`avalon/`)
The Resistance: Avalon, 5–10 players. Pure engine `avalon/engine.js`; screens `avalon/app.js`; drawn crests `avalon/art.js` (painted art slots in when OpenAI credits are back — set `PAINTED`).
- `node avalon/test/sim.mjs` — 3,000 games at 5–10 players + rule checks (roles, knowledge, votes/ties, five rejections, two-fail quest, Lady, Assassin, no role leaks in views).
- `python3 avalon/test/e2e.py <url> <N> [min] [nice]` — N phones play through the UI (`nice`: Evil never fails, so the Assassin acts).
- `python3 avalon/test/failover.py [url]` — host drops, takeover, host rejoins from a phone.
- Shared suites take `avalon` (5 players where others use 4). `swipe.py` doesn't apply: Avalon's table has no sideways rows.

## Incan Gold (`incan/`)
Incan Gold (Moon & Faidutti), 3–8 players. Engine `incan/engine.js`; screens `incan/app.js`; drawn art `incan/art.js`. Between temples the table runner moves on by itself (`E.pause` → room `timers`).
- `node incan/test/sim.mjs` — 4,000 games at 3–8 players + rule checks (splits and leftovers, lone-leaver artifacts, 5/10 artifact values, double hazards, removed hazards, lost/undrawn artifacts, private tents).
- `python3 incan/test/e2e.py <url> <N>` · `python3 incan/test/failover.py [url]` · shared suites take `incan` (no sideways rows, so no swipe test).
