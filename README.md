# Cycles of Decay

Interactive fiction project built with Twine (Twee3) + SugarCube 2.37.3 and tweego.

## Structure
```
/build              Compiled output (index.html)
/dev
  /twine            Twee story source passages (*.twee)
  /story            (Optional) Additional modular passage files
  /js               Custom JavaScript (e.g., macros, init)
  /styles           CSS
  /html             Extra HTML fragments injected into head/footer
/assets
  /images           Image assets (not compiled by tweego)
  /audio            Audio assets (not compiled by tweego)
```

## tweego compile command
Example (PowerShell):
```
tweego -o build/index.html -f sugarcube-2 dev/twine dev/story dev/js dev/styles
```
Explanation:
- `-f sugarcube-2` selects SugarCube 2 story format (ensure installed; tweego bundles some formats or place in PATH/formats directory).
- Head/footer fragment injection: tweego itself does not natively merge arbitrary HTML fragments like `-m` / `-a` (that was an idea for other toolchains). Instead, include external CSS/JS by referencing them inside SugarCube special passages (StoryStylesheet / StoryScript) or by bundling content directly in `.css` and `.js` files which tweego will inline.
- Order: directories are scanned; all `.twee` processed first, then JS/CSS assets in listed order.

## Special Passages Scaffolded
- StoryTitle
- StoryData
- StorySettings
- StoryCaption
- StoryAuthor
- StorySubtitle
- StoryBanner
- StoryStylesheet
- StoryScript
- StoryInit
- StoryMenu
- Start

## Adding New Passages
Create additional `.twee` files under `dev/story` or extend `story.twee`. Each passage begins with `:: PassageName [tags]`.

## Custom Macros
Add new JS files in `dev/js` and they will be bundled if given to tweego on the command line.

## Version Bump
Update the `format-version` in StoryData if targeting a newer SugarCube release.

