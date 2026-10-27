/*! C2C Studio · Add text tool: bitmap letters sized in rows, live preview, Place / Cancel (one undo step). */
(function () {
  'use strict';
  var MIN = 5, MAX = 30;
  function glyph(ch) { var f = window.C2CFont || {}; return f[ch] || null; }
  function clampH(h) { h = Math.round(Number(h) || 7); if (h < MIN) h = MIN; if (h > MAX) h = MAX; return h; }

  // Returns [{r,c}] offsets for the text, top-left at 0,0. Glyphs are 5x7 and are scaled to `height` rows.
  function layout(text, height) {
    var H = clampH(height), W = Math.max(3, Math.round(H * 5 / 7)), gap = Math.max(1, Math.round(H / 7));
    var out = [], x = 0, str = String(text || '').toUpperCase();
    for (var k = 0; k < str.length; k++) {
      var ch = str[k];
      if (ch === ' ') { x += Math.round(W * 0.6) + gap; continue; }
      var g = glyph(ch); if (!g) continue;
      for (var y = 0; y < H; y++) {
        var sy = Math.min(6, Math.floor(y * 7 / H));
        for (var xx = 0; xx < W; xx++) {
          var sx = Math.min(4, Math.floor(xx * 5 / W));
          if (g[sy * 5 + sx] === '1') out.push({ r: y, c: x + xx });
        }
      }
      x += W + gap;
    }
    return { cells: out, width: Math.max(0, x - gap), height: H };
  }

  // Same signature as the app's original placer: (cells, width, height, text, row, col, yarn, size)
  function raster(cells, w, h, text, row, col, yarn, size) {
    if (!String(text || '').trim()) return null;
    var L = layout(text, size), next = cells.slice(), any = false;
    for (var i = 0; i < L.cells.length; i++) {
      var r = row + L.cells[i].r, c = col + L.cells[i].c;
      if (r < 0 || c < 0 || r >= h || c >= w) continue;
      next[r * w + c] = yarn; any = true;
    }
    return any ? next : null;
  }

  // ---------- preview ----------
  var pv = null; // { index }
  var cv = null, bar = null;
  function store() { return window.C2CStore && window.C2CStore.getState ? window.C2CStore.getState() : null; }
  function inputs() {
    var t = document.querySelector('input[aria-label="Text to place on the chart"]');
    var s = document.querySelector('select[aria-label="Letter height in rows"]');
    return { text: t ? t.value : '', size: s ? Number(s.value) : 7 };
  }
  function geometry(st) {
    var app = document.querySelector('[role="application"]');
    if (!app) return null;
    var w = st.width, h = st.height;
    var c0 = app.querySelector('[data-cell="0"]');
    if (c0) {
      var r0 = c0.getBoundingClientRect();
      var c1 = w > 1 ? app.querySelector('[data-cell="1"]') : null;
      var cw = h > 1 ? app.querySelector('[data-cell="' + w + '"]') : null;
      var px = c1 ? c1.getBoundingClientRect().left - r0.left : r0.width;
      var py = cw ? cw.getBoundingClientRect().top - r0.top : r0.height;
      return { x: r0.left, y: r0.top, px: px, py: py, size: Math.min(r0.width, r0.height) };
    }
    var canvas = app.querySelector('canvas.chart-cell');
    if (!canvas) return null;
    var rc = canvas.getBoundingClientRect();
    return { x: rc.left, y: rc.top, px: rc.width / w, py: rc.height / h, size: Math.max(1, rc.width / w - (rc.width / w >= 5 ? 1 : 0)) };
  }
  function ensureUI() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'c2c-text-preview';
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:22;';
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'c2c-text-bar';
      bar.className = 'no-print';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Text preview');
      bar.innerHTML = '<span class="c2c-text-hint">Preview. Tap another square to move it.</span>' +
        '<button type="button" data-act="cancel">Cancel</button>' +
        '<button type="button" data-act="place" class="c2c-primary">Place text</button>';
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.getAttribute('data-act') === 'place') commit(); else cancel();
      });
    }
    if (!cv.isConnected) document.body.appendChild(cv);
    if (!bar.isConnected) document.body.appendChild(bar);
  }
  function preview(index, text, size) {
    var st = store(); if (!st) return;
    pv = { index: index, w: st.width, h: st.height };
    ensureUI();
    if (!String(inputs().text || text || '').trim()) {
      bar.querySelector('.c2c-text-hint').textContent = 'Type a word first, then tap the chart.';
    } else bar.querySelector('.c2c-text-hint').textContent = 'Preview. Tap another square to move it.';
  }
  function cancel() { pv = null; hide(); }
  function commit() {
    var st = store(); if (!pv || !st) return cancel();
    var inp = inputs();
    if (String(inp.text).trim()) st.placeText(pv.index, inp.text, inp.size);
    cancel();
  }
  function hide() { if (cv) cv.style.display = 'none'; if (bar) bar.style.display = 'none'; }
  function tick() {
    try {
      var st = pv && store();
      if (!pv || !st || st.tool !== 'text' || st.width !== pv.w || st.height !== pv.h) { if (pv) pv = null; hide(); }
      else draw(st);
    } catch (e) { hide(); }
    requestAnimationFrame(tick);
  }
  function draw(st) {
    var g = geometry(st); if (!g) { hide(); return; }
    var inp = inputs();
    var L = layout(inp.text, inp.size);
    var row = Math.floor(pv.index / st.width), col = pv.index % st.width;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = window.innerWidth, H = window.innerHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    var scroller = document.querySelector('[data-help="chart"] > .sheet-scroll');
    var clip = scroller ? scroller.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    x.save(); x.beginPath(); x.rect(clip.left, clip.top, clip.width, clip.height); x.clip();
    var yarn = st.yarns[st.active] || { hex: '#111111' };
    x.globalAlpha = 0.85; x.fillStyle = yarn.hex;
    for (var i = 0; i < L.cells.length; i++) {
      var r = row + L.cells[i].r, c = col + L.cells[i].c;
      if (r < 0 || c < 0 || r >= st.height || c >= st.width) continue;
      x.fillRect(g.x + c * g.px, g.y + r * g.py, g.size, g.size);
    }
    x.globalAlpha = 1; x.setLineDash([4, 3]); x.strokeStyle = '#ff0140'; x.lineWidth = 1.5;
    x.strokeRect(g.x + col * g.px - 1, g.y + row * g.py - 1, Math.max(g.size, L.width * g.px) + 2, L.height * g.py + 2);
    x.restore();
    cv.style.display = 'block';
    bar.style.display = 'flex';
  }
  document.addEventListener('keydown', function (e) { if (pv && e.key === 'Escape') cancel(); if (pv && e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('aria-label') === 'Text to place on the chart') { e.preventDefault(); commit(); } }, true);
  window.C2CText = { layout: layout, raster: raster, preview: preview, commit: commit, cancel: cancel, get active() { return !!pv; }, MIN: MIN, MAX: MAX };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(tick); }); else requestAnimationFrame(tick);
})();
