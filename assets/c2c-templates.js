/*! C2C Studio · Your own default templates.
 *  Put project files exported with Options > Export project into /templates/ and list them in /templates/index.json:
 *    [ { "file": "my-rose.json", "label": "Rose" } ]
 *  They show in the Charts dropdown under "Chet Chic designs". A missing index.json is ignored.
 */
(function () {
  'use strict';
  var INDEX_URL = '/templates/index.json';
  var GROUP_LABEL = 'Chet Chic designs';
  var items = [];      // [{id, label, file}]
  var charts = {};     // id -> {name,width,height,yarns,cells}
  var bypass = null;

  function isHex(h) { return typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h); }
  function toChart(raw, label) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.kind && raw.kind !== 'cornerwise-project') return null;
    var w = Math.round(Number(raw.width)), h = Math.round(Number(raw.height));
    if (!(w >= 1 && w <= 300 && h >= 1 && h <= 300)) return null;
    if (!Array.isArray(raw.yarns) || raw.yarns.length < 1 || raw.yarns.length > 52) return null;
    var yarns = [];
    for (var i = 0; i < raw.yarns.length; i++) {
      var y = raw.yarns[i];
      if (!y || !isHex(y.hex)) return null;
      yarns.push({ id: typeof y.id === 'string' ? y.id : 'y' + i, name: String(y.name || ('Yarn ' + (i + 1))).slice(0, 40), hex: y.hex.toLowerCase() });
    }
    if (!Array.isArray(raw.cells) || raw.cells.length !== w * h) return null;
    var cells = raw.cells.map(function (v) { v = Number(v) | 0; return v >= 0 && v < yarns.length ? v : 0; });
    return { name: String(raw.name || label || 'Template').slice(0, 60), width: w, height: h, yarns: yarns, cells: cells };
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  var ready = fetch(INDEX_URL, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (list) {
      if (!Array.isArray(list)) return [];
      return Promise.all(list.slice(0, 200).map(function (e) {
        if (!e || typeof e.file !== 'string' || /(^|\/)\.\.(\/|$)|^[a-z]+:|^\//i.test(e.file)) return null;
        var url = '/templates/' + e.file;
        return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
          .then(function (raw) {
            var c = toChart(raw, e.label);
            if (!c) { console.warn('C2C template skipped (not a valid exported project):', url); return null; }
            var id = 'user:' + slug(e.file);
            charts[id] = c;
            return { id: id, label: String(e.label || c.name).slice(0, 60), file: e.file };
          });
      }));
    })
    .then(function (rows) { items = (rows || []).filter(Boolean); try { window.dispatchEvent(new CustomEvent('c2c-templates', { detail: { count: items.length } })); } catch (e) {} return items; });

  // ---- confirm before replacing a chart that has work on it ----
  function hasWork(st) { return st && st.cells && st.cells.some(function (v) { return v !== 0; }); }
  function confirmFirst(id, st) {
    // the manual promises a question before any template replaces painted work (built-in ones too)
    if (bypass === id) { bypass = null; return false; }
    if (!hasWork(st)) return false;
    showConfirm(id, items.filter(function (t) { return t.id === id; })[0] || null, function () {
      bypass = id; window.C2CStore.getState().applyPreset(id);
    });
    return true;
  }
  function showConfirm(id, item, ok) {
    var d = document.createElement('div');
    d.className = 'no-print c2c-confirm';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'c2c-confirm-title');
    d.innerHTML = '<div class="c2c-confirm-card"><h2 id="c2c-confirm-title">Replace the chart?</h2>' +
      '<p>Load \u201c' + String(item ? item.label : 'this template').replace(/[<>&]/g, '') + '\u201d. Your current chart is replaced. You can undo this.</p>' +
      '<div class="c2c-confirm-row"><button type="button" data-a="no">Cancel</button><button type="button" data-a="yes" class="c2c-primary">Replace</button></div></div>';
    d.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b && e.target !== d) return;
      var yes = b && b.getAttribute('data-a') === 'yes'; d.remove(); if (yes) ok();
    });
    document.body.appendChild(d);
    var y = d.querySelector('[data-a="yes"]'); if (y) y.focus();
  }

  window.C2CTemplates = {
    groupLabel: GROUP_LABEL,
    ready: ready,
    list: function () { return items; },
    chart: function (id) {
      var c = charts[id];
      return c ? { name: c.name, width: c.width, height: c.height, yarns: c.yarns.map(function (y) { return { id: y.id, name: y.name, hex: y.hex }; }), cells: c.cells.slice() } : null;
    },
    confirmFirst: confirmFirst,
    builtInName: function () { return ''; }, // replaced by the bundle patch (pt lookup)
    _toChart: toChart
  };
})();