## IFID
Replace `REPLACE-WITH-IFID` with a generated IFID (use https://www.tads.org/ifidgen/ or `tweego -g`).

## License
Add your licensing info here.



__________________________________________________________
Initial Structure and System Plan (Will change over time)
__________________________________________________________

Checklist (requirements coverage)
Clarify core premise into actionable systems ✅
Design for disempowerment & no hero arc ✅
Cycle-of-lives mortality & persistence framework ✅
Persistent world state across deaths ✅
Limited/risky combat & competence framing ✅
Permanent injuries & sickness system ✅
NPC ecosystem with relationships & social standing ✅
Time pressure & autonomous world events ✅
World indifference & off-screen progression ✅
Decay / simulation corruption mechanics ✅
Punishment-with-purpose feedback loops ✅
Tone scaffolding: bleak UI, uncertainty, glitch aesthetic ✅
Optional, gated, tone-consistent NSFW integration ✅
Core Architecture (SugarCube Orientation)
Use 3 conceptual layers of state:

Run-Time Character State (resets each cycle): $pc (id, name, stats, injuries[], location, mental, inventory[])
Persistent World State (survives cycles): $world (entropy, day, weather, locations[], resources, corpses[], structuralDamage[], eventsLog[])
Meta / Legacy State: $legacy (cycles, pastLives[], discoveredLore[], populationRoster[])
Store static definitions in Setup.* (e.g., Setup.NPCPrototypes, Setup.InjuryTypes) to avoid cloning mistakes. Use functions/macros for mutators to keep rules centralized.

Life-Cycle Loop (High-Level)
Start Cycle: pick next living NPC from $legacy.populationRoster (weighted by unresolved threads or randomness) → assign to $pc.
Initialize dynamic hooks (scheduled events, daily decay increment).
Player acts (passages consume time). Each action calls <<advanceTime n>> which:
increments $world.time, may tick decay, schedules off-screen NPC actions, resolves due events.
Triggers (injury deterioration, hunger, entropy glitches) may inject interstitial event passages.
Death Condition (hp <=0, sepsis, exposure, scripted collapse) -> record corpse artifact, append to $legacy.pastLives, mutate world (e.g., resource drop, infection hotspot), remove chosen NPC from roster.
If roster empty → End State (World collapse / simulation reveal). Else loop.
Time & Event System
Represent discrete time units (e.g., minutes or “ticks”).
Variables:

$world.time (absolute ticks)
$world.day = Math.floor($world.time / TICKS_PER_DAY)
Scheduler: $events = [{id, atTime, kind, payload, resolved:false}]
Macro <<scheduleEvent time kind payloadObj>> pushes event; <<advanceTime n>> iterates events with atTime <= now and not resolved; dispatches to handler functions (Setup.EventHandlers[kind]).
Off-screen NPC actions: each advanceTime selects a subset of living NPCs to attempt an action (foraging, moving, dying, conflicting) based on role & current scarcity.
Decay / Simulation Corruption (Entropy Engine)
Variable: $world.entropy (0–100+). Sources: time, player destabilizing actions, triggered glitches.
Threshold Bands:

10+: Minor UI flickers (CSS class “glitch1”), subtle text distort
25+: Resource spawn rate -10%, occasional NPC script anomalies (wrong dialogue pronouns)
40+: Structural collapses (lock locations), path disruptions
60+: Memory leakage (you see debug-like fragments, e.g., raw variable names)
80+: Deterministic logic misfires (scheduler duplicates / drops events)
95+: Collapse events forcing final cycles
Implementation devices:
A per-tick <<applyDecay>> macro adjusting environment & spawning glitch events.
CSS injection passage with conditional classes; textual filters (custom Wikifier formatter) to obfuscate lines (e.g., randomly replace letters or insert █).
Data corruption: probabilistically mutate an NPC attribute (e.g., trust->NaN) then handle fallback (interpreted as 0). This creates systemic decay rather than purely cosmetic effects.
NPC Ecosystem
Data model (each entry in $legacy.populationRoster & live list $npcs):
{id, name, archetype, alive:true, location, health, injuries:[], trust:{npcId:0..100}, fear:{npcId:0..100}, statusFlags:[], roleTags:[], needs:{food, warmth, sleep}, memories:[], secrets:[], corruption:0}
Trust & fear drive cooperation vs exploitation. Interaction choices adjust both; off-screen events also adjust (e.g., famine reduces general trust).
Population Dwindling: After each cycle (or every N days) run cull logic: evaluate each NPC’s needs; those under thresholds risk death (adds corpse to world).
Body Persistence: corpses[] include (npcId, timeOfDeath, cause, location); later cycles can discover them (affect mood, gain clues, or harvest items → ethical cost).

Player Disempowerment & Limited Competence
No global skill growth; per-life stats differ (pulled from NPC definition).
Attempting heroics (multi-enemy defense, dangerous rescue) triggers difficulty multipliers.
Provide a “Desperation” stat: increases under cumulative stress but using it (pushing beyond capability) inflicts permanent injury risk or accelerates entropy (simulation strain).
Combat is a resolution macro <<resolveConflict context>> that:
Considers participant fear, injuries, environment hazard, and random noise skewed toward failure.
Always yields consequence (even “success” costs fatigue/injury).
Injuries & Sickness (Persistent Consequences)
Injury object: {type, severity, onsetTime, flags:[bleeding, infected], prognosis:{worsenAtTime}}
Permanent Injury Rules: If severity >= major OR death occurs with untreated moderate injury, store signature in $legacy.persistentInjuryPool influencing future spawn stats (world physically accumulates debility). Mechanically: future PCs may spawn with a scar that reduces max stamina by X or imposes a random pain flare event.
Disease progression: scheduled events that escalate if not treated; treatment consumes scarce resources (antiseptics, rest inside warm shelter).
Macro examples you’ll later implement:

<<inflictInjury "laceration" 2>>
<<tickInjuries>> inside <<advanceTime>>
Injury UI: Side panel lists only top-risk conditions (avoid clutter; maintain oppressive minimalism).
Scarcity & Resource Model
$world.resources: {food:{stock, regenRate}, fuel:{}, meds:{}, salvage:{}}
Decay interacts: $world.entropy reduces regenRate; off-screen NPC consumption reduces stock each tick based on population. Foraging events risk injury & time cost; returns variable yield influenced by entropy & location depletion flags.
Introduce irreversible depletion tokens (location.depleted=true) to reinforce finality.

Memory & Lore Persistence
$legacy.discoveredLore: array of {id, sourceLife, firstFoundTime}.
On new life start, only partial subset is “recalled” (simulate imperfect continuity): derive $pc.knownLore = sample(discoveredLore, recallFactor based on entropy or special artifacts).
Bodies, notes, carved messages (player can leave before death) are diegetic memory devices. Each message becomes world object others can find, enabling emergent narrative (“I died here. Don’t trust the Well.”).

Uncertainty & Information Friction
Mechanics:

Fogged Stats: Show ranges (e.g., “Stamina: Low–Moderate”) until certain observation actions.
Conflicting NPC Reports: For each rumor event, generate two variant truth values; player only gets one.
Glitch Lies: At high entropy, some UI ranges invert or stale-cache.
Event Categories (suggested taxonomy)
Environmental (weather shift, structural collapse, power flicker)
Social (argument, theft, betrayal, negotiation)
Survival (forage outcome, illness onset, infestation)
Glitch (time skip, duplicated NPC, text corruption)
Legacy Trigger (finding past body, message, unlocking hidden area)
NSFW (optional) – intimacy under duress, barter encounters, consent & power dynamics checks.
Each category has a handler in Setup.EventHandlers with pure functions referencing world state; narrative passages pull data via tags (e.g., passage tagged [event-glitch]).

Passage Structure Strategy
Core control passages (hidden from player navigation):

Engine (initializes, handles cycle transitions)
TickResolver (called after <<advanceTime>>)
DeathHandler (records legacy, selects next life)
StartCycle (spawns $pc, rebuilds side UI)
Content Passages: location_* (environment description with dynamic overlays for decay level), encounter_* (generated events), memory_* (finding past traces).

Use tags for filtering dynamic lists (Story.getTaggedPassages("location")) to randomly surface variant descriptions depending on entropy band.

Macros to Plan (Pseudo Signatures)
<<advanceTime n>>: updates time, calls ApplyDecay, schedules/resolves events, ticks injuries, runs NPC actions, triggers random encounter chance.
<<applyDecay>>: increments entropy (if conditions), triggers visual glitch probability, updates resource regen modifiers.
<<scheduleEvent at kind payload>>
<<inflictInjury type severity>>
<<attemptAction actionType difficulty contextObj>>: central risk resolution (returns success, partial, fail) + consequence object.
<<recordLegacy key value>>: standardized logging for analytics / future balancing.
<<spawnGlitch severity>>: modifies UI (append glitch CSS classes, partial text corruption).
Keep macro code in a dedicated JS file (e.g., state.js or new dev/js/systems.js) and register via Story JavaScript section or external include.
UI & Tone Implementation Notes
Side panel minimal: current identity (not “heroic class”), time (obfuscated at high entropy: “Late” instead of 22:30), vital risk cues (injury icons degrade visually).
Progressive CSS corruption: inject style tags adding scanlines, desaturation, text jitter animations as entropy thresholds passed.
Avoid bright success colors; use muted palette (#666 success, #933 injuries).
Replace some verbs (“Win”, “Defeat”) with tone-consistent outcomes (“Outlasted”, “Escaped”, “Survived For Now”).
Player Death Handling
Edge cases:

Mid-transaction death (resolve transaction first, then death to avoid half-updated state).
Simultaneous scheduled lethal event + voluntary risky action: order resolution deterministically (always process scheduled events first to prevent exploit).
After death: show brief “Transition” passage; do not info-dump all consequences—drip-feed via future discoveries.
Failure as Information
Every major negative outcome surfaces a new hint token (e.g., adds to $legacy.observations[]) which quietly improves future risk estimates (modify attemptAction to reduce uncertainty range if observation relevant). This ties difficulty to learning, not raw stat growth.

Optional NSFW Integration (Gated & Tone-Safe)
Toggle: $settings.nsfw (opt-in early).
Content isolation: Tag all related passages/macros with nsfw; only queue if toggle true AND context risk factors (e.g., no safe comfortable scenes—keep tension).
Mechanical Functions:

Intimacy may: slightly restore morale / reduce stress, create trust bond or debt, or introduce jealousy event risk.
Barter Sex: convert vulnerability into resource gain but increases future exploitation risk (flag on NPC).
Safeguards: ensure consent framing variables (both agents not incapacitated; skip if power imbalance flagged extreme) to maintain ethical tone.
Edge Cases & Safeguards
Empty Roster: trigger final revelation / simulation collapse ending branch.
Entropy Overflow: clamp but push escalating glitch events to avoid stall.
Event Pile-Up: cap simultaneous pending events; if overflow, merge lesser ones into a composite “Confusion” event (narratively: you lose clear sequence).
NPC ID Reuse after corruption: ensure unique IDs even if name duplication glitch occurs; store canonical id separate from displayName.
Incremental Build Order (Practical Roadmap)
Skeleton: cycle loop (spawn -> actions -> death) with placeholder passages.
Time & scheduler macros (advanceTime, scheduleEvent).
World persistence objects ($world, $legacy).
Entropy & minimal glitch (CSS class toggle).
NPC roster + off-screen consumption & attrition.
Injuries & basic risk resolution macro.
Corpse & artifact persistence (find past body).
Resource scarcity loops and depletion flags.
Memory recall & partial lore retention.
Expanded glitches (text corruption, logic anomalies).
Optional NSFW layer (behind toggle).
Balancing pass (tune entropy rates & attrition curves).
Testing & Telemetry Hooks
Add a debug mode (URL flag ?debug=1) enabling:

A panel with entropy, scheduled events count, NPC alive count, average trust.
Fast-forward macro <<ff hours>> to stress test attrition.
Log (append to $legacy._debugLog) key state transitions for later balancing.
