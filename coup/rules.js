// Rules sheet for Coup (base game plus the Reformation options in the lobby).
export const RULES = {
  basics: `<h3>Goal</h3><p>Be the last player with influence. You start with <b>2 coins</b> and <b>2 face-down characters</b> — your influence. Lose both and you're out.</p>
    <h3>Your turn</h3><p>Take one action. Character actions need you to <b>claim</b> that character — you can be telling the truth or bluffing.</p>
    <ul><li><b>Income</b> +1 coin. Can't be stopped.</li><li><b>Foreign Aid</b> +2 coins. Anyone claiming the Duke can block it.</li>
    <li><b>Coup</b> pay 7: a player loses an influence. Can't be stopped. With 10+ coins you must Coup.</li></ul>
    <h3>Reacting</h3><p>After a claim, anyone may tap <b>Challenge</b>. If the claim was true, the card is shown, shuffled back and replaced, and the challenger loses an influence. If it was a bluff, the bluffer loses an influence and the action fails.</p>
    <p>Some actions can be <b>blocked</b> by claiming a character — and blocks can be challenged too. If nobody reacts before the window closes, it goes through. Coins paid for an action stay spent even if it's blocked.</p>
    <p>Whenever you lose an influence, <b>you</b> pick which card to turn face up.</p>`,
  cards: `<h3>The characters</h3><ul>
    <li><b>Duke</b> — Tax: take 3 coins. Blocks Foreign Aid.</li>
    <li><b>Assassin</b> — pay 3: a player loses an influence. The Contessa blocks it.</li>
    <li><b>Captain</b> — steal 2 coins from a player. Blocks stealing.</li>
    <li><b>Ambassador</b> — draw 2 from the Court deck, keep any mix, return 2. Blocks stealing.</li>
    <li><b>Contessa</b> — blocks an assassination against you.</li>
    <li><b>Inquisitor</b> (option, replaces the Ambassador) — exchange 1 card with the deck, <i>or</i> examine one of a player's cards (they pick which to show) and either hand it back or make them swap it for a new one. Blocks stealing.</li></ul>
    <h3>The deck</h3><p>3 of each of the five characters for up to 6 players; 4 of each for 7–8; 5 of each for 9–10.</p>`,
  full: `<h3>Factions (Reformation option)</h3><p>Players alternate Loyalist ♛ and Reformist ⚑ round the table. While both sides are still in the game you can't Coup, Assassinate, Steal from, Examine, or block the Foreign Aid of a player on your own side. You can always challenge anyone.</p>
    <ul><li><b>Convert</b> — pay 1 to switch your own side, or 2 to switch someone else's. The coins go to the <b>Treasury Reserve</b>.</li>
    <li><b>Embezzle</b> — take everything in the reserve, claiming you do <b>not</b> have the Duke. If challenged and you do hold a Duke, you lose an influence and get nothing; if you don't, you show your cards, they're replaced, and the challenger loses an influence.</li></ul>
    <h3>Two players</h3><p>Whoever goes first starts with 1 coin instead of 2.</p>
    <h3>Timers</h3><p>Reaction windows close on their own (8, 12 or 20 seconds, set in the lobby) — anyone who hasn't reacted lets it happen. If a player runs out of turn time, the game plays a sensible move for them.</p>
    <h3>Out of the game</h3><p>When both your cards are face up you're out; your coins go back to the bank.</p>`,
};
