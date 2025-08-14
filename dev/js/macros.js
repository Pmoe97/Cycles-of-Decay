
Macro.add('datacheck', {
  handler() {
    const out = [];
    function assert(cond, msg){ if(!cond) out.push('✗ ' + msg); }

    // basic presence
    const D = setup.data || {};
    ['enums','traits','occupations','injuries','items','equipmentPools','names','locations','schedules']
      .forEach(k => assert(D[k], `Missing setup.data.${k}`));

    // referential checks
    const itemIds = new Set((D.items||[]).map(x=>x.id));
    const locIds  = new Set((D.locations||[]).map(x=>x.id));

    // equipment pool ids exist
    const P = D.equipmentPools || {};
    ['clothing_body','clothing_hands','mainHand'].forEach(pool => {
      (P[pool]||[]).forEach(id => {
        if (id && !itemIds.has(id)) out.push(`✗ equipmentPools.${pool}: unknown item ${id}`);
      });
    });

    // pack ids exist
    (P.pack||[]).forEach(p => { if (!itemIds.has(p.id)) out.push(`✗ equipmentPools.pack: unknown item ${p.id}`); });

    // schedule locations exist
    const S = D.schedules || {};
    Object.keys(S).forEach(k => S[k].forEach(b => {
      if (!locIds.has(b.at)) out.push(`✗ schedules.${k} points to unknown location ${b.at}`);
    }));

    new Wikifier(this.output, out.length ? out.join('<br>') : '✔ Data OK');
  }
});
