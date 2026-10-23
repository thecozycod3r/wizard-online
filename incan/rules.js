// Rules for the in-game Rules sheet. Source: Incan Gold rules (Alan R. Moon & Bruno Faidutti, Sunriver Games).
export const RULES = {
  basics: `<h3>The idea</h3>
    <p>Explore five temples for treasure. Each turn, everyone still inside secretly chooses: <b>Torch</b> — go deeper — or <b>Camp</b> — head back with what you're carrying. Treasure in your tent is safe. Treasure you're carrying is lost if the temple turns deadly.</p>
    <h3>Each turn</h3>
    <ol><li>Everyone in the temple taps <b>Torch</b> or <b>Camp</b>. Choices are revealed together.</li>
    <li><b>Campers</b> split any gems left lying on the path, then put everything they carried into their tent. If exactly one player leaves, they also grab any <b>artifacts</b> on the path.</li>
    <li>If anyone is still inside, the next card is turned:
      <ul><li><b>Treasure</b> — split equally among everyone inside; the leftover stays on the card.</li>
      <li><b>Artifact</b> — stays on the path until someone leaves alone.</li>
      <li><b>Hazard</b> — the first of its kind is a warning. A <b>second</b> one of the same kind and everyone still inside flees, <b>losing everything they carried</b> this round.</li></ul></li></ol>
    <h3>Winning</h3>
    <p>After five temples, the most treasure in your tent (plus artifacts) wins. Ties go to whoever has more artifacts.</p>`,
  cards: `<h3>The deck</h3>
    <p><b>15 Treasure cards</b>: 1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17.</p>
    <p><b>15 Hazards</b>: three each of Giant spiders, Snakes, Mummies, Fire and Rockfall.</p>
    <p><b>5 Artifacts</b>: one is added each temple. The first three to leave the temple are worth 5; the last two are worth 10. An artifact still on the path when a temple ends is lost; one that was never turned stays in the deck.</p>
    <h3>Gems</h3><p>Turquoise = 1, obsidian = 5, gold = 10.</p>
    <h3>Hazards that strike leave</h3><p>When a second Hazard of one kind ends a temple, that card is removed for the rest of the game — so that danger is a little rarer later.</p>`,
  full: `<h3>Setup</h3><p>3–8 players. Everyone starts with an empty tent. Five temples are explored in order.</p>
    <h3>Starting a temple</h3><p>The temple's artifact is shuffled into the deck. Everyone enters and the first card is turned straight away (nobody would leave before seeing anything). If that first card is a Hazard, the next card is turned too.</p>
    <h3>Choosing</h3><p>Everyone still inside secretly picks Torch or Camp. All choices are shown at once.</p>
    <h3>Leaving</h3><p>The players leaving divide all the gems left on the path equally; any that can't be divided stay on the path. They put those and everything they carried this temple into their tent, where it's safe. If only one player leaves on that turn, they take all artifacts on the path. Players who leave sit out the rest of the temple.</p>
    <h3>Exploring</h3><p>If anyone stayed, the next card is turned. Treasure is divided equally among the players inside, rounding down, with the rest left on the card. An artifact stays on the path. A Hazard does nothing unless another of the same kind is already on the path — then everyone inside flees, losing the gems they carried this temple, and that Hazard card leaves the game.</p>
    <h3>End of a temple</h3><p>A temple ends when everyone has left or when a second Hazard of one kind appears. Any artifacts on the path are lost.</p>
    <h3>Scores</h3><p>Everyone's tent is shown on the table (our house rule — in the box game tents stay secret until the end).</p>
    <h3>End of the game</h3><p>After the fifth temple, tents are opened. Most treasure wins (artifacts count 5 or 10). Ties: most artifacts.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game decides for them, weighing the danger against what they'd lose.</p>
    <p class="muted" style="font-size:14px">Incan Gold is designed by Alan R. Moon and Bruno Faidutti. Art on this site is original.</p>`,
};
