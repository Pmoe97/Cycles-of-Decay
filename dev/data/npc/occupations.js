/* dev/data/npc/occupations.js */
window.setup = window.setup || {};
setup.data = setup.data || {};
setup.data.occupations = setup.data.occupations || [
  {"id":"paramedic","base":{"STR":4,"AGI":5,"END":6,"FOR":7,"CHA":6,"INT":5,"WIS":6},"traitBias":["empathetic","methodical"],"factions":["FAC_TownClinic"],"schedule":"paramedic"},
  {"id":"laborer","base":{"STR":6,"AGI":5,"END":6,"FOR":5,"CHA":4,"INT":4,"WIS":4},"traitBias":["resilient","dogged"],"schedule":"laborer"},
  {"id":"scribe","base":{"STR":3,"AGI":4,"END":4,"FOR":4,"CHA":5,"INT":7,"WIS":6},"traitBias":["observant","anxious"],"schedule":"scribe"},
  {"id":"scavenger","base":{"STR":5,"AGI":6,"END":5,"FOR":5,"CHA":4,"INT":5,"WIS":5},"traitBias":["observant","dogged"],"schedule":"scavenger"},
  {"id":"vendor","base":{"STR":4,"AGI":4,"END":5,"FOR":4,"CHA":7,"INT":5,"WIS":5},"traitBias":["charismatic","methodical"],"schedule":"vendor"},
  {"id":"vagrant","base":{"STR":4,"AGI":5,"END":5,"FOR":5,"CHA":3,"INT":4,"WIS":5},"traitBias":["frail","stoic"],"schedule":"vagrant"}
];
