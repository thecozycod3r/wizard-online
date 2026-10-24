// Rules sheet for Coup. It follows the table's settings: the Inquisitor replaces the Ambassador, and Factions adds its own rules.
export function RULES(s = {}) {
  const inq = s.deck === "inquisitor", fac = s.factions === "on";
  const swap = inq
    ? `<li><b>Inquisitor</b> — exchange 1 card with the Court deck, <i>or</i> examine one of a player's cards (they pick which to show) and either hand it back or make them swap it for a new one. Blocks stealing.</li>`
    : `<li><b>Ambassador</b> — draw 2 from the Court deck, keep any mix, return 2. Blocks stealing.</li>`;
  const mode = inq || fac ? `<p class="muted">This table plays with the Reformation expansion: ${[inq && "Inquisitor", fac && "Factions"].filter(Boolean).join(" and ")}.</p>` : "";
  return {
    basics: `${mode}<h3>Goal</h3><p>Be the last player with influence. You start with <b>2 coins</b> and <b>2 face-down characters</b> — your influence. Lose both and you're out.</p>
    <h3>Your turn</h3><p>Take one action. Character actions need you to <b>claim</b> that character — you can be telling the truth or bluffing.</p>
    <ul><li><b>Income</b> +1 coin. Can't be stopped.</li><li><b>Foreign Aid</b> +2 coins. Anyone claiming the Duke can block it.</li>
    <li><b>Coup</b> pay 7: a player loses an influence. Can't be stopped. With 10+ coins you must Coup.</li>
    ${fac ? `<li><b>Convert</b> pay 1 to switch your own side, or 2 to switch someone else's.</li><li><b>Embezzle</b> take the Treasury Reserve, claiming you <i>don't</i> have the Duke.</li>` : ""}</ul>
    ${fac ? `<h3>Factions</h3><p>Everyone is a Loyalist ♛ or a Reformist ⚑. While both sides are still in, you can't target or block your own side — only the other one. Challenges are always open to anyone.</p>` : ""}
    <h3>Reacting</h3><p>After a claim, anyone may tap <b>Challenge</b>. If the claim was true, the card is shown, shuffled back and replaced, and the challenger loses an influence. If it was a bluff, the bluffer loses an influence and the action fails.</p>
    <p>Some actions can be <b>blocked</b> by claiming a character — and blocks can be challenged too. If nobody reacts before the window closes, it goes through. Coins paid for an action stay spent even if it's blocked.</p>
    <p>Whenever you lose an influence, <b>you</b> pick which card to turn face up.</p>`,
    cards: `<h3>The characters</h3><ul>
    <li><b>Duke</b> — Tax: take 3 coins. Blocks Foreign Aid.</li>
    <li><b>Assassin</b> — pay 3: a player loses an influence. The Contessa blocks it.</li>
    <li><b>Captain</b> — steal 2 coins from a player. Blocks stealing.</li>
    ${swap}
    <li><b>Contessa</b> — blocks an assassination against you.</li></ul>
    <h3>The deck</h3><p>3 of each of the five characters for up to 6 players; 4 of each for 7–8; 5 of each for 9–10.</p>`,
    full: `${fac ? `<h3>Factions</h3><p>Players alternate Loyalist ♛ and Reformist ⚑ round the table. While both sides are still in the game you can't Coup, Assassinate, Steal from, Examine, or block the Foreign Aid of a player on your own side. You can always challenge anyone. Once everyone left is on one side, it's every player for themselves.</p>
    <ul><li><b>Convert</b> — pay 1 to switch your own side, or 2 to switch someone else's. The coins go to the <b>Treasury Reserve</b>.</li>
    <li><b>Embezzle</b> — take everything in the reserve, claiming you do <b>not</b> have the Duke. If challenged and you do hold a Duke, you lose an influence and get nothing; if you don't, you show your cards, they're replaced, and the challenger loses an influence.</li></ul>` : ""}
    <h3>Two players</h3><p>Whoever goes first starts with 1 coin instead of 2.</p>
    <h3>Timers</h3><p>Reaction windows close on their own (8, 12 or 20 seconds, set in the lobby) — anyone who hasn't reacted lets it happen. If a player runs out of turn time, the game plays a sensible move for them.</p>
    <h3>Out of the game</h3><p>When both your cards are face up you're out; your coins go back to the bank.</p>
    ${!inq || !fac ? `<h3>Reformation expansion</h3><p>The host can switch these on in the lobby: ${[!inq && "<b>Inquisitor</b> in place of the Ambassador", !fac && "<b>Factions</b> (Loyalists vs Reformists, with Convert, Embezzle and the Treasury Reserve; 3+ players)"].filter(Boolean).join(", and ")}. The rules here change to match.</p>` : ""}`,
  };
}
