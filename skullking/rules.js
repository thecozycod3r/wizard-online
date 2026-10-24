// Rules sheet. Source: Skull King rulebook (Grandpa Beck's Games, 2021 edition) — base game without the advanced cards.
export const RULES = {
  basics: `<h3>The idea</h3><p>Ten rounds; round 1 deals one card each, round 2 two, and so on. Before each round everyone secretly <b>bids</b> how many tricks they'll take — then you try to take exactly that many.</p>
    <h3>Playing a trick</h3><ol><li>The leader plays any card. You must <b>follow the suit</b> that was led if you can — but a special card (Pirate, Skull King, Mermaid, Escape, Tigress) can always be played instead.</li>
    <li>Highest card of the led suit wins, unless someone played a <b>black Jolly Roger</b> (trump) — then the highest black wins.</li>
    <li>Specials beat all of that: <b>Pirates</b> beat every suit card and Mermaids. The <b>Skull King</b> beats Pirates. A <b>Mermaid</b> beats the Skull King (and suit cards) but loses to Pirates. If several of the same special are played, the first one wins.</li>
    <li><b>Escapes</b> always lose. If everyone escapes, the first escape wins.</li></ol>
    <h3>Scoring</h3><p>Exact bid: <b>20 points per trick</b> plus bonuses. Missed: <b>−10 per trick</b> you were off. Bid zero and take none: <b>+10 × the round</b>; take any: −10 × the round.</p>`,
  cards: `<h3>The deck — 70 cards</h3><p>Four suits numbered 1–14: <b>Parrot</b> (green), <b>Treasure Chest</b> (yellow), <b>Pirate Map</b> (purple) and the <b>Jolly Roger</b> (black, trump). Plus 5 Pirates, 1 Skull King, 2 Mermaids, 5 Escapes and the Tigress.</p>
    <h3>Tigress</h3><p>When you play her, choose: a Pirate or an Escape.</p>
    <h3>Bonuses (only if your bid is exact)</h3><p>Each 14 you capture: +10 (black 14: +20). Each Mermaid taken by your Pirate: +20. Each Pirate taken by your Skull King: +30. Taking the Skull King with a Mermaid: +40.</p>`,
  full: `<h3>Leading</h3><p>If an Escape is led, the next suit card sets the suit. If a Pirate, Skull King, Mermaid or Tigress-as-Pirate is led, there's no suit to follow that trick.</p>
    <h3>Players and rounds</h3><p>2–8 players. With 8 players the 70 cards allow 8 rounds.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game bids or plays sensibly for them.</p>
    <p class="muted" style="font-size:14px">Skull King is designed by Brent Beck and published by Grandpa Beck's Games. This is a fan-made table for friends; the art here is original.</p>`,
};
