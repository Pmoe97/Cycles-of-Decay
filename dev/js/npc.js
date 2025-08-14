/* Rich NPC generation system for Cycles of Decay (SugarCube)
 * Iteration 2: Deterministic RNG, seeded time, safe trait picks, affliction->attr mods,
 * occupation schedules, enums, validation, deterministic names.
 */
(function () {
  'use strict';
  if (!window.setup) window.setup = {};

  /* ================= Seeded RNG (Mulberry32) & helpers ================= */
  function hashString(str) { // FNV-1a-ish 32-bit
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRNG(seedInit) {
    let s = (typeof seedInit === 'string' ? hashString(seedInit) : (seedInit >>> 0)) || 0xC0FFEE;
    let ticks = 0;
    const epoch = 1700000000000; // fixed epoch for deterministic clock

    function mulberry32() {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0,1)
    }
    const api = {
      get seed() { return s >>> 0; },
      rand() { return mulberry32(); }, // [0,1)
      rollInt(min, max) { return Math.floor(api.rand() * (max - min + 1)) + min; }, // inclusive
      rollFloat(min, max) { return api.rand() * (max - min) + min; },
      chance(p) { return api.rand() < p; },
      pick(arr) { return arr[Math.floor(api.rand() * arr.length)]; },
      nowISO() { return new Date(epoch + (ticks++) * 137).toISOString(); },
      reseed(n) { s = (typeof n === 'string' ? hashString(n) : (n >>> 0)); ticks = 0; }
    };
    return api;
  }

  // Install RNG if missing or extend existing with required methods
  if (!setup.rng || typeof setup.rng.rand !== 'function') {
    setup.rng = makeRNG(0xC0FFEE);
  } else {
    // Ensure required helpers exist
    const r = setup.rng;
    if (!r.rollInt) r.rollInt = (min, max) => Math.floor(r.rand() * (max - min + 1)) + min;
    if (!r.rollFloat) r.rollFloat = (min, max) => r.rand() * (max - min) + min;
    if (!r.chance) r.chance = p => r.rand() < p;
    if (!r.pick) r.pick = arr => arr[Math.floor(r.rand() * arr.length)];
    if (!r.nowISO) {
      let ticks = 0, epoch = 1700000000000;
      r.nowISO = () => new Date(epoch + (ticks++) * 137).toISOString();
    }
    if (!r.reseed) r.reseed = n => void 0; // no-op if user provided their own
  }

  /* ================= Small utils ================= */
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
  const pick = (a) => setup.rng.pick(a);
  const rollInt = (a, b) => setup.rng.rollInt(a, b);
  const rollFloat = (a, b) => setup.rng.rollFloat(a, b);
  const chance = (p) => setup.rng.chance(p);

  /* ================= Enums & Data Pools ================= */
  setup.enums = setup.enums || {};
  setup.enums.bodyStatus = ['ok', 'injured', 'missing', 'prosthetic', 'scarred'];
  setup.enums.species = ['human'];
  setup.enums.genders = ['female', 'male', 'nonbinary'];
  setup.enums.pronouns = ['she/her', 'he/him', 'they/them'];
  setup.enums.wards = ['Lower_Riverside_District', 'Old_Docks', 'Market_Row', 'Hill_Side'];

  const Species = setup.enums.species;
  const Genders = setup.enums.genders;
  const PronounSets = setup.enums.pronouns.map(p => ({ pronouns: p }));

  // Simple deterministic name generator (seeded)
  const FirstNames = ['Mara', 'Elijah', 'Rowan', 'Iris', 'Caleb', 'Nadia', 'Jonah', 'Selene', 'Felix', 'Anya', 'Micah', 'Kira'];
  const LastNames = ['Delaney', 'Harper', 'Voss', 'Kline', 'Ramos', 'Okoye', 'Nakamura', 'Santos', 'Bishop', 'Singh', 'Morozov', 'Yang'];
  function generateName() {
    return pick(FirstNames) + ' ' + pick(LastNames);
  }

  // Occupational archetypes (baseline attributes & biases)
  const Occupations = [
    { id: 'paramedic', weights: {}, base: { STR: 4, AGI: 5, END: 6, FOR: 7, CHA: 6, INT: 5, WIS: 6 }, traitBias: ['empathetic', 'methodical'], factions: ['FAC_TownClinic'] },
    { id: 'laborer', weights: {}, base: { STR: 6, AGI: 5, END: 6, FOR: 5, CHA: 4, INT: 4, WIS: 4 }, traitBias: ['resilient', 'dogged'] },
    { id: 'scribe', weights: {}, base: { STR: 3, AGI: 4, END: 4, FOR: 4, CHA: 5, INT: 7, WIS: 6 }, traitBias: ['observant', 'anxious'] },
    { id: 'scavenger', weights: {}, base: { STR: 5, AGI: 6, END: 5, FOR: 5, CHA: 4, INT: 5, WIS: 5 }, traitBias: ['observant', 'dogged'] },
    { id: 'vendor', weights: {}, base: { STR: 4, AGI: 4, END: 5, FOR: 4, CHA: 7, INT: 5, WIS: 5 }, traitBias: ['charismatic', 'methodical'] },
    { id: 'vagrant', weights: {}, base: { STR: 4, AGI: 5, END: 5, FOR: 5, CHA: 3, INT: 4, WIS: 5 }, traitBias: ['frail', 'stoic'] }
  ];

  // Personality traits (lightweight; map tags->modifiers in game logic)
  const PersonalityTraits = [
    { id: 'empathetic', tags: ['social', 'care'], mods: { CHA: +1 }, weights: {} },
    { id: 'methodical', tags: ['order'], mods: { INT: +1 }, weights: {} },
    { id: 'risk-averse', tags: ['caution'], mods: {}, weights: {} },
    { id: 'resilient', tags: ['tough'], mods: { END: +1, FOR: +1 }, weights: {} },
    { id: 'frail', tags: ['tough'], mods: { END: -1 }, weights: {} },
    { id: 'observant', tags: ['perception'], mods: { WIS: +1 }, weights: {} },
    { id: 'oblivious', tags: ['perception'], mods: { WIS: -1 }, weights: {} },
    { id: 'dogged', tags: ['will'], mods: { FOR: +1 }, weights: {} },
    { id: 'anxious', tags: ['will'], mods: { FOR: -1 }, weights: {} },
    { id: 'stoic', tags: ['will'], mods: { CHA: -1, FOR: +1 }, weights: {} },
    { id: 'charismatic', tags: ['social'], mods: { CHA: +1 }, weights: {} }
  ];

  // Injury / affliction templates
  const InjuryCatalog = [
    { id: 'sprained_ankle', location: 'l_leg', severityRange: [0.2, 0.6], mods: { AGI: -1, move_mult: 0.8 }, tags: ['injury', 'mobility'], defaultTreat: ['rest', 'wrap', 'painkiller'] },
    { id: 'fractured_wrist', location: 'r_arm', severityRange: [0.3, 0.7], mods: { AGI: -1, STR: -1, melee_pct: -0.2 }, tags: ['injury', 'dexterity'], defaultTreat: ['splint', 'rest'] },
    { id: 'concussion_mild', location: 'head', severityRange: [0.1, 0.3], mods: { INT: -1, WIS: -1, awareness_pct: -0.1 }, tags: ['injury', 'cognitive'], defaultTreat: ['rest', 'dark_room'] }
  ];

  // Equipment pools (simplified)
  const EquipmentPool = {
    clothing_body: [{ id: 'itm_paramedic_vest', durability: 0.8 }, { id: 'itm_worn_jacket', durability: 0.5 }, null],
    clothing_hands: [{ id: 'itm_work_gloves', durability: 0.7 }, null],
    mainHand: [{ id: 'itm_rescue_shears', durability: 0.9 }, { id: 'itm_pocket_knife', durability: 0.6 }, null]
  };

  const PackItems = [
    { id: 'itm_bandage', qty: [1, 5] },
    { id: 'itm_painkiller_tabs', qty: [1, 3] },
    { id: 'itm_water_bottle', qty: [1, 1] },
    { id: 'itm_energy_bar', qty: [1, 4] },
    { id: 'itm_flashlight', qty: [1, 1], durability: 0.6 }
  ];

  // Locations & Occupation-driven schedule patterns
  const LocationPool = ['LOC_Clinic', 'LOC_Riverside', 'LOC_AshSpire_Perimeter', 'LOC_Grocery', 'LOC_Apt_1A', 'LOC_Apt_2B'];
  const OccupationSchedules = {
    paramedic: [{ days: 'Mon-Fri', start: '07:00', end: '15:00', at: 'LOC_Clinic' }],
    laborer: [{ days: 'Mon-Fri', start: '06:00', end: '14:00', at: 'LOC_Docks' }],
    scribe: [{ days: 'Mon-Fri', start: '09:00', end: '17:00', at: 'LOC_Hall' }],
    scavenger: [{ days: 'Mon-Sat', start: '08:00', end: '13:00', at: 'LOC_Riverside' }],
    vendor: [{ days: 'Mon-Sat', start: '10:00', end: '18:00', at: 'LOC_Market' }],
    vagrant: [{ days: '*', start: '00:00', end: '23:59', at: 'LOC_AshSpire_Perimeter' }]
  };

  /* ================= Weighted pick (bias-aware) ================= */
  function weightedPick(list, biasIds) {
    if (!list || !list.length) return undefined;
    const pool = [];
    list.forEach(item => {
      const id = (item && item.id) ? item.id : item;
      let w = 1;
      if (biasIds && id && biasIds.includes(id)) w += 2;
      for (let i = 0; i < w; i++) pool.push(item);
    });
    return pick(pool);
  }

  /* ================= Attributes / Mods ================= */
  function applyPersonalityMods(attrs, traits) {
    traits.forEach(tid => {
      const def = PersonalityTraits.find(t => t.id === tid);
      if (def && def.mods) {
        Object.keys(def.mods).forEach(k => { attrs[k] = (attrs[k] || 0) + def.mods[k]; });
      }
    });
  }

  function accumulateAfflictionAttrMods(afflictions) {
    const mods = { STR: 0, AGI: 0, END: 0, FOR: 0, CHA: 0, INT: 0, WIS: 0 };
    (afflictions || []).forEach(a => {
      if (!a || !a.mods) return;
      for (const k of Object.keys(mods)) {
        if (typeof a.mods[k] === 'number') mods[k] += a.mods[k];
      }
    });
    return mods;
  }

  function effectiveAttributes(base, extraMods) {
    const eff = {};
    for (const k of ['STR', 'AGI', 'END', 'FOR', 'CHA', 'INT', 'WIS']) {
      eff[k] = clamp((base[k] || 0) + (extraMods?.[k] || 0), 1, 12);
    }
    return eff;
  }

  function computeDerived(aEff) {
    return {
      hpMax: Math.round(10 + aEff.END * 1.5 + aEff.FOR * 1.5),
      staminaMax: Math.round(30 + aEff.END * 2 + aEff.AGI * 2),
      carryCap: Math.round(10 + aEff.STR * 4 + aEff.END * 1),
      moveSpeed: +(3 + aEff.AGI * 0.3).toFixed(2),
      initiative: aEff.AGI + aEff.WIS + rollInt(1, 6),
      perception: Math.round(40 + aEff.WIS * 3 + aEff.INT * 1),
      resistPain: Math.round(30 + aEff.FOR * 3 + aEff.END * 2),
      resistFear: Math.round(30 + aEff.FOR * 3 + aEff.WIS * 2),
      resistDisease: Math.round(20 + aEff.END * 3 + aEff.WIS * 1),
      critChance: +(0.05 + (aEff.AGI + aEff.WIS) / 400).toFixed(3)
    };
  }

  /* ================= Injuries ================= */
  function maybeGenerateInjuries() {
    const injuries = [];
    if (chance(0.25)) { // 25%: at least one injury
      const count = chance(0.6) ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const tmpl = pick(InjuryCatalog);
        if (!tmpl) continue;
        const severity = +rollFloat(tmpl.severityRange[0], tmpl.severityRange[1]).toFixed(2);
        injuries.push({
          id: tmpl.id,
          location: tmpl.location,
          onset: setup.rng.nowISO(),
          severity,
          tags: tmpl.tags.slice(),
          mods: clone(tmpl.mods),
          treatment: tmpl.defaultTreat.slice()
        });
      }
    }
    return injuries;
  }

  /* ================= Inventory ================= */
  function generateEquipment() {
    return {
      currency: { credits: rollInt(0, 80) },
      slots: {
        head: null,
        body: clone(pick(EquipmentPool.clothing_body)),
        hands: clone(pick(EquipmentPool.clothing_hands)),
        back: null,
        legs: null,
        feet: null
      },
      pack: PackItems
        .filter(() => chance(0.6))
        .map(p => {
          const qty = rollInt(p.qty[0], p.qty[1]);
          const item = { id: p.id, qty };
          if (p.durability) item.durability = p.durability;
          return item;
        }),
      equipped: {
        mainHand: clone(pick(EquipmentPool.mainHand)),
        offHand: null
      }
    };
  }

  /* ================= Schedules ================= */
  function generateSchedule(occupationId) {
    const home = pick(LocationPool.filter(l => l.startsWith('LOC_Apt'))) || 'LOC_Apt_1A';
    const base = OccupationSchedules[occupationId] || [{ days: 'Mon-Fri', start: '09:00', end: '17:00', at: pick(LocationPool.filter(l => !l.startsWith('LOC_Apt'))) }];
    const errandAt = pick(LocationPool);
    return [
      ...base,
      { days: 'Mon-Fri', start: '15:30', end: '18:00', at: errandAt },
      { days: '*', start: '22:30', end: '06:30', at: home }
    ];
  }

  /* ================= Relationships ================= */
  function generateRelationshipSkeleton(pop) {
    // Reset
    pop.forEach(n => { n.relationships = { family: [], romance: [], friends: [], rivals: [], byId: {} }; });

    // Family clusters (size 2–4)
    let pool = pop.slice();
    while (pool.length) {
      if (pool.length < 2) break;
      const clusterSize = clamp(rollInt(2, 4), 2, pool.length);
      const cluster = [];
      for (let i = 0; i < clusterSize; i++) {
        const idx = rollInt(0, pool.length - 1);
        cluster.push(pool.splice(idx, 1)[0]);
      }
      cluster.forEach(a => {
        cluster.forEach(b => {
          if (a !== b) {
            a.relationships.family.push(b.id);
            a.relationships.byId[b.id] = { opinion: rollInt(30, 70), tags: ['family'] };
          }
        });
      });
    }

    // Friendships (symmetric; ~8% chance per unordered pair)
    for (let i = 0; i < pop.length; i++) {
      for (let j = i + 1; j < pop.length; j++) {
        if (chance(0.08)) {
          const a = pop[i], b = pop[j];
          a.relationships.friends.push(b.id); b.relationships.friends.push(a.id);
          a.relationships.byId[b.id] = a.relationships.byId[b.id] || { opinion: rollInt(20, 60), tags: ['friend'] };
          b.relationships.byId[a.id] = b.relationships.byId[a.id] || { opinion: rollInt(20, 60), tags: ['friend'] };
        }
      }
    }
  }

/* ================= Core NPC Assembly ================= */
	function generateCoreNPC(index) {
	const occ = pick(Occupations);
	const traitPrimary = weightedPick(PersonalityTraits, occ.traitBias || []);
	const secondaryBias = (occ.traitBias || []).filter(t => traitPrimary ? t !== traitPrimary.id : true);
	const traitSecondary = weightedPick(PersonalityTraits, secondaryBias);
	const tertPool = PersonalityTraits.filter(t => t !== traitPrimary && t !== traitSecondary);
	const traitTertiary = chance(0.3) ? weightedPick(tertPool, []) : null;
	const traits = [traitPrimary, traitSecondary, traitTertiary].filter(Boolean).map(t => t.id);

	// Base attributes (copy & jitter ±1)
	const base = clone(occ.base);
	Object.keys(base).forEach(k => { base[k] = clamp(base[k] + rollInt(-1, 1), 1, 10); });
	applyPersonalityMods(base, traits);

	// Injuries before derived => their mods affect play immediately
	const injuries = maybeGenerateInjuries();
	const injuryMods = accumulateAfflictionAttrMods(injuries);

	const attrMods = { STR: 0, AGI: 0, END: 0, FOR: 0, CHA: 0, INT: 0, WIS: 0 };
	// Merge injury mods into attribute mods
	for (const k in attrMods) attrMods[k] += (injuryMods[k] || 0);

	const aEff = effectiveAttributes(base, attrMods);
	const derived = computeDerived(aEff);
	const inventory = generateEquipment();

	// Identity (deterministic)
	const pronoun = pick(PronounSets).pronouns;
	const genderIdentity = pick(Genders);
	const fullName = (typeof setup.generateName === 'function') ? setup.generateName() : generateName();

	// Entropy block (deterministic), flag derived from exposure threshold
	const exposure = +setup.rng.rand().toFixed(2);
	const resistance = +setup.rng.rand().toFixed(2);
	const isEntropyAfflicted = exposure >= 0.05;

	const npc = {
		id: 'NPC_' + index.toString(36),
		version: SCHEMA_VERSION,
		lifecycle: {
		isAlive: true,
		isEntropyAfflicted,
		isPlayableHost: true,
		isDiscovered: false,
		death: { cause: null, time: null, locationId: null },
		hostHistory: { wasPlayer: false, incarnations: [] }
		},
		identity: {
		fullName, alias: null, age: rollInt(18, 70), pronouns: pronoun, genderIdentity,
		species: pick(Species), height_cm: rollInt(150, 200),
		build: pick(['slim', 'average', 'stout', 'athletic']),
		appearance: {
			hair: pick(['black', 'brown', 'blonde', 'red', 'grey']) + ', ' + pick(['short', 'long', 'shoulder-length', 'cropped']),
			eyes: pick(['brown', 'hazel', 'green', 'blue', 'grey']),
			skin: pick(['light', 'medium', 'dark']),
			distinguishingMarks: chance(0.3) ? [pick(['scar over brow', 'freckles', 'tattooed forearm', 'burned left hand'])] : []
		},
		portrait: { seed: null, style: 'painterly' }
		},
		background: {
		originWard: pick(setup.enums.wards),
		occupation: occ.id,
		factions: occ.factions ? occ.factions.slice() : [],
		biography: '',
		secrets: [],
		reputation: { global: 0, byFaction: {} }
		},
		personality: {
		archetype: occ.id,
		traits,
		big5: {
			O: +setup.rng.rand().toFixed(2),
			C: +setup.rng.rand().toFixed(2),
			E: +setup.rng.rand().toFixed(2),
			A: +setup.rng.rand().toFixed(2),
			N: +setup.rng.rand().toFixed(2)
		},
		motivations: [],
		fears: []
		},
		attributes: Object.assign({}, base, { mods: attrMods }),
		derived,
		skills: { model: 'derived', cache: { ts: null, values: {} } },
		conditions: {
		vitals: { hp: Math.round(derived.hpMax * 0.6), bleeding: 0, pain: 0, fatigue: rollInt(0, 25), stress: rollInt(0, 30) },
		bodymap: {
			head: { status: 'ok' }, ears: { status: 'ok' }, eyes: { status: 'ok' }, neck: { status: 'ok' },
			torso: { status: 'ok' }, genitals: { status: 'ok' },
			l_arm: { status: 'ok' }, r_arm: { status: 'ok' }, l_leg: { status: 'ok' }, r_leg: { status: 'ok' }
		},
		afflictions: injuries,
		prosthetics: [],
		immunities: []
		},
		entropy: { exposure, resistance, resonances: [], fragmentsKnown: [] },
		inventory,
		relationships: { family: [], romance: [], friends: [], rivals: [], byId: {} },
		knowledge: { mapPins: [], keys: [], rumors: [] },
		behavior: {
		schedule: generateSchedule(occ.id),
		combatTactics: pick(['avoid_then_firstAid', 'cautious_retreat', 'stand_ground']),
		dialogueStyle: pick([['soft-spoken', 'practical'], ['terse', 'guarded'], ['warm', 'chatty']])
		},
		flags: { questGiverIds: [], barksSeen: [], metPlayer: false, plotCritical: false, spawnLocked: false },
		debug: { createdAt: setup.rng.nowISO(), seed: setup.rng.seed >>> 0 }
	};
	return npc;
}

  /* ================= Population Pipeline ================= */
  function generatePopulation(count) {
    const pop = [];
    for (let i = 0; i < count; i++) pop.push(generateCoreNPC(i + 1));
    generateRelationshipSkeleton(pop);
    return pop;
  }

  /* ================= Validation ================= */
  function validateDetailed(npc) {
    const errors = [];
    if (!npc) { errors.push('NPC missing'); return errors; }
    if (npc.version !== SCHEMA_VERSION) errors.push(`Version mismatch: ${npc.version} != ${SCHEMA_VERSION}`);
    if (!setup.enums.species.includes(npc.identity?.species)) errors.push(`Invalid species: ${npc.identity?.species}`);
    if (!setup.enums.wards.includes(npc.background?.originWard)) errors.push(`Invalid ward: ${npc.background?.originWard}`);

    // Attributes
    for (const k of ['STR', 'AGI', 'END', 'FOR', 'CHA', 'INT', 'WIS']) {
      const v = npc.attributes?.[k];
      if (typeof v !== 'number' || v < 1 || v > 12) errors.push(`Attr ${k} out of range: ${v}`);
    }
    // Body status
    const allowedStatus = new Set(setup.enums.bodyStatus);
    for (const part in npc.conditions?.bodymap || {}) {
      const st = npc.conditions.bodymap[part]?.status;
      if (!allowedStatus.has(st)) errors.push(`Body status invalid for ${part}: ${st}`);
    }
    // Inventory shape (light checks)
    if (!npc.inventory || typeof npc.inventory !== 'object') errors.push('Inventory missing');
    if (!npc.inventory.slots) errors.push('Inventory.slots missing');
    return errors;
  }

  /* ================= Public API ================= */
  setup.NPC = {
    SCHEMA_VERSION: 1,
    reseed(seed) { if (setup.rng && setup.rng.reseed) setup.rng.reseed(seed); },
    generateOne: generateCoreNPC,
    generatePopulation,
    validate(npc) { return validateDetailed(npc).length === 0; },
    validateDetailed,
    migrate(npc) { // stub for future schema bumps
      if (npc.version === 1) return npc;
      // ... add transforms here per version
      return npc;
    }
  };

})();
