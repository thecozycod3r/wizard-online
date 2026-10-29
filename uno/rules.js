// In-game Rules sheets. Sources: Mattel instruction sheets GDR44 / GDG37 (UNO Flip) and HVW18 (UNO Show 'Em No Mercy).
const uno = `<h3>Calling UNO</h3><p>When you have two cards and are about to play one, tap <b>UNO!</b> first. Forget, and anyone can tap <b>Catch</b> before the next move — you draw 2. Tap the big UNO button quickly to save yourself.</p>`;

export const FLIP = {
  basics: `<h3>The idea</h3>
    <p>Get rid of all your cards. Match the top card by <b>colour, number or symbol</b>, or play a Wild. The deck has two sides: you start on the <b>Light Side</b>; a <b>Flip</b> card turns every card over to the <b>Dark Side</b>, where the penalties are much nastier — until someone flips back.</p>
    <h3>Your turn</h3>
    <ol><li>Tap a glowing card to play it. Wilds ask you for a colour.</li>
    <li>Can't (or don't want to) play? Tap <b>Draw</b>. If the card fits you can play it, or pass.</li></ol>
    <h3>Stacking (our house rule)</h3>
    <p>A Draw card can be passed on with the <b>same card</b>: Draw One on Draw One, Wild Draw Two on Wild Draw Two, Draw Five on Draw Five, Wild Draw Color on Wild Draw Color. The penalty adds up; whoever can't stack takes the lot and loses their turn.</p>
    ${uno}
    <h3>Winning</h3><p>First out of cards wins the round and scores the cards left in everyone else's hands. The host picks one round, or first to 250 / 500.</p>`,
  cards: `<h3>Light Side</h3>
    <p><b>Draw One</b> — next player draws 1 and loses their turn. <b>Skip</b> — next player loses their turn. <b>Reverse</b> — direction changes (with two players it's a Skip). <b>Flip</b> — everything turns over. <b>Wild</b> — pick the colour. <b>Wild Draw Two</b> — pick the colour; next player draws 2 and loses their turn.</p>
    <h3>Dark Side</h3>
    <p><b>Draw Five</b> — next player draws 5 and loses their turn. <b>Skip Everyone</b> — everyone else is skipped; you go again. <b>Reverse</b>, <b>Flip</b>, <b>Wild</b> as on the Light Side. <b>Wild Draw Color</b> — pick a colour; the next player draws until they get that colour, and loses their turn.</p>
    <h3>The catch on Wild Draw cards</h3><p>Wild Draw Two and Wild Draw Color can only be played when you hold <b>no card of the current colour</b> (numbers or actions that match are fine). Stacking one on the same card is always allowed.</p>
    <h3>Points</h3><p>Number cards: face value · Draw One 10 · Draw Five, Skip, Reverse, Flip 20 · Skip Everyone 30 · Wild 40 · Wild Draw Two 50 · Wild Draw Color 60. Scored on the side the round ends on.</p>`,
  full: `<h3>Setup</h3><p>2–10 players, 7 cards each. The first number card turned starts the pile. The cards in your hand face you; everyone else sees their other side — so you can see the other side of everyone's hand, and they can see yours.</p>
    <h3>Flipping</h3><p>When a Flip is played, the discard pile, the draw pile and every hand turn over. The bottom card of the discard pile becomes the new top. If that card is a Wild, the player who flipped picks the colour.</p>
    <h3>Drawing</h3><p>You may draw instead of playing. If the drawn card fits, you may play it straight away; otherwise your turn ends.</p>
    <h3>Last card</h3><p>If your last card is a Draw card, the next player still draws before the round is scored.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game plays a sensible move for them.</p>
    <p class="muted" style="font-size:14px">UNO and UNO Flip are made by Mattel. This is a fan-made table for friends; the card faces here are drawn from scratch.</p>`,
};

export const MERCY = {
  basics: `<h3>The idea</h3>
    <p>UNO with no mercy. Get rid of all your cards — or knock everyone else out. Match the top card by <b>colour, number or symbol</b>.</p>
    <h3>Your turn</h3>
    <ol><li>Tap a glowing card to play it.</li>
    <li>Nothing fits? Tap <b>Draw</b> to take one card. If it fits you can play it, or pass; otherwise your turn ends.</li></ol>
    <h3>Stacking</h3><p>Hit with a Draw card (+2, +4, +6, +10)? Play any Draw card worth the <b>same or more</b>, any colour, and the total passes on. Whoever can't stack takes it all and loses their turn.</p>
    <h3>Mercy</h3><p>Reach <b>25 cards</b> and you're out of the game.</p>
    ${uno}
    <h3>Winning</h3><p>First with no cards — or last one standing — wins.</p>`,
  cards: `<h3>Numbers</h3><p><b>7</b> — swap hands with a player you choose. <b>0</b> — every player passes their hand to the next player in the direction of play.</p>
    <h3>Coloured actions</h3><p><b>Skip</b> · <b>Reverse</b> (a Skip with two players) · <b>Draw 2</b> · <b>Draw 4</b> (coloured, not a Wild) · <b>Skip Everyone</b> — you go again · <b>Discard All</b> — every card of that colour leaves your hand too.</p>
    <h3>Wilds</h3><p><b>Wild Draw 6</b> and <b>Wild Draw 10</b> — pick a colour; the next player draws. <b>Wild Reverse Draw 4</b> — direction flips, then the next player draws 4. <b>Wild Colour Roulette</b> — the next player names a colour and draws until it turns up (wilds don't count), then loses their turn. Roulette can't join a stack.</p>
    <h3>The deck</h3><p>168 cards: 0–9 twice in each colour; 3 each of Skip, Reverse, Draw 2, Discard All and 2 each of Draw 4 and Skip Everyone per colour; 8 Colour Roulette, 8 Wild Reverse Draw 4, 4 Wild Draw 6, 4 Wild Draw 10.</p>`,
  full: `<h3>Setup</h3><p>2–6 players, 7 cards each. The first number card turned starts the pile.</p>
    <h3>Knocked out</h3><p>A knocked-out player's hand is set aside and goes back into the draw pile the next time it's reshuffled. Swaps (7s and 0s) can knock players out too.</p>
    <h3>Last card</h3><p>If your last card is a Draw card, the next player still draws.</p>
    <h3>Turn timer</h3><p>If someone runs out of time, the game plays a sensible move for them.</p>
    <p class="muted" style="font-size:14px">UNO and UNO Show 'Em No Mercy are made by Mattel. This is a fan-made table for friends; the card faces here are drawn from scratch.</p>`,
};
