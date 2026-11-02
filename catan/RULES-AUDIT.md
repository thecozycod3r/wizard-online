# Official-rules implementation — 2026-11-02

The v3 custom game has been replaced by a v4 engine based on the English sixth-edition CATAN rules. The old contracts, silver market, seasons, depletion, freely sailing boats, beacon donations, and burned outposts are gone.

## Supported games

- Base CATAN: 3–4 players, or 5–6 using the paired-turn extension; 10 VP.
- Seafarers: **Heading for New Shores**, with its 3-, 4-, and 5–6-player maps, main-island setup, gold fields, pirate, shipping routes, and first-settlement island bonuses; 14 VP.
- Cities & Knights: standard expansion, independently or combined with Seafarers; 13 VP on the base board and 16 VP on Heading for New Shores.
- All 54 progress cards (23 different action cards and two public VP cards), the base development deck, knight actions, city improvements, metropolises, walls, and barbarian defense.

Other Seafarers campaign scenarios are not offered. Two-player variants are not offered: the official base game starts at three players. Larger tables use the official extension rather than an invented large-map mode.

## Implementation

- `geometry.js`: canonical axial hexes, intersections, and edges shared by engine and rendering.
- `maps.js`: scenario land/number layouts, home-island generation for base and 5–6-player games, and ports.
- `cards.js`: card catalog and deck composition.
- `engine.js`: transactional rules, finite bank, private views, required player choices, and bots. Event-die choices finish before production. A rejected action restores the entire prior state.
- `app.js`: board placement, trade offers, bank trades, cards, city/knight controls, mandatory choices, and the event/production dice display.
- `world.js`: buildings at intersections; roads and ships on shared edges; cities, walls, metropolises, knights, ports, merchant, robber, pirate, and visible land/sea boundaries.

New tables use the `catan-v4-` storage/channel prefix. Existing custom saves are not converted or deleted. The new engine rejects mutations against a v3 state and presents a new-table message if one is opened.

The card catalog now uses the names in the user-supplied `Catan C&K Rules.pdf` (Alchemist, Engineer, Inventor, Printer, Smith, Master Merchant, Commodity Monopoly, Bishop, Deserter, Diplomat, Saboteur, Spy, and Warlord). Internal card IDs remain stable so existing v4 saves still work.

## Validation

Latest local run: 32 rules tests, 16 placement configurations, 32 complete simulated games, and 8 fuzz games passed. Desktop (1200 × 850) and phone (390 × 844) browser checks passed with no misplaced buildings or ships and no browser errors. Live multiplayer transport was not exercised by these browser tests.

```sh
node --test catan/test/rules.mjs
node catan/test/placement.mjs
node catan/test/sim.mjs 2
node catan/test/fuzz.mjs 8
python3 -m http.server 8766 --bind 127.0.0.1
# In another terminal, with Playwright available:
node catan/test/browser.mjs http://127.0.0.1:8766/catan/
```

The deterministic rules suite covers production/shortages, gold, robber/discards, setup, costs, ports, route transitions and circles, shipping limits, island scoring, knight actions, barbarian resolution, metropolis transfer, event-die draws, every action-card effect, hand limits, paired turns, private views, trades, and legacy rejection. Simulations check conservation of every resource/commodity, piece limits, placement, and completion in every supported player-count/module combination. Fuzz tests verify rollback of illegal actions.

Browser tests use isolated local state, click the actual 3D board on desktop and phone, exercise build/card/bank controls, check errors and overflow, and compare rendered building/ship coordinates against engine intersections/edges. They do not create public multiplayer tables.

## Primary references

- [Official rulebook library](https://www.catan.com/understand-catan/game-rules)
- [Base CATAN, sixth edition](https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf)
- [Seafarers, sixth edition](https://www.catan.com/sites/default/files/2025-03/CN3083%20CATAN%E2%80%93Seafarers%20Rulebook%202025%20secured%20reduced.pdf)
- [Cities & Knights, sixth edition](https://www.catan.com/sites/default/files/2025-03/CN3087%20CATAN%E2%80%93Cities%26Knights_%20Rulebook.pdf)
- [Base 5–6-player extension](https://www.catan.com/sites/default/files/2025-03/CN3082%20CATAN%20%E2%80%93%205-6%20Rulebook%202025%20reduced.pdf)
- [Seafarers 5–6-player extension](https://www.catan.com/sites/default/files/2025-03/CN3084%20CATAN%20%E2%80%93%20Seafarers_%205-6%20Player_%20Rulebook.pdf)
- [Cities & Knights 5–6-player extension](https://www.catan.com/sites/default/files/2025-03/CN3088%20CATAN%E2%80%93Cities%20%26%20Knights%205-6_%20Rulebook.pdf)
- [Official Seafarers FAQ (including circular shipping routes)](https://www.catan.com/faq/seafarers)

## Supplied PDF comparison — 2026-11-03

Reference: `/Users/dhruvshricharan/Downloads/Catan C&K Rules.pdf`, eight image-only pages, read visually in full. This is a concise illustrated rules reference; its linked pages are not embedded in the PDF. Details it does not specify retain the existing rulebook behavior.

| PDF pages / sections | Implementation checked |
| --- | --- |
| 1, sections 1–3 | Starting settlement then city; two production dice plus event die; three barbarian faces and three colored faces. |
| 2, sections 4–5 | City-only paper/cloth/coin production, commodity trading and discard counting, city requirement for improvements, barbarian movement and strength. |
| 3, section 6 | Knight costs, placement, road interruption, activation delay, two pieces per rank, promotion limit and Fortress requirement, movement, displacement and robber chase; Deserter can supply a mighty knight without Fortress. |
| 4, sections 7–9 | Defense uses active strength, tied defender rewards, vulnerable city losses, metropolis protection, deactivation/reset, forced rebuilding with five settlements, early robber protection, wall costs and limits. |
| 5, section 10 | Commodity tracks and costs 1–5; Aqueduct, Trading House and Fortress abilities. |
| 6, sections 11–12 | Metropolis claims/transfers/protection and available-city requirement; 18 cards per deck, red-die thresholds, four-card end-of-turn limit, immediate out-of-turn discard, public VP cards outside the hand. |
| 7–8, sections 13–15 | All 25 progress-card types, quantities, display names and effects. Each Crane discounts one improvement; discounts cannot stack on one purchase. |
| 8, section 16 | 13-point C&K victory on the player's own turn and scoring sources. The PDF explicitly allows different targets when combined with Seafarers; Heading for New Shores remains 16. |

Corrections: aligned progress-card display names and in-game help with this PDF. Fixed the rebuild controls and Medicine eligibility when a destroyed city reserves the fourth city piece: the mandatory rebuild is now available even though the free city-piece count is zero. Existing action validation already allowed that rebuild.

Added regression coverage for the PDF's exact card names/counts, every red-die threshold across all three tracks and six levels, and both paid/Medicine rebuilding with all city pieces occupied or reserved.

PDF-alignment validation: all 35 rules tests passed; 16 complete games (8,551 legal actions) passed across every supported player-count/module combination.
