/* Rich NPC generation system for Cycles of Decay (SugarCube)
 * Iteration 3: pulls authorable pools from setup.data (dev/data/*.js),
 * deterministic RNG, affliction->attr mods, occupation schedules,
 * enums mirror, validation, padded IDs, deterministic names fallback.
 */
(function () {
  'use strict';
  if (!window.setup) window.setup = {};
  const SCHEMA_VERSION = 1;

  /* ================= Seeded RNG (Mulberry32) & helpers ================= */
  function hashString(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function makeRNG(seedInit) {
    let s = (typeof seedInit === 'string' ? hashString(seedInit) : (seedInit >>> 0)) || 0xC0FFEE;
    let ticks = 0; const epoch = 1700000000000;
    function mulberry32() { s += 0x6D2B79F5; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    const api = {
      get seed() { return s >>> 0; },
      rand() { return mulberry32(); },
      rollInt(min, max) { return Math.floor(api.rand() * (max - min + 1)) + min; },
      rollFloat(min, max) { return api.rand() * (max - min) + min; },
      chance(p) { return api.rand() < p; },
      pick(arr) { return arr[Math.floor(api.rand() * arr.length)]; },
      nowISO() { return new Date(epoch + (ticks++) * 137).toISOString(); },
      reseed(n) { s = (typeof n === 'string' ? hashString(n) : (n >>> 0)); ticks = 0; }
    };
    return api;
  }
  if (!setup.rng || typeof setup.rng.rand !== 'function') setup.rng = makeRNG(0xC0FFEE);
  else {
    const r = setup.rng;
    if (!r.rollInt) r.rollInt = (min, max) => Math.floor(r.rand() * (max - min + 1)) + min;
    if (!r.rollFloat) r.rollFloat = (min, max) => r.rand() * (max - min) + min;
    if (!r.chance) r.chance = p => r.rand() < p;
    if (!r.pick) r.pick = arr => arr[Math.floor(r.rand() * arr.length)];
    if (!r.nowISO) { let ticks = 0, epoch = 1700000000000; r.nowISO = () => new Date(epoch + (ticks++) * 137).toISOString(); }
    if (!r.reseed) r.reseed = _ => void 0;
  }

  /* ================= Small utils ================= */
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
  const pick = (a) => setup.rng.pick(a);
  const rollInt = (a, b) => setup.rng.rollInt(a, b);
  const rollFloat = (a, b) => setup.rng.rollFloat(a, b);
  const chance = (p) => setup.rng.chance(p);

  /* ================= Authorable data (dev/data/*.js) ================= */
  const D = setup.data || {};
  // Canonical enums from data, plus a compatibility mirror on setup.enums
  const Enums = D.enums || { bodyStatus:['ok','injured','missing','prosthetic','scarred'], species:['human'], genders:['female','male','nonbinary'], pronouns:['she/her','he/him','they/them'], wards:['Lower_Riverside_District'] };
  setup.enums = Object.assign({} , setup.enums || {}, Enums); // keep legacy code happy

  const Species          = Enums.species || ['human'];
  const Genders          = Enums.genders || ['female','male','nonbinary'];
  const PronounSets      = (Enums.pronouns || ['they/them']).map(p => ({pronouns:p}));
  const Wards            = Enums.wards || ['Lower_Riverside_District'];

  const PersonalityTraits = D.traits || [];        // [{id,tags,mods,weight}]
  const Occupations       = D.occupations || [];   // [{id,base,traitBias,factions,schedule?}]
  const InjuryCatalog     = D.injuries || [];      // [{id,location,severityRange,mods,tags,defaultTreat}]
  const ItemsDB           = D.items || [];         // [{id,type,slot,durability,...}]
  const EquipPools        = D.equipmentPools || {}; // {clothing_body:[ids], clothing_hands:[ids], mainHand:[ids], pack:[{id,qty:[min,max],durability?}]}
  const Names             = D.names || { first:{generic:['Alex','Iris','Rowan']}, last:{generic:['Harper','Voss','Kline']} };
  const LocationsTable    = D.locations || [{id:'LOC_Apt_1A'}];
  const SchedulesByOcc    = D.schedules || {};     // { occupationId: [ {days,start,end,at} ] }

  const LocationPool = LocationsTable.map(l => l.id);

  /* ================= Weighted pick (respects .weight & bias) ================= */
  function weightedPick(list, biasIds) {
    if (!list || !list.length) return undefined;
    const bias = new Set(biasIds || []);
    let total = 0;
    const weights = list.map(item => {
      const id = item && item.id ? item.id : item;
      let w = Number(item && item.weight != null ? item.weight : 1);
      if (bias.has(id)) w *= 2; // tweak bias multiplier as desired
      total += w;
      return w;
    });
    let r = setup.rng.rand() * total;
    for (let i = 0; i < list.length; i++) { if ((r -= weights[i]) <= 0) return list[i]; }
    return list[list.length - 1];
  }

  /* ================= Name generator (from setup.data.names) ================= */
  function generateName() {
    const fPool = (Names.first && (Names.first.generic || Names.first)) || ['Alex','Iris','Rowan'];
    const lPool = (Names.last  && (Names.last.generic  || Names.last )) || ['Harper','Voss','Kline'];
    const f = pick(fPool); const l = pick(lPool);
    return f + ' ' + l;
  }

  /* ================= Attributes / Mods ================= */
  function applyPersonalityMods(attrs, traits) {
    traits.forEach(tid => {
      const def = PersonalityTraits.find(t => t.id === tid);
      if (def && def.mods) Object.keys(def.mods).forEach(k => { attrs[k] = (attrs[k] || 0) + def.mods[k]; });
    });
  }
  function accumulateAfflictionAttrMods(afflictions) {
    const mods = { STR:0, AGI:0, END:0, FOR:0, CHA:0, INT:0, WIS:0 };
    (afflictions || []).forEach(a => {
      if (!a || !a.mods) return;
      for (const k in mods) if (typeof a.mods[k] === 'number') mods[k] += a.mods[k];
    });
    return mods;
  }
  function effectiveAttributes(base, extraMods) {
    const eff = {};
    for (const k of ['STR','AGI','END','FOR','CHA','INT','WIS']) eff[k] = clamp((base[k]||0) + (extraMods?.[k]||0), 1, 12);
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

  /* ================= Items & equipment helpers ================= */
  function findItem(id) { return id ? (ItemsDB.find(x => x.id === id) || { id }) : null; }
  function makeEquipEntry(id) {
    if (!id) return null;
    const def = findItem(id);
    const ent = { id: def.id };
    if (typeof def.durability === 'number') ent.durability = def.durability;
    return ent;
  }

  /* ================= Injuries ================= */
  function maybeGenerateInjuries() {
    const injuries = [];
    if (chance(0.25)) {
      const count = chance(0.6) ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const tmpl = pick(InjuryCatalog);
        if (!tmpl) continue;
        const severity = +rollFloat(tmpl.severityRange[0], tmpl.severityRange[1]).toFixed(2);
        injuries.push({ id: tmpl.id, location: tmpl.location, onset: setup.rng.nowISO(), severity,
          tags: (tmpl.tags||[]).slice(), mods: clone(tmpl.mods||{}), treatment: (tmpl.defaultTreat||[]).slice() });
      }
    }
    return injuries;
  }

  /* ================= Inventory ================= */
  const EquipmentPool = {
    clothing_body: (EquipPools.clothing_body || []),
    clothing_hands: (EquipPools.clothing_hands || []),
    mainHand: (EquipPools.mainHand || [])
  };
  const PackItems = (EquipPools.pack || []);
  function generateEquipment() {
    return {
      currency: { credits: rollInt(0, 80) },
      slots: {
        head: null,
        body: makeEquipEntry(pick(EquipmentPool.clothing_body)),
        hands: makeEquipEntry(pick(EquipmentPool.clothing_hands)),
        back: null, legs: null, feet: null
      },
      pack: PackItems.filter(() => chance(0.6)).map(p => {
        const qty = rollInt(p.qty[0], p.qty[1]);
        const item = { id: p.id, qty };
        if (typeof p.durability === 'number') item.durability = p.durability;
        return item;
      }),
      equipped: { mainHand: makeEquipEntry(pick(EquipmentPool.mainHand)), offHand: null }
    };
  }

  /* ================= Schedules ================= */
  function generateSchedule(occupationId) {
    const home = pick(LocationPool.filter(l => l.startsWith('LOC_Apt'))) || 'LOC_Apt_1A';
    const base = (SchedulesByOcc[occupationId] || []).map(b => clone(b));
    if (!base.length) {
      let workLoc = pick(LocationPool.filter(l => !l.startsWith('LOC_Apt')));
      if (occupationId === 'paramedic' && LocationPool.includes('LOC_Clinic')) workLoc = 'LOC_Clinic';
      base.push({ days: 'Mon-Fri', start: '09:00', end: '17:00', at: workLoc });
    }
    base.push({ days: 'Mon-Fri', start: '15:30', end: '18:00', at: pick(LocationPool) });
    base.push({ days: '*', start: '22:30', end: '06:30', at: home });
    return base;
  }

  /* ================= Relationships ================= */
  function generateRelationshipSkeleton(pop) {
    pop.forEach(n => { n.relationships = { family: [], romance: [], friends: [], rivals: [], byId: {} }; });
    let pool = pop.slice();
    while (pool.length) {
      if (pool.length < 2) break;
      const clusterSize = clamp(rollInt(2, 4), 2, pool.length);
      const cluster = []; for (let i = 0; i < clusterSize; i++) { const idx = rollInt(0, pool.length - 1); cluster.push(pool.splice(idx, 1)[0]); }
      cluster.forEach(a => cluster.forEach(b => { if (a !== b) { a.relationships.family.push(b.id); a.relationships.byId[b.id] = { opinion: rollInt(30, 70), tags: ['family'] }; } }));
    }
    for (let i = 0; i < pop.length; i++) for (let j = i + 1; j < pop.length; j++) {
      if (chance(0.08)) {
        const a = pop[i], b = pop[j];
        a.relationships.friends.push(b.id); b.relationships.friends.push(a.id);
        a.relationships.byId[b.id] = a.relationships.byId[b.id] || { opinion: rollInt(20, 60), tags: ['friend'] };
        b.relationships.byId[a.id] = b.relationships.byId[a.id] || { opinion: rollInt(20, 60), tags: ['friend'] };
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

    const base = clone(occ.base);
    Object.keys(base).forEach(k => { base[k] = clamp(base[k] + rollInt(-1, 1), 1, 10); });
    applyPersonalityMods(base, traits);

    const injuries  = maybeGenerateInjuries();
    const injuryMods = accumulateAfflictionAttrMods(injuries);

    const attrMods = { STR:0, AGI:0, END:0, FOR:0, CHA:0, INT:0, WIS:0 };
    for (const k in attrMods) attrMods[k] += (injuryMods[k] || 0);

    const aEff = effectiveAttributes(base, attrMods);
    const derived = computeDerived(aEff);
    const inventory = generateEquipment();

    const pronoun = pick(PronounSets).pronouns;
    const genderIdentity = pick(Genders);
    const fullName = (typeof setup.generateName === 'function') ? setup.generateName() : generateName();

    const exposure = +setup.rng.rand().toFixed(2);
    const resistance = +setup.rng.rand().toFixed(2);
    const isEntropyAfflicted = exposure >= 0.05;

    const npc = {
      id: 'NPC_' + String(index).padStart(3, '0'),
      version: SCHEMA_VERSION,
      lifecycle: {
        isAlive: true, isEntropyAfflicted, isPlayableHost: true, isDiscovered: false,
        death: { cause: null, time: null, locationId: null }, hostHistory: { wasPlayer: false, incarnations: [] }
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
        originWard: pick(Wards),
        occupation: occ.id,
        factions: occ.factions ? occ.factions.slice() : [],
        biography: '',
        secrets: [],
        reputation: { global: 0, byFaction: {} }
      },
      personality: {
        archetype: occ.id,
        traits,
        big5: { O:+setup.rng.rand().toFixed(2), C:+setup.rng.rand().toFixed(2), E:+setup.rng.rand().toFixed(2), A:+setup.rng.rand().toFixed(2), N:+setup.rng.rand().toFixed(2) },
        motivations: [], fears: []
      },
      attributes: Object.assign({}, base, { mods: attrMods }),
      derived,
      skills: { model: 'derived', cache: { ts: null, values: {} } },
      conditions: {
        vitals: { hp: Math.round(derived.hpMax * 0.6), bleeding: 0, pain: 0, fatigue: rollInt(0, 25), stress: rollInt(0, 30) },
        bodymap: { head:{status:'ok'}, ears:{status:'ok'}, eyes:{status:'ok'}, neck:{status:'ok'}, torso:{status:'ok'}, genitals:{status:'ok'}, l_arm:{status:'ok'}, r_arm:{status:'ok'}, l_leg:{status:'ok'}, r_leg:{status:'ok'} },
        afflictions: injuries, prosthetics: [], immunities: []
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
  function generatePopulation(count) { const pop = []; for (let i = 0; i < count; i++) pop.push(generateCoreNPC(i + 1)); generateRelationshipSkeleton(pop); return pop; }

  /* ================= Validation ================= */
  function validateDetailed(npc) {
    const errors = [];
    if (!npc) { errors.push('NPC missing'); return errors; }
    if (npc.version !== SCHEMA_VERSION) errors.push(`Version mismatch: ${npc.version} != ${SCHEMA_VERSION}`);
    if (!(Species || []).includes(npc.identity?.species)) errors.push(`Invalid species: ${npc.identity?.species}`);
    if (!(Wards || []).includes(npc.background?.originWard)) errors.push(`Invalid ward: ${npc.background?.originWard}`);
    for (const k of ['STR','AGI','END','FOR','CHA','INT','WIS']) { const v = npc.attributes?.[k]; if (typeof v !== 'number' || v < 1 || v > 12) errors.push(`Attr ${k} out of range: ${v}`); }
    const allowedStatus = new Set(Enums.bodyStatus || ['ok']);
    for (const part in npc.conditions?.bodymap || {}) { const st = npc.conditions.bodymap[part]?.status; if (!allowedStatus.has(st)) errors.push(`Body status invalid for ${part}: ${st}`); }
    if (!npc.inventory || typeof npc.inventory !== 'object') errors.push('Inventory missing');
    if (!npc.inventory.slots) errors.push('Inventory.slots missing');
    return errors;
  }

  /* ================= Public API ================= */
  setup.NPC = {
    SCHEMA_VERSION,
    reseed(seed) { if (setup.rng && setup.rng.reseed) setup.rng.reseed(seed); },
    generateOne: generateCoreNPC,
    generatePopulation,
    validate(npc) { return validateDetailed(npc).length === 0; },
    validateDetailed,
    migrate(npc) { if (npc.version === 1) return npc; return npc; }
  };

})();

/* ---- Optional shape-checker (unchanged) ---- */
(function(){
  const sampleShape = {
    id:"", version:0,
    lifecycle:{ isAlive:true, isEntropyAfflicted:true, isPlayableHost:true, isDiscovered:true,
      death:{ cause:null, time:null, locationId:null }, hostHistory:{ wasPlayer:true, incarnations:[] } },
    identity:{ fullName:"", alias:null, age:0, pronouns:"", genderIdentity:"", species:"", height_cm:0, build:"",
      appearance:{ hair:"", eyes:"", skin:"", distinguishingMarks:[] }, portrait:{ seed:null, style:"" } },
    background:{ originWard:"", occupation:"", factions:[], biography:"", secrets:[], reputation:{ global:0, byFaction:{} } },
    personality:{ archetype:"", traits:[], big5:{ O:0,C:0,E:0,A:0,N:0 }, motivations:[], fears:[] },
    attributes:{ STR:0,AGI:0,END:0,FOR:0,CHA:0,INT:0,WIS:0, mods:{ STR:0,AGI:0,END:0,FOR:0,CHA:0,INT:0,WIS:0 } },
    derived:{ hpMax:0, staminaMax:0, carryCap:0, moveSpeed:0, initiative:0, perception:0, resistPain:0, resistFear:0, resistDisease:0, critChance:0 },
    skills:{ model:"", cache:{ ts:null, values:{} } },
    conditions:{ vitals:{ hp:0, bleeding:0, pain:0, fatigue:0, stress:0 },
      bodymap:{ head:{}, ears:{}, eyes:{}, neck:{}, torso:{}, genitals:{}, l_arm:{}, r_arm:{}, l_leg:{}, r_leg:{} },
      afflictions:[], prosthetics:[], immunities:[] },
    entropy:{ exposure:0, resistance:0, resonances:[], fragmentsKnown:[] },
    inventory:{ currency:{ credits:0 },
      slots:{ head:null, body:null, hands:null, back:null, legs:null, feet:null },
      pack:[], equipped:{ mainHand:null, offHand:null } },
    relationships:{ family:[], romance:[], friends:[], rivals:[], byId:{} },
    knowledge:{ mapPins:[], keys:[], rumors:[] },
    behavior:{ schedule:[], combatTactics:"", dialogueStyle:[] },
    flags:{ questGiverIds:[], barksSeen:[], metPlayer:false, plotCritical:false, spawnLocked:false },
    debug:{ createdAt:"", seed:0 }
  };
  function shapeMatch(sample, obj, path="root", errs=[]) {
    for (const k of Object.keys(sample)) {
      const sp = sample[k], op = obj?.[k], pth = path + "." + k;
      if (sp === null || typeof sp !== "object" || Array.isArray(sp)) { if (typeof op === "undefined") errs.push("Missing key: " + pth); }
      else { if (typeof op !== "object") errs.push("Missing/invalid object: " + pth); else shapeMatch(sp, op, pth, errs); }
    }
    return errs;
  }
  $(document).one(':storyready', function() {
    if (!setup.NPC || !setup.NPC.generatePopulation) { console.warn('[shape-check] NPC module not available; skipping'); return; }
    const pop = setup.NPC.generatePopulation(200);
    let bad = 0;
    for (const n of pop) {
      const errs = shapeMatch(sampleShape, n);
      if (errs.length) { bad++; console.warn("NPC shape problems", n.id, errs); }
    }
    if (bad === 0) console.log("All 200 NPCs match the sample structure.");
    else console.warn(bad + " NPCs had shape differences. See console.");
  });
})();
