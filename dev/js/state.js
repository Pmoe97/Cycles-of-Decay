/* Procedural world + character generation scaffold for Cycles of Decay */
(function(){
	'use strict';

	/* ================= Seeded RNG ================= */
	function xmur3(str) {
		let h = 1779033703 ^ str.length;
		for (let i = 0; i < str.length; i++) {
			h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
			h = h << 13 | h >>> 19;
		}
		return function() {
			h = Math.imul(h ^ (h >>> 16), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			h ^= h >>> 16;
			return h >>> 0;
		};
	}
	function sfc32(a, b, c, d) {
		return function() {
			a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
			let t = (a + b) | 0;
			a = b ^ b >>> 9;
			b = c + (c << 3) | 0;
			c = (c << 21 | c >>> 11);
			d = d + 1 | 0;
			t = t + d | 0;
			c = c + t | 0;
			return (t >>> 0) / 4294967296;
		};
	}

	// Respect an existing RNG (e.g., from npc.js), otherwise create one; in both cases ensure helpers exist.
	(function ensureRng(){
		const epoch = 1700000000000; // align with npc.js default
		if (!setup.rng || typeof setup.rng.rand !== 'function') {
			const seedString = 'cod-default';
			const seedGen = xmur3(seedString);
			const rng = sfc32(seedGen(), seedGen(), seedGen(), seedGen());
			let ticks = 0;
			setup.rng = {
				seedString,
				rand: rng,
				reseed(str){
					this.seedString = str;
					const g = xmur3(str);
					this.rand = sfc32(g(), g(), g(), g());
					ticks = 0;
				},
				pick(arr){ return (arr && arr.length) ? arr[Math.floor(this.rand()*arr.length)] : undefined; },
				roll(min, max){ return Math.floor(this.rand()*(max - min + 1)) + min; },
				rollInt(min, max){ return Math.floor(this.rand()*(max - min + 1)) + min; },
				rollFloat(min, max){ return this.rand()*(max - min) + min; },
				chance(p){ return this.rand() < p; },
				nowISO(){ return new Date(epoch + (ticks++) * 137).toISOString(); }
			};
		} else {
			const r = setup.rng;
			if (!r.pick) r.pick = arr => (arr && arr.length) ? arr[Math.floor(r.rand()*arr.length)] : undefined;
			if (!r.roll && !r.rollInt) r.rollInt = (min,max) => Math.floor(r.rand()*(max - min + 1)) + min;
			if (!r.rollFloat) r.rollFloat = (min,max) => r.rand()*(max - min) + min;
			if (!r.chance) r.chance = p => r.rand() < p;
			if (!r.nowISO) {
				let ticks = 0; const ep = epoch;
				r.nowISO = () => new Date(ep + (ticks++) * 137).toISOString();
			}
			if (!r.reseed) {
				r.reseed = function(str){
					const g = xmur3(String(str));
					this.rand = sfc32(g(), g(), g(), g());
				};
			}
		}
	})();

	/* ================= Trait & Archetype Definitions ================= */
	setup.Traits = [
		{ id:'resilient',   tags:['health'],    mods:{ maxHealth:+15, stressRes:+5 } },
		{ id:'frail',       tags:['health'],    mods:{ maxHealth:-20, stressRes:-5 } },
		{ id:'observant',   tags:['perception'],mods:{ awareness:+10 } },
		{ id:'oblivious',   tags:['perception'],mods:{ awareness:-10 } },
		{ id:'dogged',      tags:['will'],      mods:{ will:+10, fatigueRate:+5 } },
		{ id:'anxious',     tags:['will'],      mods:{ will:-10, stressGain:+5 } },
		{ id:'stoic',       tags:['will'],      mods:{ stressGain:-5 } },
		{ id:'limping',     tags:['injury'],    mods:{ moveSpeed:-20 }, startingFlags:['oldInjury'] }
	];

	setup.Archetypes = [
		{ id:'laborer', base:{ maxHealth:80, awareness:30, will:40 }, traitBias:['resilient','dogged'] },
		{ id:'scribe',  base:{ maxHealth:60, awareness:55, will:35 }, traitBias:['observant','anxious'] },
		{ id:'scav',    base:{ maxHealth:70, awareness:45, will:45 }, traitBias:['observant','dogged'] },
		{ id:'vagrant', base:{ maxHealth:65, awareness:35, will:30 }, traitBias:['frail','stoic'] }
	];

	/* ================= Name Fragments ================= */
	setup.NameFragments = {
		prefixes:['Ash','Mar','Sol','Ren','Cor','Lis','Dre','Hal','Jun','Vor','Tal','Ine','Sar','Gal','Per','Nol'],
		middles:['en','or','is','a','el','ur','an','ith','om','ra','ia','os','et','yl','un'],
		suffixes:['', 'n','th','s','a','el','or','e','is','en','as','ir','ul']
	};

	setup.generateName = function(){
		const f = setup.NameFragments;
		const parts = [setup.rng.pick(f.prefixes), setup.rng.pick(f.middles)];
		if (setup.rng.rand() < 0.65) parts.push(setup.rng.pick(f.suffixes));
		let name = parts.join('');
		if (setup.rng.rand() < 0.25) {
			// occasional two-part name
			name += ' ' + setup.rng.pick(f.prefixes) + setup.rng.pick(f.suffixes);
		}
		return name;
	};

	/* ================= NPC Generation ================= */
	setup.pickTrait = function (biasList) {
		// Weighted pick: if any bias trait appears in trait definitions, increase chance.
		const pool = [];
		setup.Traits.forEach(t => {
			let weight = 1;
			if (biasList && biasList.includes(t.id)) weight += 2;
			for (let i=0;i<weight;i++) pool.push(t);
		});
		return setup.rng.pick(pool);
	};

	setup.generateNPC = function(index){
		const arch = setup.rng.pick(setup.Archetypes);
		const traitPrimary = setup.pickTrait(arch.traitBias);
		const traitSecondary = setup.pickTrait(arch.traitBias.filter(t=>t!==traitPrimary.id));
		const base = Object.assign({}, arch.base);
		// apply trait mods
		function applyMods(target, trait){
			if (!trait || !trait.mods) return; Object.keys(trait.mods).forEach(k=>{ target[k] = (target[k]||0)+trait.mods[k]; });
		}
		applyMods(base, traitPrimary); applyMods(base, traitSecondary);
		// ensure minimums
		['maxHealth','awareness','will'].forEach(k=>{ if(base[k] < 1) base[k] = 1; });
		const npc = {
			id: 'npc'+index,
			name: setup.generateName(),
			archetype: arch.id,
			traits:[traitPrimary.id, traitSecondary.id],
			stats: base,
			health: base.maxHealth,
			injuries: [],
			flags: (traitPrimary.startingFlags||[]).concat(traitSecondary.startingFlags||[]),
			trust:{}, fear:{},
			location: 'settlement',
			alive: true,
			createdCycle: 0
		};
		return npc;
	};

	setup.generatePopulation = function(count){
		const arr = [];
		for (let i=0;i<count;i++) arr.push(setup.generateNPC(i+1));
		return arr;
	};

	/* ================= Game Initialization ================= */
	setup.initNewGame = function(seed){
		const v = State.variables;
		// Establish seed (URL override > passed seed > timestamp)
		if (!seed) {
			const urlParams = new URLSearchParams(window.location.search);
			seed = urlParams.get('seed') || ('cod-' + Date.now() + '-' + Math.floor(Math.random()*1e6));
		}
		setup.rng.reseed(seed);
		v.legacy = {
			seed: seed,
			cycles: 0,
			pastLives: [],
			populationRoster: [],
			discoveredLore: []
		};
		v.world = {
			time: 0,
			entropy: 0,
			day: 0
		};
		// Use new rich NPC system if available
		const populationSize = 20; // TODO: surface user setting or difficulty scaling
		if (setup.NPC && setup.NPC.generatePopulation) {
			v.legacy.populationRoster = setup.NPC.generatePopulation(populationSize);
		} else {
			console.warn('[initNewGame] Rich NPC module missing; falling back to basic generation');
			v.legacy.populationRoster = [];
		}
		// First playable character: copy first roster entry (retain reference clone to avoid mutating roster directly during play)
		if (v.legacy.populationRoster.length) {
			v.pc = Object.assign({}, v.legacy.populationRoster[0], { isPlayer:true });
			v.player = v.pc; // alias for UI code expecting player
		} else {
			v.pc = { id:'PC_Fallback', name:'Fallback', isPlayer:true };
			v.player = v.pc;
		}
		v._genInfo = { populationSize: populationSize, schema: setup.NPC?.SCHEMA_VERSION };
	};

	/* ================= Macro: newgame ================= */
	Macro.add('newgame', {
		handler() {
			const seedArg = this.args[0];
			setup.initNewGame(seedArg);
			Engine.play('Start');
		}
	});

	/* Helper: ensure game initialized exactly once per fresh load */
	if (!State.variables.legacy) {
		// Defer actual initialization to StoryInit (ensures SugarCube standard order), but set flag.
		State.variables._needsInit = true;
	}
})();

