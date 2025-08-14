# NPC Data Tables (authorable)

These JS wrappers populate `setup.data.*` at runtime (Tweego bundles them).  
Edit lists here to change NPC generation without touching code.

## Tables
- `enums.js` — canonical enums (species/genders/pronouns/wards/bodyStatus)
- `names.js` — first/last name pools
- `traits.js` — personality traits (id, tags, attribute mods, weight)
- `occupations.js` — occupation templates (base attributes, trait bias, factions, schedule key)
- `injuries.js` — affliction templates (id, location, severityRange, mods, tags, defaultTreat)
- `items.js` — master item DB
- `equipmentPools.js` — slot pools and weighted pack items
- `locations.js` — location ids used in schedules & knowledge pins
- `schedules.js` — occupation→default blocks (days/start/end/at)

## Validation
Use the debug passage and run:


<<datacheck>>

to catch missing item/location references early.

## Quick check
- Confirm these files exist in `dev/data/npc/` with the intended content.
- Tweego will bundle these JS files automatically.
- In the running story, open the browser console and run:

```
Object.keys(setup.data)
```

You should see: `enums, names, traits, occupations, injuries, items, equipmentPools, locations, schedules`.

In a debug passage, add `<<datacheck>>` to verify cross-refs.
