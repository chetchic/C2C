/*! C2C Studio · Full pattern PDF (jsPDF, bundled locally at /assets/vendor/jspdf.umd.min.js).
 *  Overview chart, color key with block counts, paginated chart sections with row/column numbers,
 *  and the written row-by-row instructions. Free tier: watermark on every page + lower-resolution images.
 */
(function () {
  'use strict';
  var JSPDF_URL = '/assets/vendor/jspdf.umd.min.js';
  var loading = null;
  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = JSPDF_URL; s.async = true;
      s.onload = function () { window.jspdf && window.jspdf.jsPDF ? res(window.jspdf.jsPDF) : rej(new Error('jsPDF missing')); };
      s.onerror = function () { loading = null; rej(new Error('Could not load ' + JSPDF_URL)); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function letter(e) { if (e < 0) return 'Z'; if (e < 26) return String.fromCharCode(90 - e); var n = e - 26; return String.fromCharCode(90 - (Math.floor(n / 26) % 26)) + String.fromCharCode(65 + (n % 26)); }
  function clean(t) {
    return String(t == null ? '' : t).replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-').replace(/\u2026/g, '...').replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
      .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '');
  }
  function slug(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cornerwise-chart'; }
  function hexRgb(h) { h = String(h || '#e8e6e4').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function chartCanvas(ch, c0, r0, cw, rh, px) {
    var cv = document.createElement('canvas');
    cv.width = cw * px; cv.height = rh * px;
    var x = cv.getContext('2d');
    for (var r = 0; r < rh; r++) for (var c = 0; c < cw; c++) {
      var y = ch.yarns[ch.cells[(r0 + r) * ch.width + (c0 + c)] || 0];
      x.fillStyle = y ? y.hex : '#e8e6e4'; x.fillRect(c * px, r * px, px, px);
    }
    if (px >= 4) {
      x.strokeStyle = 'rgba(167,175,192,0.9)'; x.lineWidth = Math.max(1, px / 14);
      x.beginPath();
      for (var i = 0; i <= cw; i++) { x.moveTo(i * px + 0.5, 0); x.lineTo(i * px + 0.5, rh * px); }
      for (var j = 0; j <= rh; j++) { x.moveTo(0, j * px + 0.5); x.lineTo(cw * px, j * px + 0.5); }
      x.stroke();
      x.strokeStyle = 'rgba(65,65,110,0.9)'; x.lineWidth = Math.max(1.5, px / 8); x.beginPath();
      for (var i2 = 0; i2 <= cw; i2++) if ((c0 + i2) % 10 === 0) { x.moveTo(i2 * px, 0); x.lineTo(i2 * px, rh * px); }
      for (var j2 = 0; j2 <= rh; j2++) if ((r0 + j2) % 10 === 0) { x.moveTo(0, j2 * px); x.lineTo(cw * px, j2 * px); }
      x.stroke();
    }
    return cv;
  }

  function watermark(doc, W, H, text) {
    doc.saveGraphicsState();
    try { doc.setGState(new doc.GState({ opacity: 0.13 })); } catch (e) {}
    doc.setTextColor(65, 65, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
    for (var y = 60; y < H + 200; y += 150) for (var x = -100; x < W; x += 330) doc.text(text, x + ((y / 150) % 2) * 160, y, { angle: 30 });
    doc.restoreGraphicsState();
  }

  async function fetchImg(url) {
    try { var r = await fetch(url); if (!r.ok) return null; var b = await r.blob();
      return await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(b); });
    } catch (e) { return null; }
  }

  async function build(ch, patternText) {
    var jsPDF = await loadJsPDF();
    var G = window.C2CGate, f = (G && G.features && G.features[G.tier]) || { watermark: true, exportScale: 1, label: 'Free' };
    var free = !!f.watermark, hi = (f.exportScale || 1) >= 2;
    var doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    var W = 612, H = 792, M = 36;
    var name = clean(ch.name && ch.name.trim() ? ch.name.trim() : 'Untitled chart');
    var corner = ch.corner || 'bottom-right';
    var counts = ch.yarns.map(function () { return 0; });
    ch.cells.forEach(function (v) { counts[v || 0] = (counts[v || 0] || 0) + 1; });

    // ---- page 1: header, overview, color key
    var badge = await fetchImg('/branding/badge.jpg');
    doc.setFillColor(7, 143, 120); doc.rect(0, 0, W, 6, 'F');
    var y = 30;
    if (badge) { try { doc.addImage(badge, 'JPEG', M, y, 54, 55); } catch (e) {} }
    doc.setTextColor(65, 65, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(name, M + (badge ? 66 : 0), y + 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(7, 143, 120);
    doc.text(clean(ch.width + ' \u00d7 ' + ch.height + ' blocks \u00b7 ' + ch.cells.length + ' blocks total \u00b7 Start: ' + corner.replace('-', ' ')), M + (badge ? 66 : 0), y + 40);
    doc.setTextColor(110, 36, 56);
    doc.text(clean('Corner-to-Corner Studio by Chet Chic \u00b7 ' + f.label + (free ? ' (demo export)' : '')), M + (badge ? 66 : 0), y + 54);
    y += 72;

    var maxW = W - 2 * M, maxH = 380;
    var ow = ch.width, oh = ch.height, cell = Math.min(maxW / ow, maxH / oh);
    var opx = hi ? Math.max(2, Math.min(16, Math.floor(3200 / Math.max(ow, oh)))) : Math.max(1, Math.min(4, Math.floor(800 / Math.max(ow, oh))));
    var ocv = chartCanvas(ch, 0, 0, ow, oh, opx);
    doc.addImage(ocv.toDataURL('image/png'), 'PNG', M + (maxW - ow * cell) / 2, y, ow * cell, oh * cell, undefined, 'FAST');
    doc.setDrawColor(65, 65, 110); doc.setLineWidth(0.8); doc.rect(M + (maxW - ow * cell) / 2, y, ow * cell, oh * cell);
    y += oh * cell + 22;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(65, 65, 110);
    doc.text('Color key', M, y); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    var colW = (W - 2 * M) / 2, i;
    for (i = 0; i < ch.yarns.length; i++) {
      var col = i % 2, yy = y + Math.floor(i / 2) * 18 + 6;
      if (yy > H - 60) break;
      var rgb = hexRgb(ch.yarns[i].hex);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(167, 175, 192); doc.rect(M + col * colW, yy, 12, 12, 'FD');
      doc.setTextColor(36, 31, 51);
      doc.text(clean(letter(i) + '  ' + ch.yarns[i].name + '  ' + (ch.yarns[i].hex || '') + '  \u00b7  ' + (counts[i] || 0) + ' blocks'), M + col * colW + 18, yy + 10);
    }
    var keyRows = Math.ceil(ch.yarns.length / 2);
    var keyOverflow = y + keyRows * 18 + 6 > H - 60;

    // ---- chart sections (paginated) when the overview is too small to work from
    var needTiles = cell < 7 || keyOverflow;
    var tiles = [];
    if (needTiles) {
      var aw = W - 2 * M - 24, ah = H - 2 * M - 60, fit = Math.min(aw / ch.width, ah / ch.height);
      var tc = fit >= 7 ? Math.min(12, fit) : 9;
      var nx = Math.ceil(ch.width / Math.floor(aw / tc)), ny = Math.ceil(ch.height / Math.floor(ah / tc));
      var tcols = Math.ceil(ch.width / nx), trows = Math.ceil(ch.height / ny);
      for (var r0 = 0; r0 < ch.height; r0 += trows) for (var c0 = 0; c0 < ch.width; c0 += tcols)
        tiles.push({ c0: c0, r0: r0, cw: Math.min(tcols, ch.width - c0), rh: Math.min(trows, ch.height - r0), tc: tc });
    }
    var rowNum = function (r) { return corner.indexOf('top') === 0 ? r + 1 : ch.height - r; };
    var colNum = function (c) { return /right$/.test(corner) ? ch.width - c : c + 1; };
    var tpx = hi ? 24 : 5;
    tiles.forEach(function (t, k) {
      doc.addPage();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(65, 65, 110);
      doc.text(clean(name + ' \u00b7 chart part ' + (k + 1) + ' of ' + tiles.length), M, M);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(7, 143, 120);
      doc.text(clean('Columns ' + Math.min(colNum(t.c0), colNum(t.c0 + t.cw - 1)) + '-' + Math.max(colNum(t.c0), colNum(t.c0 + t.cw - 1)) +
        ' \u00b7 Rows ' + Math.min(rowNum(t.r0), rowNum(t.r0 + t.rh - 1)) + '-' + Math.max(rowNum(t.r0), rowNum(t.r0 + t.rh - 1)) + ' (chart numbering, same as the app)'), M, M + 13);
      var ox = M + 22, oy = M + 30;
      var cv = chartCanvas(ch, t.c0, t.r0, t.cw, t.rh, tpx);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', ox, oy, t.cw * t.tc, t.rh * t.tc, undefined, 'FAST');
      doc.setDrawColor(65, 65, 110); doc.rect(ox, oy, t.cw * t.tc, t.rh * t.tc);
      doc.setFontSize(5.5); doc.setTextColor(92, 97, 120);
      for (var c = 0; c < t.cw; c++) { var n = colNum(t.c0 + c); if (n % 5 === 0 || c === 0) doc.text(String(n), ox + c * t.tc + t.tc / 2, oy - 3, { align: 'center' }); }
      for (var r = 0; r < t.rh; r++) { var m = rowNum(t.r0 + r); if (m % 5 === 0 || r === 0) doc.text(String(m), ox - 3, oy + r * t.tc + t.tc * 0.75, { align: 'right' }); }
    });

    // ---- written instructions
    doc.addPage();
    var lines = clean(patternText || '').split(/\r?\n/);
    y = M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(65, 65, 110);
    doc.text('Written pattern', M, y); y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    lines.forEach(function (ln) {
      var wrapped = doc.splitTextToSize(ln || ' ', W - 2 * M);
      wrapped.forEach(function (w) {
        if (y > H - 48) { doc.addPage(); y = M; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0); }
        var bold = /^(Rows|Yarn|Gauge|Materials|Notes)\b/.test(w.trim());
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(w, M, y); y += 11.5;
      });
    });

    // ---- footer + watermark on every page
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      if (free) watermark(doc, W, H, (G && G.config && G.config.watermarkText) ? clean(G.config.watermarkText) : 'Chet Chic Demo - chetchic.com');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(7, 143, 120);
      doc.text(clean('Chet Chic \u00b7 Corner-to-Corner Studio \u00b7 ' + name), M, H - 22);
      doc.text('Page ' + p + ' of ' + pages, W - M, H - 22, { align: 'right' });
      if (free) { doc.setTextColor(110, 36, 56); doc.text(clean('Free demo export \u00b7 clean high-resolution PDFs come with the Haute Pass at chetchic.com'), W / 2, H - 10, { align: 'center' }); }
    }
    doc.setProperties({ title: name + ' - C2C pattern', creator: 'Corner-to-Corner Studio by Chet Chic', subject: free ? 'demo' : 'haute' });
    var blob = doc.output('blob');
    return { blob: blob, filename: slug(ch.name) + '-pattern.pdf', pages: pages, tiles: tiles.length, watermarked: free };
  }
  window.C2CPdf = { build: build, load: loadJsPDF };
})();
