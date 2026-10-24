// Rules sheet. Source: 6 nimmt! rules (Wolfgang Kramer, AMIGO).
export const RULES = {
  basics: `<h3>The idea</h3><p>Take as few bull heads as you can. Every card shows 1 to 7 bull heads; the fewer you collect, the better.</p>
    <h3>Each turn</h3><ol><li>Everyone picks one card from their hand. Nobody sees the others until all have picked.</li>
    <li>The cards are placed one at a time, <b>lowest first</b>. Each goes on the row whose last card is the <b>highest number still below it</b>.</li>
    <li>If that row already has five cards, your card is the <b>sixth</b>: you take the five cards (and their bull heads) and your card starts the row.</li>
    <li>If your card is lower than the end of every row, you <b>choose</b> any row to take, and your card starts it.</li></ol>
    <h3>Winning</h3><p>Ten turns make a round. The host picks one round, or play until someone reaches 66 (or 100) — then the fewest bull heads wins.</p>`,
  cards: `<h3>The deck</h3><p>104 cards, numbered 1 to 104. Each deals ten to every player and four start the rows.</p>
    <h3>Bull heads</h3><p><b>55</b>: 7 · <b>11, 22, 33, 44, 66, 77, 88, 99</b>: 5 · <b>10, 20 … 100</b>: 3 · <b>5, 15 … 95</b>: 2 · everything else: 1. The whole deck holds 171.</p>`,
  full: `<h3>Players</h3><p>2–10. With 10 players every card is in play.</p>
    <h3>Taking a row by choice</h3><p>Pick the row that costs you least — or the one that hurts the next players most.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game picks the safest-looking card for them.</p>
    <p class="muted" style="font-size:14px">6 nimmt! is designed by Wolfgang Kramer and published by AMIGO. This is a fan-made table for friends; the card faces are drawn from scratch.</p>`,
};
