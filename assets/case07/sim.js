/* Interactive part of the hospital admissions case. Plain JavaScript + Chart.js, from data.json
   (written by python -m admissions.cli export). */
(function () {
  var root = document.getElementById('adm-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Previsão por estado', 'Refaça o teste', 'Erro por estado'],
    state: 'Estado', actual: 'Internações (mês de processamento)', pandemic: 'Pandemia, fora do ajuste', fc: 'Previsão', band: 'Faixa de 80%',
    next12: 'Próximos 12 meses', vsPrev: 'vs. os 12 meses anteriores', width: 'Largura média da faixa', ofFc: 'da previsão',
    gapNote: 'Meses sem o lote do estado, tratados como dado faltante:', origin: 'Data da previsão', compare: 'Comparar com',
    naive: 'Mesmo mês do ano anterior', raw: 'Modelo com a pandemia no ajuste', final: 'Modelo final', none: 'Nada',
    wapeThis: 'Erro desta previsão (WAPE)', total12: 'Erro do total de 12 meses', inside: 'Meses dentro da faixa de 80%',
    vs: 'contra', of: 'de', noActual: 'sem valor real ainda', replayNote: 'O modelo é reajustado só com os dados disponíveis na data escolhida e prevê os 12 meses seguintes. Mude a data para ver cada uma das 33 previsões do teste.',
    tableHead: ['Estado', 'Mesmo mês do ano anterior', 'Pandemia no ajuste', 'Pandemia fora', 'Pandemia fora, com dias úteis'],
    byH: 'Erro por meses à frente', monthsAhead: 'Meses à frente', clickRow: 'Clique num estado para ver o erro por meses à frente.',
    all: 'Média dos 27 estados', loading: 'Carregando...'
  } : {
    tabs: ['Forecast by state', 'Replay the test', 'Error by state'],
    state: 'State', actual: 'Admissions (processing month)', pandemic: 'Pandemic, left out of the fit', fc: 'Forecast', band: '80% band',
    next12: 'Next 12 months', vsPrev: 'vs. the previous 12 months', width: 'Average band width', ofFc: 'of the forecast',
    gapNote: 'Months without the state’s batch, treated as missing:', origin: 'Forecast date', compare: 'Compare with',
    naive: 'Same month last year', raw: 'Model with the pandemic left in', final: 'Final model', none: 'Nothing',
    wapeThis: 'Error of this forecast (WAPE)', total12: 'Error of the 12-month total', inside: 'Months inside the 80% band',
    vs: 'against', of: 'of', noActual: 'no actual value yet', replayNote: 'The model is refitted only on the data available at the chosen date and forecasts the next 12 months. Move the date to see each of the 33 forecasts in the test.',
    tableHead: ['State', 'Same month last year', 'Pandemic left in', 'Pandemic left out', 'Pandemic left out, with working days'],
    byH: 'Error by months ahead', monthsAhead: 'Months ahead', clickRow: 'Click a state to see its error by months ahead.',
    all: 'Average of the 27 states', loading: 'Loading...'
  };
  var NAMES = {RO: 'Rondônia', AC: 'Acre', AM: 'Amazonas', RR: 'Roraima', PA: 'Pará', AP: 'Amapá', TO: 'Tocantins', MA: 'Maranhão', PI: 'Piauí',
    CE: 'Ceará', RN: 'Rio Grande do Norte', PB: 'Paraíba', PE: 'Pernambuco', AL: 'Alagoas', SE: 'Sergipe', BA: 'Bahia', MG: 'Minas Gerais',
    ES: 'Espírito Santo', RJ: 'Rio de Janeiro', SP: 'São Paulo', PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul',
    MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', GO: 'Goiás', DF: 'Distrito Federal'};
  var C = {actual: '#334155', pandemic: '#94a3b8', model: '#0f766e', band: 'rgba(15,118,110,.16)', naive: '#c2410c', raw: '#7c3aed', rawBand: 'rgba(124,58,237,.12)', masked: '#0369a1'};
  var MLABEL = {seasonal_naive: T.tableHead[1], sarima_raw: T.tableHead[2], sarima_masked: T.tableHead[3], sarima_masked_wd: T.tableHead[4]};
  var MCOL = {seasonal_naive: C.naive, sarima_raw: C.raw, sarima_masked: C.masked, sarima_masked_wd: C.model};

  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x, d) { return fmt(100 * x, d == null ? 1 : d) + '%'; }
  function spct(x) { return (x >= 0 ? '+' : '') + pct(x); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'adm-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function card(parent, label) { var c = el('div', {class: 'adm-card'}); c.appendChild(el('div', {class: 'adm-card-l'}, label)); var v = el('div', {class: 'adm-card-v'}); c.appendChild(v); var s = el('div', {class: 'adm-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function monthLabel(m) { var p = m.split('-'); var mo = PT ? ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return mo[+p[1] - 1] + ' ' + p[0]; }
  function addMonths(m, k) { var p = m.split('-'), t = (+p[0]) * 12 + (+p[1] - 1) + k; var mm = t % 12 + 1; return Math.floor(t / 12) + '-' + (mm < 10 ? '0' : '') + mm; }
  function stateOpts(D) { return D.states.slice().sort(function (a, b) { return NAMES[a].localeCompare(NAMES[b]); }).map(function (s) { return [s, NAMES[s] + ' (' + s + ')']; }); }
  var textColor = function () { return getComputedStyle(root).color; };
  function baseOpts(yTitle) {
    var tc = textColor();
    return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {labels: {color: tc, boxWidth: 14, filter: function (i) { return i.text; }}},
        tooltip: {callbacks: {label: function (c) { return c.dataset.label && c.parsed.y != null ? c.dataset.label + ': ' + fmt(c.parsed.y) : null; }}}},
      scales: {x: {ticks: {color: tc, maxRotation: 0, autoSkip: true, maxTicksLimit: 10}, grid: {display: false}},
        y: {ticks: {color: tc, callback: function (v) { return fmt(v); }}, grid: {color: 'rgba(127,127,127,.15)'}, title: {display: !!yTitle, text: yTitle, color: tc}}}};
  }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'adm-tabs'}); root.appendChild(nav);
    var made = {};
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'adm-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    var makers = [forecast, replay, table];
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  function forecast(p, D) {
    var ctl = el('div', {class: 'adm-ctls'}); p.appendChild(ctl);
    var sS = control(ctl, T.state, select(stateOpts(D), 'PR'));
    var cards = el('div', {class: 'adm-cards'}); p.appendChild(cards);
    var cT = card(cards, T.next12), cW = card(cards, T.width);
    var box = el('div', {class: 'adm-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    var note = el('p', {class: 'adm-note'}); p.appendChild(note);
    var chart = new Chart(cv, {type: 'line', data: {labels: [], datasets: []}, options: baseOpts()});
    function upd() {
      var uf = sS.value, h = D.history[uf], F = D.forecast[uf], months = D.months.concat(F.months);
      var n = D.months.length, pad = function (a, before) { return new Array(before).fill(null).concat(a); };
      var p0 = D.months.indexOf(D.pandemic[0]), p1 = D.months.indexOf(D.pandemic[1]);
      var act = h.map(function (v, i) { return i >= p0 && i <= p1 ? null : v; });
      var pan = h.map(function (v, i) { return i >= p0 - 1 && i <= p1 + 1 ? v : null; });
      var join = function (a) { return pad([h[n - 1]].concat(a), n - 1); };
      chart.data.labels = months.map(monthLabel);
      chart.data.datasets = [
        {label: T.actual, data: act.concat(new Array(12).fill(null)), borderColor: C.actual, borderWidth: 2, pointRadius: 0, spanGaps: false},
        {label: T.pandemic, data: pan.concat(new Array(12).fill(null)), borderColor: C.pandemic, borderDash: [4, 3], borderWidth: 2, pointRadius: 0},
        {label: '', data: pad(F.hi, n), borderColor: 'transparent', pointRadius: 0, fill: false},
        {label: T.band, data: pad(F.lo, n), borderColor: 'transparent', backgroundColor: C.band, pointRadius: 0, fill: '-1'},
        {label: T.fc, data: join(F.f), borderColor: C.model, borderWidth: 2, pointRadius: 0}
      ];
      chart.update();
      var tot = F.f.reduce(function (a, b) { return a + b; }, 0);
      var last = h.slice(-12), ok = last.every(function (v) { return v != null; });
      cT.v.textContent = fmt(tot);
      cT.s.textContent = ok ? spct(tot / last.reduce(function (a, b) { return a + b; }, 0) - 1) + ' ' + T.vsPrev : '';
      var w = F.f.map(function (f, i) { return (F.hi[i] - F.lo[i]) / f; });
      cW.v.textContent = pct(w.reduce(function (a, b) { return a + b; }, 0) / w.length);
      cW.s.textContent = T.ofFc;
      note.textContent = D.gaps[uf] ? T.gapNote + ' ' + D.gaps[uf].map(monthLabel).join(', ') + '.' : '';
    }
    sS.addEventListener('change', upd); upd();
  }

  function replay(p, D) {
    var ctl = el('div', {class: 'adm-ctls'}); p.appendChild(ctl);
    var sS = control(ctl, T.state, select(stateOpts(D), 'PR'));
    var oo = el('output');
    var sO = control(ctl, T.origin, el('input', {type: 'range', min: 0, max: D.origins.length - 1, step: 1, value: D.origins.indexOf('2024-06') >= 0 ? D.origins.indexOf('2024-06') : 0}), oo);
    var sC = control(ctl, T.compare, select([['seasonal_naive', T.naive], ['sarima_raw', T.raw], ['', T.none]], 'seasonal_naive'));
    var cards = el('div', {class: 'adm-cards'}); p.appendChild(cards);
    var cW = card(cards, T.wapeThis), cA = card(cards, T.total12), cI = card(cards, T.inside);
    var box = el('div', {class: 'adm-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    p.appendChild(el('p', {class: 'adm-note'}, T.replayNote));
    var chart = new Chart(cv, {type: 'line', data: {labels: [], datasets: []}, options: baseOpts()});
    function score(f, a) { var e = 0, s = 0; for (var i = 0; i < f.length; i++) if (a[i] != null) { e += Math.abs(f[i] - a[i]); s += a[i]; } return s ? e / s : null; }
    function upd() {
      var uf = sS.value, oi = +sO.value, o = D.origins[oi], cmp = sC.value;
      oo.textContent = monthLabel(o);
      var start = addMonths(o, -23), months = [];
      for (var k = 0; k < 36; k++) months.push(addMonths(o, k - 23));
      var hv = function (m) { var i = D.months.indexOf(m); return i < 0 ? null : D.history[uf][i]; };
      var act = months.map(hv);
      var B = D.backtest[uf], M = B.sarima_masked_wd, pre = new Array(23).fill(null);
      var lastAct = hv(o);
      var line = function (a) { return pre.concat([lastAct]).concat(a); };
      var fut = act.slice(24);
      var ds = [{label: T.actual, data: act, borderColor: C.actual, borderWidth: 2, pointRadius: months.map(function (m, i) { return i > 23 ? 2 : 0; }), pointBackgroundColor: C.actual}];
      if (cmp === 'sarima_raw') {
        ds.push({label: '', data: pre.concat([null]).concat(B.sarima_raw.hi[oi]), borderColor: 'transparent', pointRadius: 0});
        ds.push({label: T.band + ', ' + T.raw.toLowerCase(), data: pre.concat([null]).concat(B.sarima_raw.lo[oi]), borderColor: 'transparent', backgroundColor: C.rawBand, pointRadius: 0, fill: '-1'});
      }
      ds.push({label: '', data: pre.concat([null]).concat(M.hi[oi]), borderColor: 'transparent', pointRadius: 0});
      ds.push({label: T.band + ', ' + T.final.toLowerCase(), data: pre.concat([null]).concat(M.lo[oi]), borderColor: 'transparent', backgroundColor: C.band, pointRadius: 0, fill: '-1'});
      ds.push({label: T.final, data: line(M.f[oi]), borderColor: C.model, borderWidth: 2, pointRadius: 0});
      if (cmp) ds.push({label: cmp === 'seasonal_naive' ? T.naive : T.raw, data: line(B[cmp].f[oi]), borderColor: MCOL[cmp], borderWidth: 2, borderDash: [5, 3], pointRadius: 0});
      chart.data.labels = months.map(monthLabel); chart.data.datasets = ds; chart.update();
      var w = score(M.f[oi], fut), wc = cmp ? score(B[cmp].f[oi], fut) : null;
      cW.v.textContent = w == null ? '–' : pct(w); cW.s.textContent = w == null ? T.noActual : (wc != null ? T.vs + ' ' + pct(wc) + ', ' + (cmp === 'seasonal_naive' ? T.naive : T.raw).toLowerCase() : '');
      var full = fut.every(function (v) { return v != null; });
      var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      if (full) {
        var e = Math.abs(sum(M.f[oi]) / sum(fut) - 1), ec = cmp ? Math.abs(sum(B[cmp].f[oi]) / sum(fut) - 1) : null;
        cA.v.textContent = pct(e); cA.s.textContent = ec != null ? T.vs + ' ' + pct(ec) : '';
      } else { cA.v.textContent = '–'; cA.s.textContent = T.noActual; }
      var n = 0, k = 0; fut.forEach(function (a, i) { if (a != null) { k++; if (a >= M.lo[oi][i] && a <= M.hi[oi][i]) n++; } });
      var nr = 0; if (cmp === 'sarima_raw') fut.forEach(function (a, i) { if (a != null && a >= B.sarima_raw.lo[oi][i] && a <= B.sarima_raw.hi[oi][i]) nr++; });
      cI.v.textContent = k ? n + ' ' + T.of + ' ' + k : '–';
      cI.s.textContent = cmp === 'sarima_raw' && k ? T.vs + ' ' + nr + ' ' + T.of + ' ' + k + ', ' + T.raw.toLowerCase() : '';
    }
    [sS, sO, sC].forEach(function (x) { x.addEventListener('input', upd); x.addEventListener('change', upd); }); upd();
  }

  function table(p, D) {
    var models = D.models;
    var wrap = el('div', {class: 'adm-split'}); p.appendChild(wrap);
    var left = el('div'), right = el('div'); wrap.appendChild(left); wrap.appendChild(right);
    var tb = el('table', {class: 'adm-table'}); left.appendChild(tb);
    var head = el('tr'); T.tableHead.forEach(function (h) { head.appendChild(el('th', {}, h)); }); tb.appendChild(el('thead')).appendChild(head);
    var body = el('tbody'); tb.appendChild(body);
    var rows = D.states.slice().sort(function (a, b) { return D.wape_by_state[a].sarima_masked_wd - D.wape_by_state[b].sarima_masked_wd; });
    right.appendChild(el('h4', {}, T.byH));
    var ttl = el('p', {class: 'adm-note'}, T.clickRow); right.appendChild(ttl);
    var box = el('div', {class: 'adm-chart adm-chart-s'}); var cv = el('canvas'); box.appendChild(cv); right.appendChild(box);
    var o = baseOpts(); o.scales.y.ticks.callback = function (v) { return pct(v, 0); };
    o.plugins.tooltip.callbacks.label = function (c) { return c.dataset.label + ': ' + pct(c.parsed.y); };
    o.scales.x.title = {display: true, text: T.monthsAhead, color: textColor()};
    var chart = new Chart(cv, {type: 'line', data: {labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], datasets: []}, options: o});
    function avg(m) { var out = []; for (var i = 0; i < 12; i++) { var s = 0, n = 0; D.states.forEach(function (u) { var v = D.wape_by_horizon[u][m][i]; if (v != null) { s += v; n++; } }); out.push(s / n); } return out; }
    function draw(uf) {
      chart.data.datasets = models.map(function (m) { return {label: MLABEL[m], data: uf ? D.wape_by_horizon[uf][m] : avg(m), borderColor: MCOL[m], borderWidth: 2, pointRadius: 2, borderDash: m === 'seasonal_naive' ? [5, 3] : []}; });
      ttl.textContent = uf ? NAMES[uf] + ' (' + uf + ')' : T.all + '. ' + T.clickRow;
      chart.update();
      Array.prototype.forEach.call(body.children, function (r) { r.classList.toggle('on', r.getAttribute('data-uf') === uf); });
    }
    rows.forEach(function (uf) {
      var r = el('tr', {'data-uf': uf, tabindex: 0}); r.appendChild(el('td', {}, NAMES[uf] + ' (' + uf + ')'));
      var best = Math.min.apply(null, models.map(function (m) { return D.wape_by_state[uf][m]; }));
      models.forEach(function (m) { var v = D.wape_by_state[uf][m]; r.appendChild(el('td', v === best ? {class: 'best'} : {}, pct(v, 2))); });
      r.addEventListener('click', function () { draw(r.classList.contains('on') ? null : uf); });
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter') r.click(); });
      body.appendChild(r);
    });
    draw(null);
  }
})();
