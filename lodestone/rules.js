// Lodestone rules text (Splendor rules, ore theme). Rewritten in our own words from the 2014 rulebook,
// plus a 5–6 player setup that keeps the single deck (no card ever appears twice).

const ORE_LIST = `<b>Silver</b> (white), <b>Cobalt</b> (blue), <b>Malachite</b> (green), <b>Cinnabar</b> (red), <b>Iron</b> (black), and <b>Gold</b> as the wild token`;

export function setupTable(n) {
  const rows = [
    ["Players", "2", "3", "4", "5–6"],
    ["Each ore in the bank", "4", "5", "7", "7"],
    ["Gold", "5", "5", "5", "5"],
    ["Nobles on the table", "3", "4", "5", "players + 1"],
    ["Face-up cards (L1 / L2 / L3)", "4 / 4 / 4", "4 / 4 / 4", "4 / 4 / 4", "5 / 4 / 4"],
    ["Cards in the decks", "40 / 30 / 20", "40 / 30 / 20", "40 / 30 / 20", "40 / 30 / 20"],
  ];
  const col = n >= 5 ? 4 : n - 1;
  return `<div class="tbl"><table>${rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 ? `<th${j === col ? ' style="color:var(--brass-2)"' : ""}>${c}</th>` : `<td${j === col ? ' style="color:var(--brass-2);font-weight:700"' : ""}>${c}</td>`)).join("")}</tr>`).join("")}</table></div>`;
}

export const RULES = {
  basics: `
    <h3>Goal</h3><p>You're a merchant of the ore trade. Gather ores, build mines, workshops and guilds, and win visits from nobles. <b>The first player to reach 15 prestige points triggers the final round</b>; the richest merchant after it wins.</p>
    <h3>On your turn, do exactly one thing</h3>
    <ol>
      <li><b>Take 3 different ores</b> from the bank.</li>
      <li><b>Take 2 of the same ore</b>, but only if that pile has at least 4 before you take.</li>
      <li><b>Reserve a card</b> from the table (or the top card of a deck, kept secret) and take 1 Gold.</li>
      <li><b>Build (buy) a card</b> from the table or from your reserved cards.</li>
    </ol>
    <h3>Why cards matter</h3><p>Every card you build gives you a permanent <b>bonus</b> of its ore (the coloured gem in its corner). Each bonus counts as one ore of that colour on every future purchase, forever. Many cards are also worth prestige points (the number in the top-left).</p>
    <h3>Nobles</h3><p>At the end of your turn, if your <b>bonuses</b> (not tokens) meet a noble's requirement, that noble visits you automatically: +3 points.</p>
    <h3>On this table</h3><ul>
      <li>Tap ores in the bank to pick them, then <b>Take</b>. Tap the same ore twice for 2 of a kind.</li>
      <li>Tap a card for Buy or Reserve. A green tick means you can afford it now. You can also drag a card onto your ledger to buy it.</li>
      <li>Tap a deck to reserve its top card blind. Tap any player to see their full ledger.</li>
    </ul>`,
  actions: `
    <h3>Taking ores</h3><ul>
      <li>3 ores of 3 different colours. If fewer than 3 colours are left in the bank, take one of each colour that's left.</li>
      <li>Or 2 ores of one colour, only when that pile holds 4 or more before you take.</li>
      <li>You can't take Gold this way. Gold only comes from reserving.</li>
      <li><b>10-token limit:</b> at the end of your turn you may hold at most 10 tokens (Gold included). Return any extra; you choose which, even ones you just took.</li></ul>
    <h3>Reserving</h3><ul>
      <li>Take a face-up card into your hand, or the top card of any deck without showing it, and take 1 Gold if there's any left.</li>
      <li>You can hold at most 3 reserved cards. The only way to get rid of one is to buy it.</li>
      <li>You can still reserve when the Gold is gone; you just don't get one.</li></ul>
    <h3>Building (buying)</h3><ul>
      <li>Pay the card's cost minus your bonuses. Gold pays for any one ore.</li>
      <li>Spent tokens go back to the bank. With enough bonuses a card can cost nothing at all.</li>
      <li>You can buy a face-up card or one of your own reserved cards.</li>
      <li>A card taken from the table is replaced straight away from the same deck.</li></ul>`,
  nobles: `
    <h3>Noble visits</h3><ul>
      <li>Checked at the end of your turn, after any token return.</li>
      <li>Only bonuses from built cards count, never tokens.</li>
      <li>A visit can't be refused, isn't an action, and is worth 3 points.</li>
      <li>At most one noble per turn. If you qualify for several, you choose.</li></ul>
    <h3>End of the game</h3><ul>
      <li>When someone reaches 15 points, finish the current round so everyone has had the same number of turns.</li>
      <li>Highest prestige wins (cards + nobles).</li>
      <li>Tie: the player who built <b>fewer</b> cards wins. Still tied: you share the win.</li></ul>`,
  full: `
    <h3>Components</h3><p>Ore tokens: ${ORE_LIST}. 90 development cards in three levels (40 level-1, 30 level-2, 20 level-3) and 10 nobles. With 5–6 players two full sets are shuffled together.</p>
    <h3>Setup</h3><p>Shuffle each level into its own deck. Lay out the face-up cards for each level, reveal the nobles, and sort the tokens into the bank:</p>
    <!--SETUP-->
    <p>The first player is chosen at random; play goes around the table in seat order.</p>
    <h3>A turn</h3><p>Choose exactly one action: take 3 different ores, take 2 of one ore (pile of 4 or more), reserve a card and take a Gold, or build a card. Then return tokens down to 10 if needed, then check for a noble visit.</p>
    <h3>Development cards</h3><p>Each card shows its prestige points (top-left), its bonus ore (top-right) and its cost (left side). Bonuses permanently reduce the cost of future cards by one of that ore each. When a face-up card is bought or reserved, refill its space from the same deck. When a deck runs out, its spaces stay empty.</p>
    <h3>Reserved cards</h3><p>Up to 3 per player. A card reserved from the top of a deck is kept secret from other players. Reserved cards can't be discarded, only bought.</p>
    <h3>Nobles</h3><p>Each noble requires a set of bonuses, for example 4 Silver and 4 Cobalt, or 3 Cobalt, 3 Malachite and 3 Cinnabar. At the end of your turn, if you meet a noble's requirement it visits you (3 points). One per turn; you choose if several qualify. Visits can't be refused.</p>
    <h3>Winning</h3><p>Reaching 15 points triggers the end: the round is completed so that every player has had the same number of turns. Most points wins; ties go to the player with the fewest built cards.</p>
    <h3>5–6 players</h3><ul>
      <li>Same single set of 90 cards — no card ever appears twice.</li>
      <li>The table shows 5 level-1 cards and 4 each of levels 2 and 3.</li>
      <li>Reveal nobles equal to the number of players + 1.</li>
      <li>Use 7 tokens of each ore; Gold stays at 5.</li>
      <li>First to 15 points triggers the final round.</li>
      <li>With six players the cards can run out. If a deck is empty and six whole rounds pass with nobody building or reserving, the game ends and the highest score wins.</li></ul>
    <p class="muted" style="font-size:14px">Splendor is a game by Marc André (Space Cowboys, 2014). This version uses an ore theme; the card scenes and artwork are original to this site.</p>`,
};
