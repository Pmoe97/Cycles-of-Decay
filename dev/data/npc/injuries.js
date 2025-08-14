/* dev/data/npc/injuries.js */
window.setup = window.setup || {};
setup.data = setup.data || {};
setup.data.injuries = setup.data.injuries || [
  {"id":"sprained_ankle","location":"l_leg","severityRange":[0.2,0.6],"mods":{"AGI":-1,"move_mult":0.8},"tags":["injury","mobility"],"defaultTreat":["rest","wrap","painkiller"]},
  {"id":"fractured_wrist","location":"r_arm","severityRange":[0.3,0.7],"mods":{"AGI":-1,"STR":-1,"melee_pct":-0.2},"tags":["injury","dexterity"],"defaultTreat":["splint","rest"]},
  {"id":"concussion_mild","location":"head","severityRange":[0.1,0.3],"mods":{"INT":-1,"WIS":-1,"awareness_pct":-0.1},"tags":["injury","cognitive"],"defaultTreat":["rest","dark_room"]}
];
