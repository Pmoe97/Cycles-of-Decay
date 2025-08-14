/* Minimal shape checker comparing npc -> sample */
(function(){
  // Paste your sample object here without comments, or construct its shape:
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
      const sp = sample[k], op = obj?.[k];
      const pth = path + "." + k;
      if (sp === null || typeof sp !== "object" || Array.isArray(sp)) {
        if (typeof op === "undefined") errs.push("Missing key: " + pth);
      } else {
        if (typeof op !== "object") errs.push("Missing/invalid object: " + pth);
        else shapeMatch(sp, op, pth, errs);
      }
    }
    return errs;
  }

  // Run the shape check after the story is ready, without reseeding the global RNG.
  $(document).one(':storyready', function() {
    if (!setup.NPC || !setup.NPC.generatePopulation) {
      console.warn('[shape-check] NPC module not available; skipping');
      return;
    }
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
