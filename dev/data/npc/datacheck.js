/* dev/data/npc/datacheck.js */
window.setup = window.setup || {};
(function(){
  Macro.add('datacheck', {
    handler() {
      const out = [];
      function assert(cond, msg){ if(!cond) out.push('✗ ' + msg); }
      const D = setup.data || {};
      ['enums','traits','occupations','injuries','items','equipmentPools','names','locations','schedules']
        .forEach(k => assert(D[k], `Missing setup.data.${k}`));

      const items = new Set((D.items||[]).map(x=>x.id));
      const locs  = new Set((D.locations||[]).map(x=>x.id));

      const P = D.equipmentPools || {};
      ['clothing_body','clothing_hands','mainHand'].forEach(pool => {
        (P[pool]||[]).forEach(id => { if (id && !items.has(id)) out.push(`✗ equipmentPools.${pool}: unknown item ${id}`); });
      });
      (P.pack||[]).forEach(p => { if (!items.has(p.id)) out.push(`✗ equipmentPools.pack: unknown item ${p.id}`); });

      const S = D.schedules || {};
      Object.keys(S).forEach(k => (S[k]||[]).forEach(b => {
        if (!locs.has(b.at)) out.push(`✗ schedules.${k} → unknown location ${b.at}`);
      }));

      new Wikifier(this.output, out.length ? out.join('<br>') : '✔ Data OK');
    }
  });
})();
