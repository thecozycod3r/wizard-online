// Rules sheet for Ride the Bus — the common party version.
export const RULES = {
  basics: `<h3>Stage 1 — four rounds of guesses</h3><p>Going round the table, each player guesses about the next card dealt to them:</p>
    <ol><li><b>Red or black?</b> (1 drink)</li><li><b>Higher or lower</b> than your first card? (2)</li><li><b>Inside or outside</b> your first two? (3)</li><li><b>Which suit?</b> (4)</li></ol>
    <p>Right: hand that many drinks to someone. Wrong: drink them yourself. Equal ranks count as wrong.</p>
    <h3>Stage 2 — the pyramid</h3><p>Ten cards in rows of 4-3-2-1 are flipped one at a time. If you hold a card of the same rank, play it and hand out the row's drinks (1 on the bottom row up to 4 at the top).</p>
    <h3>Stage 3 — the bus</h3><p>Whoever is left holding the most cards rides the bus: the same four guesses on fresh cards, all four right in a row to get off. Every miss is a drink and back to the start (the bus lets you off after 10 misses).</p>
    <p class="muted">Drink responsibly — sips count, water counts, and nobody has to drink.</p>`,
  cards: `<h3>Card values</h3><p>Aces are low (1), then 2–10, Jack 11, Queen 12, King 13. One standard 52-card deck, reshuffled if it runs out.</p>
    <h3>The four guesses</h3><ul><li><b>Red or black</b> — hearts and diamonds are red, spades and clubs black.</li>
    <li><b>Higher or lower</b> — compared with your first card. The same rank is wrong.</li>
    <li><b>Inside or outside</b> — between your first two cards, or beyond them. Landing on either edge is wrong.</li>
    <li><b>Which suit</b> — one of four, so the hardest guess and worth 4 drinks.</li></ul>
    <h3>The pyramid</h3><p>Bottom row is worth 1 drink per card, then 2, 3, and the single top card 4. Each matching card you lay down hands out that row's drinks.</p>`,
  full: `<h3>Ties for the bus</h3><p>If several players hold the most cards, one of them is picked at random.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game guesses with the odds (or keeps their card) for them.</p>`,
};
