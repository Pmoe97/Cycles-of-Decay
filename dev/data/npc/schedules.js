/* dev/data/npc/schedules.js */
window.setup = window.setup || {};
setup.data = setup.data || {};
setup.data.schedules = setup.data.schedules || {
  "paramedic":[{"days":"Mon-Fri","start":"07:00","end":"15:00","at":"LOC_Clinic"}],
  "laborer":[{"days":"Mon-Fri","start":"06:00","end":"14:00","at":"LOC_Docks"}],
  "scribe":[{"days":"Mon-Fri","start":"09:00","end":"17:00","at":"LOC_Hall"}],
  "scavenger":[{"days":"Mon-Sat","start":"08:00","end":"13:00","at":"LOC_Riverside"}],
  "vendor":[{"days":"Mon-Sat","start":"10:00","end":"18:00","at":"LOC_Market"}],
  "vagrant":[{"days":"*","start":"00:00","end":"23:59","at":"LOC_AshSpire_Perimeter"}]
};
