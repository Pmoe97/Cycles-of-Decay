/* Rich NPC generation system scaffold for Cycles of Decay (SugarCube)
 * Iteration 1: Implements schema, defaults, generation pipeline, relationships, injuries, inventory, schedule.
 * Focus: Deterministic (seeded) reproducibility using setup.rng; easily extensible.
 */
(function(){
	'use strict';

	if (!window.setup) window.setup = {};

	/* ===== Seeded RNG augmentation (adds helpers if missing) ===== */
	(function ensureRngExtensions(){
		if (!setup.rng) {
			// Minimal fallback (will be reseeded later by game init) using Mulberry32 style progression
			let s = 0xC0FFEE >>> 0;
			function mul32(){ s += 0x6D2B79F5; let t = Math.imul(s ^ (s>>>15), 1|s); t ^= t + Math.imul(t ^ (t>>>7), 61|t); return ((t ^ (t>>>14))>>>0)/4294967296; }
			setup.rng = { seedString:'internal', rand: mul32, reseed(n){ s = (typeof n==='string'? hashString(n): n)>>>0; this.seedString=n; _ticks=0; }, pick(arr){ return arr[Math.floor(this.rand()*arr.length)]; }, roll(min,max){ return Math.floor(this.rand()*(max-min+1))+min; } };
		}
		// Extend only if not already present to avoid clobbering other modules
		let epoch = 1700000000000; // fixed epoch for deterministic clock
		if (typeof setup.rng._ticks === 'undefined') setup.rng._ticks = 0;
		if (!setup.rng.nowISO) setup.rng.nowISO = function(){ return new Date(epoch + (this._ticks++)*137).toISOString(); };
		if (!setup.rng.rollInt) setup.rng.rollInt = function(min,max){ return Math.floor(this.rand()*(max-min+1))+min; };
		if (!setup.rng.rollFloat) setup.rng.rollFloat = function(min,max){ return this.rand()*(max-min)+min; };
		if (!setup.rng.chance) setup.rng.chance = function(p){ return this.rand() < p; };
		if (!setup.rng.pick) setup.rng.pick = function(arr){ return arr[Math.floor(this.rand()*arr.length)]; };
	})();

	/* ================= Schema & Versioning ================= */
	const SCHEMA_VERSION = 1; // bump when fields change; add migrators later

	// Helper to deep clone simple JSON-ready objects
	function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

	/* ================= Data Pools (author / expand later) ================= */
	const Species = ['human']; // future: add variations
	const Genders = ['female','male','nonbinary'];
	const PronounSets = [
		{pronouns:'she/her'},
		{pronouns:'he/him'},
		{pronouns:'they/them'}
	];

	// Occupational archetypes supply baseline attribute distributions & biases
	const Occupations = [
		{ id:'paramedic',    weights:{}, base:{ STR:4, AGI:5, END:6, FOR:7, CHA:6, INT:5, WIS:6 }, traitBias:['empathetic','methodical'], factions:['FAC_TownClinic'] },
		{ id:'laborer',      weights:{}, base:{ STR:6, AGI:5, END:6, FOR:5, CHA:4, INT:4, WIS:4 }, traitBias:['resilient','dogged'] },
		{ id:'scribe',       weights:{}, base:{ STR:3, AGI:4, END:4, FOR:4, CHA:5, INT:7, WIS:6 }, traitBias:['observant','anxious'] },
		{ id:'scavenger',    weights:{}, base:{ STR:5, AGI:6, END:5, FOR:5, CHA:4, INT:5, WIS:5 }, traitBias:['observant','dogged'] },
		{ id:'vendor',       weights:{}, base:{ STR:4, AGI:4, END:5, FOR:4, CHA:7, INT:5, WIS:5 }, traitBias:['charismatic','methodical'] },
		{ id:'vagrant',      weights:{}, base:{ STR:4, AGI:5, END:5, FOR:5, CHA:3, INT:4, WIS:5 }, traitBias:['frail','stoic'] }
	];

	// Personality trait definitions (lightweight; game logic can map tags to modifiers)
	const PersonalityTraits = [
		{ id:'empathetic', tags:['social','care'], mods:{ CHA:+1 }, weights:{} },
		{ id:'methodical', tags:['order'], mods:{ INT:+1 }, weights:{} },
		{ id:'risk-averse', tags:['caution'], mods:{}, weights:{} },
		{ id:'resilient', tags:['tough'], mods:{ END:+1, FOR:+1 }, weights:{} },
		{ id:'frail', tags:['tough'], mods:{ END:-1 }, weights:{} },
		{ id:'observant', tags:['perception'], mods:{ WIS:+1 }, weights:{} },
		{ id:'oblivious', tags:['perception'], mods:{ WIS:-1 }, weights:{} },
		{ id:'dogged', tags:['will'], mods:{ FOR:+1 }, weights:{} },
		{ id:'anxious', tags:['will'], mods:{ FOR:-1 }, weights:{} },
		{ id:'stoic', tags:['will'], mods:{ CHA:-1, FOR:+1 }, weights:{} },
		{ id:'charismatic', tags:['social'], mods:{ CHA:+1 }, weights:{} }
	];

	// Injury / affliction templates
	const InjuryCatalog = [
		{ id:'sprained_ankle', location:'l_leg', severityRange:[0.2,0.6], mods:{ AGI:-1, move_mult:0.8 }, tags:['injury','mobility'], defaultTreat:['rest','wrap','painkiller'] },
		{ id:'fractured_wrist', location:'r_arm', severityRange:[0.3,0.7], mods:{ AGI:-1, STR:-1, melee_pct:-0.2 }, tags:['injury','dexterity'], defaultTreat:['splint','rest'] },
		{ id:'concussion_mild', location:'head', severityRange:[0.1,0.3], mods:{ INT:-1, WIS:-1, awareness_pct:-0.1 }, tags:['injury','cognitive'], defaultTreat:['rest','dark_room'] }
	];

	// Equipment pools (simplified)
	const EquipmentPool = {
		clothing_body: [ { id:'itm_paramedic_vest', durability:0.8 }, { id:'itm_worn_jacket', durability:0.5 }, null ],
		clothing_hands:[ { id:'itm_work_gloves', durability:0.7 }, null ],
		mainHand: [ { id:'itm_rescue_shears', durability:0.9 }, { id:'itm_pocket_knife', durability:0.6 }, null ]
	};

	const PackItems = [
		{ id:'itm_bandage', qty:[1,5] },
		{ id:'itm_painkiller_tabs', qty:[1,3] },
		{ id:'itm_water_bottle', qty:[1,1] },
		{ id:'itm_energy_bar', qty:[1,4] },
		{ id:'itm_flashlight', qty:[1,1], durability:0.6 }
	];

	// Scheduling templates (rough blocks; will weight by occupation later)
	const LocationPool = ['LOC_Clinic','LOC_Riverside','LOC_AshSpire_Perimeter','LOC_Grocery','LOC_Apt_1A','LOC_Apt_2B'];

	/* ================= Utility Helpers ================= */
	function pick(arr){ return setup.rng.pick(arr); }
	function roll(min,max){ return setup.rng.rollInt ? setup.rng.rollInt(min,max) : setup.rng.roll(min,max); }
	function rollFloat(min,max){ return setup.rng.rollFloat ? setup.rng.rollFloat(min,max) : (setup.rng.rand()*(max-min)+min); }
	function chance(p){ return setup.rng.chance ? setup.rng.chance(p) : (setup.rng.rand() < p); }

	function weightedPick(list, biasIds){
		if (!list || !list.length) return undefined;
		const pool=[]; list.forEach(item=>{ const id = item.id ?? item; let w=1; if (biasIds && biasIds.includes(id)) w+=2; for (let i=0;i<w;i++) pool.push(item); });
		return pick(pool);
	}

	/* ================= Attribute & Derived Formulas ================= */
	function applyPersonalityMods(attrs, traits){
		traits.forEach(tid=>{
			const def = PersonalityTraits.find(t=>t.id===tid); if (def && def.mods){ Object.keys(def.mods).forEach(k=>{ attrs[k] = (attrs[k]||0) + def.mods[k]; }); }
		});
	}

	function clamp(val,min,max){ return val<min?min:val>max?max:val; }

	function computeDerived(a){
		return {
			hpMax: Math.round(10 + a.END*1.5 + a.FOR*1.5),
			staminaMax: Math.round(30 + a.END*2 + a.AGI*2),
			carryCap: Math.round(10 + a.STR*4 + a.END*1),
			moveSpeed: +( (3 + a.AGI*0.3).toFixed(2) ),
			initiative: a.AGI + a.WIS + roll(1,6),
			perception: Math.round(40 + a.WIS*3 + a.INT*1),
			resistPain: Math.round(30 + a.FOR*3 + a.END*2),
			resistFear: Math.round(30 + a.FOR*3 + a.WIS*2),
			resistDisease: Math.round(20 + a.END*3 + a.WIS*1),
			critChance: 0.05 + (a.AGI + a.WIS)/400
		};
	}

	/* ================= Injury Generation ================= */
	function maybeGenerateInjuries(){
		const injuries=[];
		if (chance(0.25)) { // 25% at least one injury
			const count = chance(0.6)?1:2; // mostly one
			for (let i=0;i<count;i++){
				const tmpl = pick(InjuryCatalog);
				if (!tmpl) continue;
				const severity = +( rollFloat(tmpl.severityRange[0], tmpl.severityRange[1]).toFixed(2) );
				injuries.push({
					id: tmpl.id,
					location: tmpl.location,
					onset: setup.rng.nowISO(),
					severity: severity,
					tags: tmpl.tags.slice(),
					mods: clone(tmpl.mods),
					treatment: tmpl.defaultTreat.slice()
				});
			}
		}
		return injuries;
	}

	/* ================= Inventory Generation ================= */
	function generateEquipment(){
		return {
			currency: { credits: roll(0,80) },
			slots: {
				head: null,
				body: clone(pick(EquipmentPool.clothing_body)),
				hands: clone(pick(EquipmentPool.clothing_hands)),
				back: null,
				legs: null,
				feet: null
			},
			pack: PackItems.filter(()=> chance(0.6)).map(p=>{ const qty = roll(p.qty[0], p.qty[1]); const item = { id:p.id, qty:qty }; if (p.durability) item.durability = p.durability; return item; }),
			equipped: {
				mainHand: clone(pick(EquipmentPool.mainHand)),
				offHand: null
			}
		};
	}

	/* ================= Schedule Generation ================= */
	function generateSchedule(occupation){
		// naive prototype: work block, errand block, home block
		const home = pick(LocationPool.filter(l=>l.startsWith('LOC_Apt')))||'LOC_Apt_1A';
		let workLoc = pick(LocationPool.filter(l=>!l.startsWith('LOC_Apt')));
		if (occupation === 'paramedic') workLoc = 'LOC_Clinic';
		return [
			{ days:'Mon-Fri', start:'07:00', end:'15:00', at: workLoc },
			{ days:'Mon-Fri', start:'15:30', end:'18:00', at: pick(LocationPool) },
			{ days:'*', start:'22:30', end:'06:30', at: home }
		];
	}

	/* ================= Relationships ================= */
	function generateRelationshipSkeleton(pop){
		// Called after all NPC cores exist; we assign simple friendships & one family cluster pass
		// Clear existing structures
		pop.forEach(n=>{ n.relationships = { family:[], romance:[], friends:[], rivals:[], byId:{} }; });
		// Family clusters (size 2-4)
		let pool = pop.slice();
		while (pool.length){
			if (pool.length < 2) break;
			const clusterSize = clamp(roll(2,4), 2, pool.length);
			const cluster = [];
			for (let i=0;i<clusterSize;i++) cluster.push(pool.splice(roll(0,pool.length-1),1)[0]);
			cluster.forEach(a=>{
				cluster.forEach(b=>{ if (a!==b) { a.relationships.family.push(b.id); a.relationships.byId[b.id]={ opinion: roll(30,70), tags:['family'] }; } });
			});
		}
		// Friendships (symmetric; 30% chance pair)
		for (let i=0;i<pop.length;i++){
			for (let j=i+1;j<pop.length;j++){
				if (chance(0.08)){
					const a=pop[i], b=pop[j];
					a.relationships.friends.push(b.id); b.relationships.friends.push(a.id);
					a.relationships.byId[b.id] = a.relationships.byId[b.id] || { opinion: roll(20,60), tags:['friend'] };
					b.relationships.byId[a.id] = b.relationships.byId[a.id] || { opinion: roll(20,60), tags:['friend'] };
				}
			}
		}
	}

	/* ================= Core NPC Assembly ================= */
	function generateCoreNPC(index){
		const occupation = pick(Occupations);
		const traitPrimary = weightedPick(PersonalityTraits, occupation.traitBias || []);
		const traitSecondary = weightedPick(
			PersonalityTraits,
			(traitPrimary ? (occupation.traitBias || []).filter(t=>t!==traitPrimary.id) : (occupation.traitBias || []))
		);
		const tertPool = PersonalityTraits.filter(t=> t !== traitPrimary && t !== traitSecondary);
		const traitTertiary = chance(0.3) ? weightedPick(tertPool, []) : null;
		const traits = [traitPrimary, traitSecondary, traitTertiary].filter(Boolean).map(t=>t.id);

		// Base attributes (copy & jitter +-1)
		const attrs = clone(occupation.base);
		Object.keys(attrs).forEach(k=>{ const delta = roll(-1,1); attrs[k] = clamp(attrs[k] + delta, 1, 10); });
		applyPersonalityMods(attrs, traits);
		Object.keys(attrs).forEach(k=> attrs[k] = clamp(attrs[k],1,12));

		const derived = computeDerived(attrs);
		const injuries = maybeGenerateInjuries();
		const inventory = generateEquipment();

		// Identity
		const pronoun = pick(PronounSets).pronouns;
		const genderIdentity = pick(Genders);
		const fullName = setup.generateName ? setup.generateName() : ('Name'+index);

		const npc = {
			id: 'NPC_'+index.toString(36),
			version: SCHEMA_VERSION,
			lifecycle: { isAlive:true, isEntropyAfflicted: chance(0.4), isPlayableHost:true, isDiscovered:false, death:{ cause:null,time:null,locationId:null }, hostHistory:{ wasPlayer:false, incarnations:[] } },
			identity: { fullName, alias:null, age: roll(18,70), pronouns:pronoun, genderIdentity, species: pick(Species), height_cm: roll(150,200), build: pick(['slim','average','stout','athletic']), appearance:{ hair:pick(['black','brown','blonde','red','grey'])+', '+pick(['short','long','shoulder-length','cropped']), eyes:pick(['brown','hazel','green','blue','grey']), skin: pick(['light','medium','dark']), distinguishingMarks: chance(0.3)? [pick(['scar over brow','freckles','tattooed forearm','burned left hand'])]:[] }, portrait:{ seed:null, style:'painterly' } },
			background: { originWard: pick(['Lower_Riverside_District','Old_Docks','Market_Row','Hill_Side']), occupation: occupation.id, factions: occupation.factions? occupation.factions.slice():[], biography:'', secrets:[], reputation:{ global:0, byFaction:{} } },
			personality: { archetype: occupation.id, traits: traits, big5:{ O:+(setup.rng.rand().toFixed(2)), C:+(setup.rng.rand().toFixed(2)), E:+(setup.rng.rand().toFixed(2)), A:+(setup.rng.rand().toFixed(2)), N:+(setup.rng.rand().toFixed(2)) }, motivations:[], fears:[] },
			attributes: Object.assign({}, attrs, { mods:{ STR:0,AGI:0,END:0,FOR:0,CHA:0,INT:0,WIS:0 } }),
			derived: derived,
			skills: { model:'derived', cache:{ ts:null, values:{} } },
			conditions: { vitals:{ hp: Math.round(derived.hpMax*0.6), bleeding:0, pain:0, fatigue: roll(0,25), stress: roll(0,30) }, bodymap:{ head:{status:'ok'}, ears:{status:'ok'}, eyes:{status:'ok'}, neck:{status:'ok'}, torso:{status:'ok'}, genitals:{status:'ok'}, l_arm:{status:'ok'}, r_arm:{status:'ok'}, l_leg:{status:'ok'}, r_leg:{status:'ok'} }, afflictions: injuries, prosthetics:[], immunities:[] },
			entropy: { exposure: +(setup.rng.rand().toFixed(2)), resistance:+(setup.rng.rand().toFixed(2)), resonances:[], fragmentsKnown:[] },
			inventory: inventory,
			relationships: { family:[], romance:[], friends:[], rivals:[], byId:{} }, // filled later
			knowledge: { mapPins:[], keys:[], rumors:[] },
			behavior: { schedule: generateSchedule(occupation.id), combatTactics: pick(['avoid_then_firstAid','cautious_retreat','stand_ground']), dialogueStyle: pick([['soft-spoken','practical'], ['terse','guarded'], ['warm','chatty']]) },
			flags: { questGiverIds:[], barksSeen:[], metPlayer:false, plotCritical:false, spawnLocked:false },
			debug: { createdAt: setup.rng.nowISO(), seed: null }
		};
		return npc;
	}

	/* ================= Population Pipeline ================= */
	function generatePopulation(count){
		const pop = [];
		for (let i=0;i<count;i++) pop.push(generateCoreNPC(i+1));
		generateRelationshipSkeleton(pop);
		return pop;
	}

	/* ================= Public API ================= */
	setup.NPC = {
		SCHEMA_VERSION,
		generateOne: generateCoreNPC,
		generatePopulation,
		validate(npc){
			if (!npc) return false;
			if (npc.version !== SCHEMA_VERSION) return false;
			// Basic enum checks
			if (!['human'].includes(npc.identity.species)) return false;
			return true;
		}
	};

})();
