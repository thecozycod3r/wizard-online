// Display names match the supplied Catan C&K Rules.pdf; stable IDs preserve saved games.
export const TRACKS={science:'paper',trade:'cloth',politics:'coin'};
export const PROGRESS=Object.fromEntries([
 ['alchemy','Alchemist','science',2,'Choose both production dice before rolling; the event die stays random.'],
 ['crane','Crane','science',2,'Buy one city improvement for one fewer commodity.'],
 ['engineering','Engineer','science',1,'Build one city wall free.'],
 ['invention','Inventor','science',2,'Exchange two number tokens, excluding 2, 6, 8 and 12.'],
 ['irrigation','Irrigation','science',2,'Take two wheat per distinct field beside your buildings.'],
 ['medicine','Medicine','science',2,'Upgrade a settlement for two ore and one wheat.'],
 ['mining','Mining','science',2,'Take two ore per distinct mountain beside your buildings.'],
 ['roadBuilding','Road Building','science',2,'Build up to two roads or ships free.'],
 ['smithing','Smith','science',2,'Promote up to two different eligible knights free.'],
 ['printing','Printer','science',1,'One public victory point, revealed immediately.'],
 ['commercialHarbor','Commercial Harbor','trade',2,'Once per opponent this turn, exchange a resource for a commodity of their choice.'],
 ['guildDues','Master Merchant','trade',2,'Inspect a higher-scoring opponent’s hand and take two resource or commodity cards.'],
 ['merchant','Merchant','trade',6,'Move the merchant to a producing land hex beside your building: one point and 2:1 trades.'],
 ['merchantFleet','Merchant Fleet','trade',2,'Trade one chosen resource or commodity at 2:1 this turn.'],
 ['resourceMonopoly','Resource Monopoly','trade',4,'Take up to two of one resource from each opponent.'],
 ['tradeMonopoly','Commodity Monopoly','trade',2,'Take one of one commodity from each opponent.'],
 ['diplomacy','Diplomat','politics',2,'Remove an open road or ship; if yours, rebuild the same type free.'],
 ['encouragement','Warlord','politics',2,'Activate all your inactive knights free.'],
 ['espionage','Spy','politics',3,'Inspect an opponent’s progress cards and take one.'],
 ['intrigue','Intrigue','politics',2,'Displace an enemy knight touching your route.'],
 ['sabotage','Saboteur','politics',2,'Opponents with at least your points discard half their resource/commodity cards.'],
 ['taxation','Bishop','politics',2,'Move the robber and steal one random card from each adjacent opponent.'],
 ['treason','Deserter','politics',2,'An opponent removes a knight of their choice; recruit one of equal or lower strength and the same status.'],
 ['constitution','Constitution','politics',1,'One public victory point, revealed immediately.'],
 ['wedding','Wedding','politics',2,'Each higher-scoring opponent gives you two resource/commodity cards of their choice.']
].map(([id,name,track,n,text])=>[id,{id,name,track,n,text}]));
export const DEVELOPMENT={knight:{name:'Knight',text:'Move the robber or pirate and steal a card.'},roadBuilding:{name:'Road Building',text:'Build two roads or ships free.'},yearOfPlenty:{name:'Invention',text:'Take any two available resources from the bank.'},monopoly:{name:'Monopoly',text:'Take all of one resource from every opponent.'},vp:{name:'Victory point',text:'One hidden victory point.'}};
