# Wizard Online

Play Wizard (AMIGO 30th-anniversary rules, all nine special cards) with friends in the browser.
Start a game, share the link, everyone types a name and plays. Drag cards to the table; the Guide button explains every special card at any time.

- `engine.js` — pure rules engine (runs in the host's browser). `node test/sim.mjs` plays 3,000 random games against it.
- `net.js` — transport: Supabase Realtime broadcast (config.js), PeerJS fallback.
- `app.js` / `index.html` — UI. `python3 test/e2e.py` plays a 4-player game across real browsers.

Card art is original (AI-generated) for this project. Wizard is a game by Ken Fisher, published by AMIGO.
