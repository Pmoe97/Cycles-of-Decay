/* SugarCube setup & initialization for Cycles of Decay */
(function () {
	'use strict';
	/* Called once on load */
	$(document).one(':storyready', function () {
		console.log('Cycles of Decay story ready');
	});

	/* Example: Global Config */
	Config.history.maxStates = 50; // tweak as needed
	Config.saves.autoload = true;

	/* Example: Setup object */
	setup.world = {
		version: '0.0.1',
		buildTime: new Date().toISOString()
	};

	/* Provide simple link macros if missing (compat with various configs) */
	if (!Macro.get('restart')) {
		Macro.add('restart', { handler() { Engine.restart(); } });
	}
	if (!Macro.get('save')) {
		Macro.add('save', { handler() { Save.save(); } });
	}
	if (!Macro.get('load')) {
		Macro.add('load', { handler() { Save.load(); } });
	}

	/* Macro examples placeholder (add custom macros in separate file if desired) */
})();

/* ===== NPC Editor helpers (load early) ===== */
(function () {
  'use strict';
  window.setup = window.setup || {};

  // idempotent guards
  if (!setup.deepClone) setup.deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  if (!setup.setByPath) setup.setByPath = function (obj, path, value) {
    const parts = path.split('.'); let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i]; if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  };

  if (!setup.getByPath) setup.getByPath = function (obj, path) {
    const parts = path.split('.'); let cur = obj;
    for (let i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  };

  function niceKey(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (!setup.renderNPCEditor) setup.renderNPCEditor = function (npcDraft) {
    const rows = [];
    function field(path, key, val) {
      const full = path ? path + '.' + key : key;
      const label = esc(niceKey(key));

      if (val === null || val === undefined) {
        rows.push(`<div class="row"><label>${label}</label><input class="npc-edit" data-type="string" data-path="${esc(full)}" value=""></div>`); return;
      }
      if (Array.isArray(val)) {
        rows.push(`<details open class="grp"><summary>${label} [Array ${val.length}]</summary>
          <div class="row"><label>JSON</label>
          <textarea class="npc-edit" data-type="array" data-path="${esc(full)}">${esc(JSON.stringify(val))}</textarea>
          <div class="hint">Enter JSON array (e.g., ["a","b"] or [1,2,3]).</div></div></details>`); return;
      }
      if (typeof val === 'object') {
        const inner = Object.keys(val).map(k => (field(full, k, val[k]) || '')).join('');
        rows.push(`<details open class="grp"><summary>${label} [Object]</summary>${inner}</details>`); return;
      }
      if (typeof val === 'boolean') {
        rows.push(`<div class="row"><label>${label}</label><input class="npc-edit" data-type="boolean" data-path="${esc(full)}" type="checkbox" ${val ? 'checked' : ''}></div>`); return;
      }
      if (typeof val === 'number') {
        rows.push(`<div class="row"><label>${label}</label><input class="npc-edit" data-type="number" data-path="${esc(full)}" type="number" step="any" value="${val}"></div>`); return;
      }
      rows.push(`<div class="row"><label>${label}</label><input class="npc-edit" data-type="string" data-path="${esc(full)}" value="${esc(val)}"></div>`);
    }

    const order = ['id','version','lifecycle','identity','background','personality','attributes','derived','skills','conditions','entropy','inventory','relationships','knowledge','behavior','flags','debug'];
    order.forEach(k => { if (Object.prototype.hasOwnProperty.call(npcDraft, k)) field('', k, npcDraft[k]); });
    Object.keys(npcDraft).forEach(k => { if (!order.includes(k)) field('', k, npcDraft[k]); });

    return `<form id="npc-edit-form" class="npc-edit-form">
      ${rows.join('')}
      <div class="btns"><button type="button" id="npc-save" class="ui-button">Save</button>
      <button type="button" id="npc-cancel" class="ui-button secondary">Cancel</button></div>
    </form>`;
  };

  if (!setup.bindNPCEditor) setup.bindNPCEditor = function (npcId) {
    function readControlsIntoDraft() {
      var draft = State.variables.npcDraft;
      $('.npc-edit').each(function () {
        var t = this.getAttribute('data-type');
        var p = this.getAttribute('data-path');
        var v;
        if (t === 'boolean') v = this.checked;
        else if (t === 'number') { var n = this.value.trim(); v = n === '' ? 0 : Number(n); }
        else if (t === 'array') { var txt = this.value.trim(); try { v = txt ? JSON.parse(txt) : []; } catch (e) { v = []; } }
        else v = this.value;
        setup.setByPath(draft, p, v);
      });
    }
    $('#npc-save').on('click', function () {
      readControlsIntoDraft();
      var id = npcId;
      State.variables.actors[id] = State.variables.npcDraft;
      UI.alert('Saved changes to ' + id);
    });
    $('#npc-cancel').on('click', function () { Engine.play('NPC Inspector'); });
  };

})();

