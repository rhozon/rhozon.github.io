/* Interactive part of the hybrid RAG case. Plain JavaScript, no model download: the repository's
   offline configuration ported from Python (rag/embeddings.py HashEmbedder, rag/store.py
   MemoryStore, rag/retrieve.py rrf, rag/guardrail.py), checked against the Python results in
   data.json (written by python -m rag.cli site). */
(function (G) {
  // ---- BLAKE2b with an 8-byte digest, as hashlib.blake2b(x, digest_size=8) -------------------
  var M64 = (1n << 64n) - 1n;
  var IV = [0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
            0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n];
  var SIGMA = [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],[11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],
    [7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],[9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],[2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],
    [12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],[13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],[6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],
    [10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0]];
  function rotr(x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M64; }
  function blake2b64(bytes) {
    var h = IV.slice(); h[0] ^= 0x01010000n ^ 8n;
    var t = 0n, n = bytes.length, off = 0;
    do {
      var last = n - off <= 128, len = last ? n - off : 128, m = [];
      for (var i = 0; i < 16; i++) { var w = 0n; for (var b = 7; b >= 0; b--) { var p = off + i * 8 + b; w = (w << 8n) | BigInt(p < off + len ? bytes[p] : 0); } m.push(w); }
      t += BigInt(len);
      var v = h.concat(IV); v[12] ^= t & M64; v[13] ^= t >> 64n; if (last) v[14] ^= M64;
      for (var r = 0; r < 12; r++) {
        var s = SIGMA[r % 10];
        var g = function (a, bb, c, d, x, y) {
          v[a] = (v[a] + v[bb] + x) & M64; v[d] = rotr(v[d] ^ v[a], 32); v[c] = (v[c] + v[d]) & M64; v[bb] = rotr(v[bb] ^ v[c], 24);
          v[a] = (v[a] + v[bb] + y) & M64; v[d] = rotr(v[d] ^ v[a], 16); v[c] = (v[c] + v[d]) & M64; v[bb] = rotr(v[bb] ^ v[c], 63);
        };
        g(0, 4, 8, 12, m[s[0]], m[s[1]]); g(1, 5, 9, 13, m[s[2]], m[s[3]]); g(2, 6, 10, 14, m[s[4]], m[s[5]]); g(3, 7, 11, 15, m[s[6]], m[s[7]]);
        g(0, 5, 10, 15, m[s[8]], m[s[9]]); g(1, 6, 11, 12, m[s[10]], m[s[11]]); g(2, 7, 8, 13, m[s[12]], m[s[13]]); g(3, 4, 9, 14, m[s[14]], m[s[15]]);
      }
      for (i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
      off += 128;
    } while (off < n);
    return h[0]; // first 8 bytes, read little-endian
  }
  function hex64le(x) { var s = ''; for (var i = 0; i < 8; i++) { var b = Number((x >> BigInt(8 * i)) & 0xffn); s += (b < 16 ? '0' : '') + b.toString(16); } return s; }

  // ---- embedder, store, retrieval, guardrail ------------------------------------------------
  function tokenize(t) { return t.toLowerCase().match(/[a-z0-9]+/g) || []; }
  var enc = new TextEncoder(), cache = {};
  function vector(text, dim) {
    var v = new Float64Array(dim), toks = tokenize(text), feats = toks.slice();
    for (var i = 0; i + 1 < toks.length; i++) feats.push(toks[i] + '_' + toks[i + 1]);
    feats.forEach(function (f) {
      var h = cache[f]; if (h === undefined) { h = blake2b64(enc.encode(f)); cache[f] = h; }
      v[Number(h % BigInt(dim))] += (h >> 63n) === 0n ? 1 : -1;
    });
    var nrm = 0; for (i = 0; i < dim; i++) nrm += v[i] * v[i]; nrm = Math.sqrt(nrm);
    if (nrm) for (i = 0; i < dim; i++) v[i] /= nrm;
    return v;
  }
  function Index(chunks, dim) {
    this.dim = dim; this.rows = chunks.map(function (c) { return {c: c, v: vector(c.text, dim), t: new Set(tokenize(c.text))}; });
  }
  Index.prototype.vectorSearch = function (q, k) {
    var qv = vector(q, this.dim), s = this.rows.map(function (r) { var d = 0; for (var i = 0; i < qv.length; i++) d += r.v[i] * qv[i]; return {c: r.c, score: d}; });
    return s.sort(function (a, b) { return b.score - a.score || a.c.id - b.c.id; }).slice(0, k);
  };
  Index.prototype.keywordSearch = function (q, k) {
    var terms = new Set(tokenize(q)), s = [];
    this.rows.forEach(function (r) { var o = 0; terms.forEach(function (t) { if (r.t.has(t)) o++; }); if (o) s.push({c: r.c, score: o}); });
    return s.sort(function (a, b) { return b.score - a.score || a.c.id - b.c.id; }).slice(0, k);
  };
  Index.prototype.search = function (q, k, mode) {
    if (mode === 'keyword') return this.keywordSearch(q, k);
    if (mode === 'vector') return this.vectorSearch(q, k);
    var sc = {}, first = {};
    [this.vectorSearch(q, 20), this.keywordSearch(q, 20)].forEach(function (rank) {
      rank.forEach(function (h, i) { sc[h.c.id] = (sc[h.c.id] || 0) + 1 / (60 + i + 1); if (!first[h.c.id]) first[h.c.id] = h.c; });
    });
    return Object.keys(sc).map(Number).sort(function (a, b) { return sc[b] - sc[a] || a - b; }).slice(0, k).map(function (id) { return {c: first[id], score: sc[id]}; });
  };
  var CITATION = /\[\d+\]/g, NUMBER = /(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?/g;
  function normalise(n) { var v = n.split(',').join(''); if (v.indexOf('.') >= 0) v = v.replace(/0+$/, '').replace(/\.$/, ''); return v; }
  function numbersIn(t) { return (t.replace(CITATION, ' ').match(NUMBER) || []).map(normalise); }
  function checkNumbers(answer, contexts) {
    var allowed = new Set(); contexts.forEach(function (c) { numbersIn(c).forEach(function (n) { allowed.add(n); }); });
    var seen = [], uns = [];
    numbersIn(answer).forEach(function (n) { if (seen.indexOf(n) < 0) { seen.push(n); if (!allowed.has(n)) uns.push(n); } });
    return {ok: !uns.length, unsupported: uns, found: seen};
  }
  var API = {blake2b64: blake2b64, hex64le: hex64le, Index: Index, checkNumbers: checkNumbers, tokenize: tokenize};
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // ---- page ---------------------------------------------------------------------------------
  var root = document.getElementById('rag-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Busca', 'A trava de números', 'Perguntas de teste'],
    q: 'Pergunta (em inglês, como o manual)', pick: 'Ou escolha uma pergunta de teste', go: 'Buscar', vector: 'Vetorial', keyword: 'Por palavras', hybrid: 'Híbrida (RRF)',
    expected: 'documento que responde', score: 'pontuação',
    draft: 'Rascunho de resposta', draftHelp: 'Edite a resposta. Antes de sair, cada número dela é procurado nas passagens recuperadas para a pergunta acima.',
    ok: 'Liberada: todos os números estão nas passagens.', blocked: 'Bloqueada: a resposta tem números que não estão nas passagens:', nums: 'Números na resposta',
    evalTitle: 'Acerto no primeiro lugar (hit@1) nas 16 perguntas de teste', here: 'Neste navegador (configuração offline)', ci: 'No CI, Postgres com busca textual',
    ciHash: 'hashing', ciBge: 'bge-small', hit: 'acertou', miss: 'errou',
    note: 'No navegador roda a configuração offline do repositório: o embedder por hashing (lexical, não semântico) e a busca por palavras do armazenamento em memória que os testes usam. Os números do case vêm do CI, com PostgreSQL, busca textual e o modelo bge-small. A versão em JavaScript devolveu as mesmas passagens que o Python, a menos de empates exatos de pontuação, em',
    note2: 'buscas de referência.', loading: 'Carregando...'
  } : {
    tabs: ['Search', 'The number guardrail', 'Test questions'],
    q: 'Question', pick: 'Or pick a test question', go: 'Search', vector: 'Vector', keyword: 'Keyword', hybrid: 'Hybrid (RRF)',
    expected: 'document that answers it', score: 'score',
    draft: 'Draft answer', draftHelp: 'Edit the answer. Before it goes out, every number in it is looked up in the passages retrieved for the question above.',
    ok: 'Released: every number is in the passages.', blocked: 'Withheld: the answer has numbers that are not in the passages:', nums: 'Numbers in the answer',
    evalTitle: 'Right document first (hit@1) on the 16 test questions', here: 'In this browser (offline configuration)', ci: 'In CI, Postgres with full-text search',
    ciHash: 'hashing', ciBge: 'bge-small', hit: 'hit', miss: 'miss',
    note: 'The browser runs the repository’s offline configuration: the hashing embedder (lexical, not semantic) and the keyword search of the in-memory store the tests use. The case’s figures come from CI, with PostgreSQL, full-text search and the bge-small model. The JavaScript version returned the same passages as Python, up to exact ties in score, on',
    note2: 'reference searches.', loading: 'Loading...'
  };
  var MODES = [['vector', T.vector], ['keyword', T.keyword], ['hybrid', T.hybrid]];
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
  function hl(text, q) { var t = new Set(tokenize(q)); return esc(text).replace(/[A-Za-z0-9]+/g, function (w) { return t.has(w.toLowerCase()) ? '<b>' + w + '</b>' : w; }); }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    var idx = new Index(D.chunks, D.dim);
    root.innerHTML = '';
    var nav = el('div', {class: 'rag-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'rag-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (i === 1) guardUpd(); }
    // search
    var p = panes[0].p, form = el('div', {class: 'rag-form'}); p.appendChild(form);
    var lab = el('label', {class: 'rag-ctl'}); lab.appendChild(el('span', {}, T.q)); var qi = el('input', {type: 'text', value: 'How long do I have to appeal a denied claim?'}); lab.appendChild(qi); form.appendChild(lab);
    var lab2 = el('label', {class: 'rag-ctl'}); lab2.appendChild(el('span', {}, T.pick)); var sel = el('select'); sel.appendChild(el('option', {value: ''}, '—'));
    D.golden.forEach(function (g, i) { sel.appendChild(el('option', {value: i}, esc(g.question))); }); lab2.appendChild(sel); form.appendChild(lab2);
    var exp = el('p', {class: 'rag-note'}); p.appendChild(exp);
    var cols = el('div', {class: 'rag-cols'}); p.appendChild(cols);
    var outs = MODES.map(function (m) { var c = el('div', {class: 'rag-col'}); c.appendChild(el('h4', {}, m[1])); var ol = el('ol'); c.appendChild(ol); cols.appendChild(c); return ol; });
    var expected = null;
    function run() {
      var q = qi.value;
      MODES.forEach(function (m, i) {
        outs[i].innerHTML = idx.search(q, 5, m[0]).map(function (h) {
          return '<li class="' + (expected && h.c.doc_id === expected ? 'hit' : '') + '"><span class="rag-doc">' + esc(h.c.doc_id) + ' #' + h.c.idx + '</span> <span class="rag-sc">' + T.score + ' ' + fmt(h.score, m[0] === 'keyword' ? 0 : 3) + '</span><br>' + hl(h.c.text.length > 220 ? h.c.text.slice(0, 220) + '…' : h.c.text, q) + '</li>';
        }).join('');
      });
      exp.innerHTML = expected ? T.expected + ': <b>' + esc(expected) + '</b>' : '';
    }
    var timer = null;
    qi.addEventListener('input', function () { expected = null; sel.value = ''; clearTimeout(timer); timer = setTimeout(run, 120); });
    sel.addEventListener('change', function () { if (sel.value === '') return; var g = D.golden[+sel.value]; qi.value = g.question; expected = g.doc_id; run(); });
    run();
    // guardrail
    var g = panes[1].p;
    g.appendChild(el('p', {class: 'rag-note'}, T.draftHelp));
    var gq = el('p', {class: 'rag-gq'}); g.appendChild(gq);
    var ta = el('textarea', {rows: 3, class: 'rag-ta'}); ta.value = 'You have 180 days from the date of the denial to file an appeal [1].'; g.appendChild(ta);
    var presets = el('div', {class: 'rag-presets'}); g.appendChild(presets);
    ['You have 180 days from the date of the denial to file an appeal [1].', 'You have 90 days to appeal [1].', 'You have 180 days to appeal, and a decision comes within 30 days [1].'].forEach(function (t, i) {
      var b = el('button', {type: 'button'}, String(i + 1)); b.title = t; b.addEventListener('click', function () { ta.value = t; guardUpd(); }); presets.appendChild(b); });
    var gv = el('p', {class: 'rag-verdict'}); g.appendChild(gv);
    var gp = el('div', {class: 'rag-passages'}); g.appendChild(gp);
    function guardUpd() {
      var hits = idx.search(qi.value, 5, 'hybrid'), r = checkNumbers(ta.value, hits.map(function (h) { return h.c.text; }));
      gq.innerHTML = '<b>' + T.q + ':</b> ' + esc(qi.value);
      gv.innerHTML = (r.ok ? T.ok : T.blocked + ' <b>' + r.unsupported.join(', ') + '</b>') + (r.found.length ? '<br><span class="rag-sc">' + T.nums + ': ' + r.found.join(', ') + '</span>' : '');
      gv.className = 'rag-verdict ' + (r.ok ? 'good' : 'bad');
      var nums = new Set(r.found);
      gp.innerHTML = '<ol>' + hits.map(function (h) { return '<li><span class="rag-doc">' + esc(h.c.doc_id) + '</span> ' + esc(h.c.text).replace(/\d[\d,.]*/g, function (n) { return nums.has(normalise(n.replace(/[.,]$/, ''))) ? '<mark>' + n + '</mark>' : n; }) + '</li>'; }).join('') + '</ol>';
    }
    ta.addEventListener('input', guardUpd);
    // evaluation
    var e = panes[2].p;
    e.appendChild(el('h4', {}, T.evalTitle));
    var rows = D.golden.map(function (gq) { var r = {q: gq.question, doc: gq.doc_id}; MODES.forEach(function (m) { r[m[0]] = idx.search(gq.question, 1, m[0])[0]; }); return r; });
    var hit = function (m) { return rows.filter(function (r) { return r[m] && r[m].c.doc_id === r.doc; }).length / rows.length; };
    var tb = el('table', {class: 'rag-table'}); e.appendChild(tb);
    tb.innerHTML = '<thead><tr><th></th><th>' + T.vector + '</th><th>' + T.keyword + '</th><th>' + T.hybrid + '</th></tr></thead><tbody>' +
      '<tr><td>' + T.here + '</td><td>' + fmt(hit('vector'), 2) + '</td><td>' + fmt(hit('keyword'), 2) + '</td><td>' + fmt(hit('hybrid'), 2) + '</td></tr>' +
      '<tr><td>' + T.ci + ', ' + T.ciHash + '</td><td>' + fmt(0.75, 2) + '</td><td>' + fmt(0.81, 2) + '</td><td>' + fmt(0.88, 2) + '</td></tr>' +
      '<tr><td>' + T.ci + ', ' + T.ciBge + '</td><td>' + fmt(1, 2) + '</td><td>' + fmt(0.81, 2) + '</td><td>' + fmt(1, 2) + '</td></tr></tbody>';
    var tb2 = el('table', {class: 'rag-table rag-q'}); e.appendChild(tb2);
    tb2.innerHTML = '<thead><tr><th></th><th>' + T.expected + '</th><th>' + T.vector + '</th><th>' + T.keyword + '</th><th>' + T.hybrid + '</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><td>' + esc(r.q) + '</td><td>' + esc(r.doc) + '</td>' + MODES.map(function (m) { var ok = r[m[0]] && r[m[0]].c.doc_id === r.doc; return '<td class="' + (ok ? 'hit' : 'miss') + '">' + (r[m[0]] ? esc(r[m[0]].c.doc_id) : '–') + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    // parity with Python
    var same = 0;
    // Same passages in the same order, where two passages with exactly the same score may swap
    // (Python computes in 32-bit floats and breaks such ties by rounding).
    D.reference.forEach(function (ref) {
      var ok = MODES.every(function (m) {
        var all = idx.search(ref.question, 25, m[0]), js = all.slice(0, 5), sc = {};
        all.forEach(function (h) { sc[h.c.id] = h.score; });
        return js.length === ref.ids[m[0]].length && js.every(function (h, i) { var pid = ref.ids[m[0]][i]; return h.c.id === pid || Math.abs(h.score - sc[pid]) < 1e-9; });
      });
      if (ok) same++;
    });
    var hashOk = D.hash_checks.every(function (h) { return hex64le(blake2b64(new TextEncoder().encode(h.feature))) === h.digest; });
    root.appendChild(el('p', {class: 'rag-note'}, T.note + ' ' + same + ' / ' + D.reference.length + ' ' + T.note2 + (hashOk ? '' : ' (hash check failed)')));
    show(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
