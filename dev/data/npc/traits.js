/* dev/data/npc/traits.js */
window.setup = window.setup || {};
setup.data = setup.data || {};
setup.data.traits = setup.data.traits || [
  {"id":"empathetic","tags":["social","care"],"mods":{"CHA":1},"weight":1},
  {"id":"methodical","tags":["order"],"mods":{"INT":1},"weight":1},
  {"id":"risk-averse","tags":["caution"],"mods":{},"weight":1},
  {"id":"resilient","tags":["tough"],"mods":{"END":1,"FOR":1},"weight":1},
  {"id":"frail","tags":["tough"],"mods":{"END":-1},"weight":1},
  {"id":"observant","tags":["perception"],"mods":{"WIS":1},"weight":1},
  {"id":"oblivious","tags":["perception"],"mods":{"WIS":-1},"weight":1},
  {"id":"dogged","tags":["will"],"mods":{"FOR":1},"weight":1},
  {"id":"anxious","tags":["will"],"mods":{"FOR":-1},"weight":1},
  {"id":"stoic","tags":["will"],"mods":{"CHA":-1,"FOR":1},"weight":1},
  {"id":"charismatic","tags":["social"],"mods":{"CHA":1},"weight":1}
];
