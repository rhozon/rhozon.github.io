/* Interactive part of the fuel retail case. Plain JavaScript + Chart.js, from data.json
   (python -m fuelx.cli --site). */
(function () {
  var root = document.getElementById('fuel-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Repasse por estado', 'Simule um choque', 'Todos os estados', 'Concorrência local', 'Previsão de vendas'],
    state: 'Estado', retail: 'Bomba (média dos postos)', dist: 'Distribuição', prod: 'Produtor, gasolina A (sem ICMS)', rs: 'R$ por litro',
    pump: 'Distribuidora para a bomba', up: 'Distribuidora para a bomba', upstream: 'Produtor para a distribuidora',
    rise: 'Alta de custo', fall: 'Queda de custo', weeks: 'Semanas', cum: 'Repasse acumulado (fração da variação do custo)',
    sumUp: 'Repasse em 4 semanas, altas', sumDn: 'Repasse em 4 semanas, quedas', pval: 'Teste de simetria, p', lr: 'Repasse de longo prazo',
    shock: 'Variação do preço da distribuidora (R$ por litro)', pathTitle: 'Variação esperada do preço, R$ por litro', check: 'Conferência com o Python',
    head: ['Estado', 'Bomba: altas', 'Bomba: quedas', 'p', 'q (BH)', 'Bomba: longo prazo', 'Produtor para distribuidora: longo prazo'],
    allNote: 'Somas dos coeficientes de curto prazo (semana do choque e três seguintes). q é o p-valor corrigido por Benjamini-Hochberg nos 27 estados. Do produtor para a distribuidora só a parcela de longo prazo é mostrada: a dinâmica semanal dessa etapa não fica identificada nesta janela (mudanças de imposto e da mistura de etanol).',
    brand: 'Preço em relação à média do município na semana (%)', majors: 'Grandes bandeiras', others: 'Outras bandeiras', white: 'Bandeira branca (referência)',
    near: 'Concorrentes no mesmo CEP de 5 dígitos', none: 'nenhum (referência)', disp: 'Dispersão de preços por tamanho do município',
    cv: 'Coeficiente de variação (mediana)', gap: 'Diferença entre o 9º e o 1º decil, R$ (mediana)', stations: 'postos',
    compNote: 'Gasolina comum, 2025 e 2026. Coeficientes com intervalo de 95%, erros agrupados por município. São associações: postos com mais concorrentes por perto também estão em áreas centrais e em rodovias.',
    product: 'Produto', series: 'Série', hist: 'Vendas (m³)', fc: 'Previsão conciliada', level: 'Nível', model: 'Modelo', wape: 'Erro (WAPE)',
    lv: {Brazil: 'Brasil', region: 'Região', state: 'Estado'}, prods: {'Gasoline C': 'Gasolina C', 'Hydrous ethanol': 'Etanol hidratado', 'Diesel': 'Diesel'},
    models: {'Seasonal naive': 'Ingênuo sazonal', 'ETS': 'ETS', 'ETS + MinT': 'ETS + MinT', 'Global GBM, bottom-up': 'GBM global, de baixo para cima'},
    fcNote: 'Erro médio de 12 meses à frente em 12 origens, de 2023 a 2025, refazendo o ajuste só com o passado em cada uma.', loading: 'Carregando...'
  } : {
    tabs: ['Pass-through by state', 'Simulate a shock', 'All states', 'Local competition', 'Sales forecast'],
    state: 'State', retail: 'Pump (station average)', dist: 'Distribution', prod: 'Producer, gasoline A (before state tax)', rs: 'R$ per litre',
    pump: 'Distributor to pump', up: 'Distributor to pump', upstream: 'Producer to distributor',
    rise: 'Cost rise', fall: 'Cost fall', weeks: 'Weeks', cum: 'Cumulative pass-through (share of the cost change)',
    sumUp: 'Pass-through in 4 weeks, rises', sumDn: 'Pass-through in 4 weeks, falls', pval: 'Symmetry test, p', lr: 'Long-run pass-through',
    shock: 'Change in the distribution price (R$ per litre)', pathTitle: 'Expected price change, R$ per litre', check: 'Check against Python',
    head: ['State', 'Pump: rises', 'Pump: falls', 'p', 'q (BH)', 'Pump: long run', 'Producer to distributor: long run'],
    allNote: 'Sums of the short-run coefficients (the week of the shock and the next three). q is the p-value corrected by Benjamini-Hochberg across the 27 states. From producer to distributor only the long-run share is shown: the weekly dynamics of that stage are not identified in this window (tax and ethanol-blend changes).',
    brand: 'Price relative to the municipality-week mean (%)', majors: 'Major brands', others: 'Other brands', white: 'White flag (reference)',
    near: 'Competitors in the same 5-digit postal code', none: 'none (reference)', disp: 'Price dispersion by size of municipality',
    cv: 'Coefficient of variation (median)', gap: 'Gap between the 90th and 10th percentile, R$ (median)', stations: 'stations',
    compNote: 'Regular gasoline, 2025 and 2026. Coefficients with 95% intervals, errors clustered by municipality. These are associations: stations with more competitors nearby also sit in city centres and on highways.',
    product: 'Product', series: 'Series', hist: 'Sales (m³)', fc: 'Reconciled forecast', level: 'Level', model: 'Model', wape: 'Error (WAPE)',
    lv: {Brazil: 'Brazil', region: 'Region', state: 'State'}, prods: {'Gasoline C': 'Gasoline C', 'Hydrous ethanol': 'Hydrous ethanol', 'Diesel': 'Diesel'},
    models: {'Seasonal naive': 'Seasonal naive', 'ETS': 'ETS', 'ETS + MinT': 'ETS + MinT', 'Global GBM, bottom-up': 'Global GBM, bottom-up'},
    fcNote: 'Mean error 12 months ahead over 12 origins from 2023 to 2025, refitting on the past only at each one.', loading: 'Loading...'
  };
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', blue: '#0369a1', red: '#b91c1c'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'fuel-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function card(parent, label) { var c = el('div', {class: 'fuel-card'}); c.appendChild(el('div', {class: 'fuel-card-l'}, label)); var v = el('div', {class: 'fuel-card-v'}); c.appendChild(v); var s = el('div', {class: 'fuel-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function box(p, cls) { var b = el('div', {class: 'fuel-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  var tc = function () { return getComputedStyle(root).color; };
  function opts(yfmt, xTitle) {
    var c = tc();
    return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {labels: {color: c, boxWidth: 14, filter: function (i) { return i.text; }}}},
      scales: {x: {title: {display: !!xTitle, text: xTitle, color: c}, ticks: {color: c, maxTicksLimit: 9, maxRotation: 0}, grid: {display: false}},
        y: {ticks: yfmt ? {color: c, callback: yfmt} : {color: c}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }
  var STATES = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'fuel-tabs'}); root.appendChild(nav);
    var made = {}, makers = [state, shock, all, comp, fc];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'fuel-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }
  function rowOf(D, s) { return D.passthrough.states.filter(function (r) { return r.state === s; })[0]; }

  function state(p, D) {
    var ctl = el('div', {class: 'fuel-ctls'}); p.appendChild(ctl);
    var sS = control(ctl, T.state, select(STATES.map(function (s) { return [s, s]; }), 'SP'));
    var cards = el('div', {class: 'fuel-cards'}); p.appendChild(cards);
    var cU = card(cards, T.sumUp), cD = card(cards, T.sumDn), cP = card(cards, T.pval), cL = card(cards, T.lr);
    var ch = new Chart(box(p), {type: 'line', data: {labels: [], datasets: []}, options: opts(function (v) { return fmt(v, 2); })});
    p.appendChild(el('h4', {}, T.pump + ': ' + T.cum.toLowerCase()));
    var i1 = new Chart(box(p, 'fuel-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: opts(function (v) { return fmt(v, 1); }, T.weeks)});
    function irf(chart, d) {
      chart.data.labels = d.up.map(function (_, i) { return i; });
      chart.data.datasets = [{label: T.rise, data: d.up, borderColor: C.red, borderWidth: 2, pointRadius: 0}, {label: T.fall, data: d.down, borderColor: C.blue, borderWidth: 2, pointRadius: 0}];
      chart.update();
    }
    function upd() {
      var s = sS.value, r = rowOf(D, s), x = D.series[s];
      cU.v.textContent = fmt(r.pump.sum_up, 2); cU.s.textContent = T.pump;
      cD.v.textContent = fmt(r.pump.sum_down, 2); cD.s.textContent = T.pump;
      cP.v.textContent = fmt(r.pump.symmetry_p, 3); cP.s.textContent = 'q (BH) ' + fmt(r.pump.symmetry_q, 2);
      cL.v.textContent = fmt(r.pump.long_run, 2); cL.s.textContent = T.pump;
      ch.data.labels = x.weeks;
      ch.data.datasets = [{label: T.retail, data: x.retail, borderColor: C.main, borderWidth: 2, pointRadius: 0},
        {label: T.dist, data: x.distribution, borderColor: C.alt, borderWidth: 1.5, pointRadius: 0},
        {label: T.prod, data: x.producer, borderColor: C.grey, borderWidth: 1.5, pointRadius: 0}];
      ch.update(); irf(i1, r.irf_pump);
    }
    sS.addEventListener('change', upd); upd();
  }

  function path(r, shock) { var c = r.irf_pump[shock >= 0 ? 'up' : 'down']; return c.map(function (v) { return shock * v; }); }

  function shock(p, D) {
    var ctl = el('div', {class: 'fuel-ctls'}); p.appendChild(ctl);
    var sS = control(ctl, T.state, select(STATES.map(function (s) { return [s, s]; }), 'SP'));
    var so = el('output'), sK = control(ctl, T.shock, el('input', {type: 'range', min: -0.5, max: 0.5, step: 0.05, value: 0.2}), so);
    var ch = new Chart(box(p), {type: 'line', data: {labels: [], datasets: []}, options: opts(function (v) { return fmt(v, 2); }, T.weeks)});
    var chk = el('p', {class: 'fuel-note'}); p.appendChild(chk);
    var ref = D.sim_reference, js = path(rowOf(D, ref.state), ref.shock);
    var diff = Math.max.apply(null, js.map(function (v, i) { return Math.abs(v - ref.pump[i]); }));
    chk.textContent = T.check + ' (' + ref.state + ', ' + fmt(ref.shock, 2) + '): ' + (PT ? 'maior diferença ' : 'largest difference ') + diff.toExponential(1);
    function upd() {
      var r = rowOf(D, sS.value), k = +sK.value, q = path(r, k);
      so.textContent = (k >= 0 ? '+' : '') + fmt(k, 2);
      ch.data.labels = q.map(function (_, i) { return i; });
      ch.data.datasets = [{label: T.dist, data: q.map(function () { return k; }), borderColor: C.alt, borderWidth: 2, borderDash: [5, 3], pointRadius: 0}, {label: T.retail, data: q, borderColor: C.main, borderWidth: 2, pointRadius: 0}];
      ch.options.plugins.title = {display: true, text: T.pathTitle, color: tc()};
      ch.update();
    }
    [sS, sK].forEach(function (x) { x.addEventListener('input', upd); x.addEventListener('change', upd); }); upd();
  }

  function all(p, D) {
    var tb = el('table', {class: 'fuel-table'}); p.appendChild(tb);
    tb.innerHTML = '<thead><tr>' + T.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      D.passthrough.states.map(function (r) {
        var sig = function (q) { return q < 0.05 ? ' class="sig"' : ''; };
        return '<tr><td>' + r.state + '</td><td>' + fmt(r.pump.sum_up, 2) + '</td><td>' + fmt(r.pump.sum_down, 2) + '</td><td>' + fmt(r.pump.symmetry_p, 3) + '</td><td' + sig(r.pump.symmetry_q) + '>' + fmt(r.pump.symmetry_q, 2) +
          '</td><td>' + fmt(r.pump.long_run, 2) + '</td><td>' + fmt(r.upstream.long_run, 2) + '</td></tr>';
      }).join('') + '</tbody>';
    p.appendChild(el('p', {class: 'fuel-note'}, T.allNote));
  }

  function comp(p, D) {
    var P = D.competition.position;
    var name = {'major brand': T.majors, 'other brand': T.others, '1-2': '1-2', '3-5': '3-5', '6-10': '6-10', '11+': '11+'};
    var rows = P.coefs;
    var ch = new Chart(box(p, 'fuel-chart-s'), {type: 'bar', data: {labels: rows.map(function (r) { return (r.kind === 'brand' ? '' : T.near + ': ') + name[r.term]; }), datasets: [
      {data: rows.map(function (r) { return r.coef; }), backgroundColor: rows.map(function (r) { return r.kind === 'brand' ? C.main : C.grey; }), borderRadius: 3},
      {data: rows.map(function (r) { return [r.lo, r.hi]; }), backgroundColor: 'rgba(127,127,127,.35)', barPercentage: .25, grouped: false}]},
      options: Object.assign(opts(null), {indexAxis: 'y'})});
    ch.options.plugins.legend.display = false; ch.options.scales.x.ticks.callback = function (v) { return fmt(v, 1) + '%'; };
    ch.options.scales.x.title = {display: true, text: T.brand, color: tc()}; ch.options.scales.x.grid = {color: 'rgba(127,127,127,.15)'}; ch.options.scales.y.grid = {display: false}; ch.update();
    p.appendChild(el('p', {class: 'fuel-note'}, T.white + '; ' + T.near.toLowerCase() + ': ' + T.none + '. ' + fmt(P.stations, 0) + ' ' + T.stations + ', ' + fmt(P.municipalities, 0) + (PT ? ' municípios.' : ' municipalities.')));
    p.appendChild(el('h4', {}, T.disp));
    var d = D.competition.dispersion_by_size;
    var c2 = new Chart(box(p, 'fuel-chart-s'), {type: 'bar', data: {labels: d.map(function (r) { return r.size + ' ' + T.stations; }), datasets: [
      {label: T.gap, data: d.map(function (r) { return r.p90_p10; }), backgroundColor: C.alt, borderRadius: 3}]}, options: opts(function (v) { return fmt(v, 2); })});
    p.appendChild(el('p', {class: 'fuel-note'}, T.compNote));
  }

  function fc(p, D) {
    var F = D.forecast, ctl = el('div', {class: 'fuel-ctls'}); p.appendChild(ctl);
    var prods = Object.keys(F.future);
    var sP = control(ctl, T.product, select(prods.map(function (k) { return [k, T.prods[k] || k]; }), prods[0]));
    var sS = control(ctl, T.series, select([], 'Brazil'));
    var ch = new Chart(box(p), {type: 'line', data: {labels: [], datasets: []}, options: opts(function (v) { return fmt(v / 1e3, 0) + 'k'; })});
    var tb = el('table', {class: 'fuel-table'}); p.appendChild(tb);
    p.appendChild(el('p', {class: 'fuel-note'}, T.fcNote));
    function lab(n) { return n === 'Brazil' ? (PT ? 'Brasil' : 'Brazil') : n.replace('Region', PT ? 'Região' : 'Region'); }
    function fill() {
      var names = F.future[sP.value].names; sS.innerHTML = '';
      names.forEach(function (n) { sS.appendChild(el('option', {value: n}, lab(n))); }); sS.value = 'Brazil';
    }
    function upd() {
      var f = F.future[sP.value], s = sS.value, hl = f.history_dates.length;
      ch.data.labels = f.history_dates.concat(f.dates);
      ch.data.datasets = [{label: T.hist, data: f.history[s].concat(new Array(f.dates.length).fill(null)), borderColor: C.grey, borderWidth: 1.5, pointRadius: 0},
        {label: T.fc, data: new Array(hl - 1).fill(null).concat([f.history[s][hl - 1]]).concat(f.forecast[s]), borderColor: C.main, borderWidth: 2, pointRadius: 0}];
      ch.update();
      var w = F.wape.filter(function (r) { return r.product === sP.value; }), models = Object.keys(T.models), levels = ['Brazil', 'region', 'state'];
      tb.innerHTML = '<thead><tr><th>' + T.level + '</th>' + models.map(function (m) { return '<th>' + T.models[m] + '</th>'; }).join('') + '</tr></thead><tbody>' +
        levels.map(function (l) { var best = Math.min.apply(null, models.map(function (m) { var r = w.filter(function (x) { return x.level === l && x.model === m; })[0]; return r ? r.wape : 9; }));
          return '<tr><td>' + T.lv[l] + '</td>' + models.map(function (m) { var r = w.filter(function (x) { return x.level === l && x.model === m; })[0]; return '<td' + (r && r.wape === best ? ' class="sig"' : '') + '>' + (r ? fmt(100 * r.wape, 1) + '%' : '–') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
    }
    sP.addEventListener('change', function () { fill(); upd(); }); sS.addEventListener('change', upd); fill(); upd();
  }
})();
