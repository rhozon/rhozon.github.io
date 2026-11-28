/* Interactive part of the fraud detection case. Plain JavaScript + Chart.js, from data.json and
   names.json (python -m fraudx.cli all --site results; python tools/export_site.py site).
   The name screening functions are a port of fraudx/sanctions.py, checked against it. */
(function () {
  'use strict';
  var FX = {};
  var FOLD = [['KS', 'X'], ['PH', 'F'], ['SCH', 'SH'], ['TCH', 'CH'], ['DZH', 'J'], ['ZH', 'J'], ['KH', 'H'], ['W', 'V'], ['Y', 'I'], ['OU', 'U']];
  FX.normalise = function (name) {
    var s = String(name).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toUpperCase();
    s = s.replace(/[`']/g, '').replace(/[^A-Z0-9 ]+/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  };
  FX.fold = function (s) { FOLD.forEach(function (p) { s = s.split(p[0]).join(p[1]); }); return s; };
  function lcs(a, b) {
    if (!a.length || !b.length) return 0;
    var prev = new Uint16Array(b.length + 1), cur = new Uint16Array(b.length + 1);
    for (var i = 0; i < a.length; i++) {
      cur[0] = 0;
      for (var j = 1; j <= b.length; j++) cur[j] = a.charCodeAt(i) === b.charCodeAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  FX.ratio = function (a, b) { if (!a.length && !b.length) return 100; return 100 * 2 * lcs(a, b) / (a.length + b.length); };
  function toks(s) { return s.split(' ').filter(Boolean); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }).sort(); }
  FX.scoreKeys = function (qa, kb) {
    var ta = toks(qa), tb = toks(kb);
    var sort = FX.ratio(ta.slice().sort().join(' '), tb.slice().sort().join(' '));
    var sa = uniq(ta), sb = uniq(tb);
    var inter = sa.filter(function (x) { return sb.indexOf(x) >= 0; });
    var tset = 0;
    if (inter.length && Math.min(sa.length, sb.length) >= 2) {
      var i = inter.join(' ');
      var d1 = (i + ' ' + sa.filter(function (x) { return sb.indexOf(x) < 0; }).join(' ')).trim();
      var d2 = (i + ' ' + sb.filter(function (x) { return sa.indexOf(x) < 0; }).join(' ')).trim();
      tset = Math.max(FX.ratio(i, d1), FX.ratio(i, d2), FX.ratio(d1, d2));
    }
    return Math.max(sort, tset);
  };
  FX.score = function (a, b) { return FX.scoreKeys(FX.fold(FX.normalise(a)), FX.fold(FX.normalise(b))); };
  FX.search = function (keys, query, threshold, k) {
    var q = FX.fold(FX.normalise(query)), qt = toks(q), out = [];
    if (!q) return out;
    for (var n = 0; n < keys.length; n++) {
      var key = keys[n];
      if (Math.abs(key.length - q.length) > Math.max(q.length, key.length) * 0.6) continue;
      if (key.charAt(0) !== q.charAt(0)) {
        var kt = toks(key), shared = false;
        for (var j = 0; j < qt.length && !shared; j++) shared = kt.indexOf(qt[j]) >= 0;
        if (!shared) continue;
      }
      var s = FX.scoreKeys(q, key);
      if (s >= threshold) out.push([n, s]);
    }
    return out.sort(function (a, b) { return b[1] - a[1]; }).slice(0, k);
  };
  if (typeof module !== 'undefined') { module.exports = FX; return; }

  var root = document.getElementById('frd-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Limiar de alerta', 'Fila de análise', 'Por que este alerta', 'Grafo de pagamentos', 'Triagem de nomes'],
    loading: 'Carregando...', rc: 'Custo de analisar um alerta (US$)', thr: 'Limiar do escore (alerta acima dele)', best: 'Usar o limiar de menor custo',
    alerts: 'Alertas', caught: 'Fraudes pegas', missed: 'Valor de fraude perdido', cost: 'Custo total', prec: 'precisão', of: 'de',
    curve: 'Custo total por limiar (período de teste)', costAx: 'US$ (escala log)', thrAx: 'Limiar do escore (escala log)',
    simNote: 'Gradient boosting no período de teste (as últimas ~10 horas da base, 56.962 transações, 75 fraudes). No navegador o simulador usa todas as fraudes e 1 em cada 20 transações legítimas, com peso 20; os números exatos, na base inteira, estão na tabela.',
    modelHead: ['Modelo', 'PR-AUC', 'ROC-AUC', 'Limiar', 'Alertas', 'Fraudes pegas', 'Precisão', 'Custo (US$)'],
    modelNote: 'Limiar escolhido no período de validação, pelo menor custo com US$ 5 por alerta, e aplicado ao teste.',
    sensHead: ['Custo por alerta (US$)', 'Limiar', 'Alertas', 'Fraudes pegas', 'Precisão', 'Custo total (US$)'],
    capT: 'Equipe com capacidade fixa: os k maiores escores de cada hora', perHour: 'Alertas analisados por hora', capCaught: 'Fraudes pegas', capAmt: 'Valor recuperado (US$)',
    capNote: 'Com 5 analistas-alerta por hora, 31 das 75 fraudes chegam à equipe; com 20, 60. Acima disso, cada analista a mais encontra pouca fraude nova.',
    unsupT: 'Sem rótulos: o que os modelos não supervisionados pegam', unsupHead: ['Modelo', 'PR-AUC', 'ROC-AUC', 'Fraudes no 1% de maior escore'],
    unsupNote: 'Isolation forest e autoencoder treinados só nas transações, sem ver um rótulo. Pegam metade e um terço das fraudes no 1% mais estranho, contra 87% do modelo supervisionado: servem para achar padrões novos, não para substituir o modelo.',
    pick: 'Alerta', expT: 'Contribuição de cada variável ao escore (log-odds, SHAP exato da árvore)', impT: 'Importância média (|SHAP|) no período de teste',
    expNote: 'V1 a V28 são componentes principais que o publicador da base usou para anonimizar as variáveis originais; por isso a explicação mostra o mecanismo, não o significado de negócio. Na sua base, as mesmas barras diriam "valor 6 vezes acima da média do cliente" ou "comerciante novo".',
    psiT: 'Mudança de distribuição entre treino e teste (PSI)', psiNote: 'PSI acima de 0,25 é mudança grande. A hora do dia muda por construção (o teste cobre outras horas); V1 e V3 mudam de verdade. O escore do modelo muda pouco (PSI {s}).',
    gT: 'F1 da classe ilícita por passo de tempo (teste, passos 35 a 49)', step: 'Passo de tempo (cerca de duas semanas cada)', f1: 'F1',
    gNote: 'Um mercado da dark web fechou perto do passo 43. Daí em diante nenhum modelo acha as transações ilícitas: o padrão mudou e o modelo, treinado antes, não viu o novo. É o caso para monitoramento e re-treino, não para um modelo mais complexo.',
    gHead: ['Modelo', 'F1', 'Precisão', 'Recall'], cnt: 'Transações rotuladas por passo', illicit: 'Ilícitas', licit: 'Lícitas',
    sQ: 'Nome a verificar', sPh: 'ex.: Aleksandr Ivanov, Banco Nacional...', sT: 'Similaridade mínima', sHead: ['Nome na lista', 'Similaridade', 'Lista', 'Tipo', 'Programa'],
    none: 'Nenhum nome da lista acima do limiar.', loadNames: 'Carregando 43.648 nomes das listas da OFAC e da ONU...',
    types: {i: 'pessoa', e: 'entidade', a: 'alias', v: 'navio', c: 'aeronave'}, src: {O: 'OFAC', U: 'ONU'},
    curveT: 'Escolha do limiar: recall em variações de nomes das listas e alertas em nomes comuns', recall: 'Recall (nomes das listas alterados)', alertRate: 'Alertas em nomes comuns',
    sNote: 'Recall medido em 300 nomes das listas com uma alteração (ordem, transliteração, letra faltando, nome do meio omitido, acentos); alertas em 300 nomes brasileiros e ingleses comuns gerados ao acaso. A busca roda no seu navegador, nada é enviado.'
  } : {
    tabs: ['Alert threshold', 'Review queue', 'Why this alert', 'Payment graph', 'Name screening'],
    loading: 'Loading...', rc: 'Cost of reviewing one alert (US$)', thr: 'Score threshold (alert above it)', best: 'Use the lowest-cost threshold',
    alerts: 'Alerts', caught: 'Frauds caught', missed: 'Fraud amount missed', cost: 'Total cost', prec: 'precision', of: 'of',
    curve: 'Total cost by threshold (test period)', costAx: 'US$ (log scale)', thrAx: 'Score threshold (log scale)',
    simNote: 'Gradient boosting on the test period (the last ~10 hours of the data, 56,962 transactions, 75 frauds). In the browser the simulator uses every fraud and 1 in 20 legitimate transactions, weighted by 20; the exact figures, on the full data, are in the table.',
    modelHead: ['Model', 'PR-AUC', 'ROC-AUC', 'Threshold', 'Alerts', 'Frauds caught', 'Precision', 'Cost (US$)'],
    modelNote: 'Threshold chosen on the validation period, at the lowest cost with US$ 5 per alert, and applied to the test period.',
    sensHead: ['Cost per alert (US$)', 'Threshold', 'Alerts', 'Frauds caught', 'Precision', 'Total cost (US$)'],
    capT: 'A team with fixed capacity: the k highest scores of each hour', perHour: 'Alerts reviewed per hour', capCaught: 'Frauds caught', capAmt: 'Amount recovered (US$)',
    capNote: 'With 5 reviews per hour, 31 of the 75 frauds reach the team; with 20, 60. Beyond that, each extra analyst finds little new fraud.',
    unsupT: 'Without labels: what the unsupervised models catch', unsupHead: ['Model', 'PR-AUC', 'ROC-AUC', 'Frauds in the top 1% of scores'],
    unsupNote: 'Isolation forest and an autoencoder trained on the transactions only, never seeing a label. They catch half and a third of the frauds in the strangest 1%, against 87% for the supervised model: they are for finding new patterns, not for replacing the model.',
    pick: 'Alert', expT: 'Contribution of each feature to the score (log-odds, exact tree SHAP)', impT: 'Mean importance (|SHAP|) over the test period',
    expNote: 'V1 to V28 are principal components the publisher used to anonymise the original features, so the explanation shows the mechanism, not the business meaning. On your data, the same bars would read "amount 6 times the customer\'s average" or "new merchant".',
    psiT: 'Distribution shift between training and test (PSI)', psiNote: 'A PSI above 0.25 is a large shift. Hour of day shifts by construction (the test period covers other hours); V1 and V3 really shift. The model\'s score shifts little (PSI {s}).',
    gT: 'F1 of the illicit class by time step (test, steps 35 to 49)', step: 'Time step (about two weeks each)', f1: 'F1',
    gNote: 'A dark-web market closed around step 43. From then on no model finds the illicit transactions: the pattern changed and the model, trained before, never saw the new one. This calls for monitoring and retraining, not a more complex model.',
    gHead: ['Model', 'F1', 'Precision', 'Recall'], cnt: 'Labelled transactions by step', illicit: 'Illicit', licit: 'Licit',
    sQ: 'Name to check', sPh: 'e.g. Aleksandr Ivanov, Banco Nacional...', sT: 'Minimum similarity', sHead: ['Name on the list', 'Similarity', 'List', 'Type', 'Programme'],
    none: 'No listed name above the threshold.', loadNames: 'Loading 43,648 names from the OFAC and UN lists...',
    types: {i: 'person', e: 'entity', a: 'alias', v: 'vessel', c: 'aircraft'}, src: {O: 'OFAC', U: 'UN'},
    curveT: 'Choosing the threshold: recall on altered listed names and alerts on common names', recall: 'Recall (altered listed names)', alertRate: 'Alerts on common names',
    sNote: 'Recall measured on 300 listed names with one change (word order, transliteration, a missing letter, a dropped middle name, accents); alerts on 300 common Brazilian and English names generated at random. The search runs in your browser, nothing is sent.'
  };
  var MODELS = PT ? {'Logistic regression': 'Regressão logística', 'Gradient boosting (XGBoost)': 'Gradient boosting (XGBoost)',
    'Isolation forest': 'Isolation forest', 'Autoencoder': 'Autoencoder',
    'Random forest, local features': 'Random forest, variáveis locais', 'Random forest, local + aggregated': 'Random forest, locais + agregadas',
    'Random forest, local + graph features': 'Random forest, locais + do grafo', 'Random forest, all features': 'Random forest, todas as variáveis',
    'GraphSAGE, local features': 'GraphSAGE, variáveis locais'} : {};
  function mn(k) { return MODELS[k] || k; }
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', blue: '#0369a1', red: '#b91c1c'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x, d) { return fmt(100 * x, d == null ? 1 : d) + '%'; }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function control(parent, label, input, out) { var w = el('label', {class: 'frd-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function card(parent, label) { var c = el('div', {class: 'frd-card'}); c.appendChild(el('div', {class: 'frd-card-l'}, label)); var v = el('div', {class: 'frd-card-v'}); c.appendChild(v); var s = el('div', {class: 'frd-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function box(p, cls) { var b = el('div', {class: 'frd-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  function table(p, head, rows) {
    var t = el('table', {class: 'frd-table'}), th = el('thead'), tr = el('tr');
    head.forEach(function (h) { tr.appendChild(el('th', {}, h)); }); th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody'); rows.forEach(function (r) { var x = el('tr'); r.forEach(function (c) { x.appendChild(el('td', {}, c)); }); tb.appendChild(x); }); t.appendChild(tb);
    p.appendChild(t); return t;
  }
  var tc = function () { return getComputedStyle(root).color; };
  function opts(yfmt, xTitle, yTitle) {
    var c = tc();
    return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {labels: {color: c, boxWidth: 14, filter: function (i) { return i.text; }}}},
      scales: {x: {title: {display: !!xTitle, text: xTitle, color: c}, ticks: {color: c, maxTicksLimit: 10, maxRotation: 0}, grid: {display: false}},
        y: {title: {display: !!yTitle, text: yTitle, color: c}, ticks: yfmt ? {color: c, callback: yfmt} : {color: c}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'frd-tabs'}); root.appendChild(nav);
    var made = {}, makers = [threshold, queue, explain, graph, screen];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'frd-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  // ---- 1. threshold chosen by cost ------------------------------------------------------------
  function threshold(p, D) {
    var S = D.card.sim, w = D.card.sim.weight_legit, n = S.score.length;
    var idx = []; for (var i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return S.score[b] - S.score[a]; });
    var totalFraud = 0; for (i = 0; i < n; i++) if (S.y[i]) totalFraud += S.amount[i];
    function at(t, rc) {
      var alerts = 0, caught = 0, amt = 0;
      for (var k = 0; k < n; k++) { var j = idx[k]; if (S.score[j] < t) break; alerts += S.y[j] ? 1 : w; if (S.y[j]) { caught++; amt += S.amount[j]; } }
      return {alerts: alerts, caught: caught, missed: totalFraud - amt, cost: totalFraud - amt + rc * alerts};
    }
    var grid = []; for (var e = -5; e <= 0.0001; e += 0.1) grid.push(Math.pow(10, e));
    var ctl = el('div', {class: 'frd-ctls'}); p.appendChild(ctl);
    var sRc = control(ctl, T.rc, select([1, 2, 5, 10, 20, 50].map(function (x) { return [x, 'US$ ' + x]; }), 5));
    var out = el('output'), sT = control(ctl, T.thr, el('input', {type: 'range', min: -5, max: 0, step: 0.05, value: -1.7}), out);
    var bB = el('button', {type: 'button', class: 'frd-btn'}, T.best); ctl.appendChild(bB);
    var cards = el('div', {class: 'frd-cards'}); p.appendChild(cards);
    var cA = card(cards, T.alerts), cC = card(cards, T.caught), cM = card(cards, T.missed), cT = card(cards, T.cost);
    p.appendChild(el('h4', {}, T.curve));
    var ch = new Chart(box(p), {type: 'line', data: {labels: grid.map(function (g) { return g.toPrecision(2); }), datasets: [
      {label: T.cost, data: [], borderColor: C.main, borderWidth: 2, pointRadius: 0},
      {label: '', data: [], borderColor: C.alt, backgroundColor: C.alt, pointRadius: 6, showLine: false}]}, options: opts(function (v) { return fmt(v); }, T.thrAx, T.costAx)});
    ch.options.scales.y.type = 'logarithmic'; ch.options.scales.y.ticks.maxTicksLimit = 6;
    function best(rc) { var bi = 0, bc = Infinity; grid.forEach(function (g, k) { var c = at(g, rc).cost; if (c < bc) { bc = c; bi = k; } }); return Math.log10(grid[bi]); }
    function update() {
      var rc = +sRc.value, t = Math.pow(10, +sT.value), r = at(t, rc);
      out.textContent = t.toPrecision(3);
      cA.v.textContent = fmt(r.alerts); cA.s.textContent = T.prec + ' ' + pct(r.caught / Math.max(r.alerts, 1));
      cC.v.textContent = r.caught + ' ' + T.of + ' 75'; cC.s.textContent = pct(r.caught / 75, 0);
      cM.v.textContent = 'US$ ' + fmt(r.missed); cM.s.textContent = T.of + ' US$ ' + fmt(totalFraud);
      cT.v.textContent = 'US$ ' + fmt(r.cost); cT.s.textContent = fmt(r.alerts) + ' x US$ ' + rc + ' + ' + fmt(r.missed);
      var costs = grid.map(function (g) { return at(g, rc).cost; });
      var k = 0; grid.forEach(function (g, j) { if (Math.abs(Math.log10(g) - Math.log10(t)) < Math.abs(Math.log10(grid[k]) - Math.log10(t))) k = j; });
      ch.data.datasets[0].data = costs; ch.data.datasets[1].data = costs.map(function (c, j) { return j === k ? c : null; }); ch.update();
    }
    sRc.addEventListener('change', function () { sT.value = best(+sRc.value); update(); });
    sT.addEventListener('input', update);
    bB.addEventListener('click', function () { sT.value = best(+sRc.value); update(); });
    sT.value = best(5); update();
    p.appendChild(el('p', {class: 'frd-note'}, T.simNote));
    var M = D.card.models;
    table(p, T.modelHead, Object.keys(M).map(function (k) { var m = M[k], t = m.test; return [mn(k), fmt(m.pr_auc, 3), fmt(m.roc_auc, 3), m.threshold.toPrecision(3), fmt(t.alerts), t.caught + ' ' + T.of + ' ' + t.frauds, pct(t.precision), fmt(t.cost)]; }));
    p.appendChild(el('p', {class: 'frd-note'}, T.modelNote));
    table(p, T.sensHead, D.card.sensitivity.map(function (r) { return [r.review_cost, r.threshold.toPrecision(3), fmt(r.alerts), r.caught + ' ' + T.of + ' ' + r.frauds, pct(r.precision), fmt(r.cost)]; }));
  }

  // ---- 2. review queue and unsupervised detection -----------------------------------------------
  function queue(p, D) {
    var Q = D.card.capacity;
    p.appendChild(el('h4', {}, T.capT));
    new Chart(box(p, 'frd-chart-s'), {type: 'bar', data: {labels: Q.rows.map(function (r) { return r.per_hour; }), datasets: [
      {label: T.capCaught + ' (' + T.of + ' ' + Q.frauds + ')', data: Q.rows.map(function (r) { return r.caught; }), backgroundColor: C.main, borderRadius: 4}]},
      options: opts(null, T.perHour, T.capCaught)});
    table(p, [T.perHour, T.alerts, T.capCaught, T.capAmt], Q.rows.map(function (r) { return [r.per_hour, fmt(r.alerts), r.caught + ' ' + T.of + ' ' + Q.frauds, fmt(r.caught_amount) + ' ' + T.of + ' ' + fmt(Q.fraud_amount)]; }));
    p.appendChild(el('p', {class: 'frd-note'}, T.capNote));
    p.appendChild(el('h4', {}, T.unsupT));
    var A = D.anomaly, xg = D.card.models['Gradient boosting (XGBoost)'];
    var rows = [[mn('Gradient boosting (XGBoost)'), fmt(xg.pr_auc, 3), fmt(xg.roc_auc, 3), pct(xg.recall_top1pct, 0)]];
    ['Isolation forest', 'Autoencoder'].forEach(function (k) { rows.push([mn(k), fmt(A[k].pr_auc, 3), fmt(A[k].roc_auc, 3), pct(A[k].recall_top1pct, 0)]); });
    table(p, T.unsupHead, rows);
    p.appendChild(el('p', {class: 'frd-note'}, T.unsupNote));
  }

  // ---- 3. explanations and drift ----------------------------------------------------------------
  function explain(p, D) {
    var E = D.card.explanations;
    var ctl = el('div', {class: 'frd-ctls'}); p.appendChild(ctl);
    var sA = control(ctl, T.pick, select(E.map(function (e, i) { return [i, '#' + (i + 1) + ': US$ ' + fmt(e.amount, 2) + ', ' + (PT ? 'escore ' : 'score ') + fmt(e.score, 4)]; }), 0));
    p.appendChild(el('h4', {}, T.expT));
    var ch = new Chart(box(p, 'frd-chart-s'), {type: 'bar', data: {labels: [], datasets: [{label: '', data: [], backgroundColor: []}]},
      options: Object.assign(opts(null, null), {indexAxis: 'y', plugins: {legend: {display: false}}})});
    function update() {
      var e = E[+sA.value];
      ch.data.labels = e.features.map(function (f) { return f.name + ' = ' + fmt(f.value, 2); });
      ch.data.datasets[0].data = e.features.map(function (f) { return f.contrib; });
      ch.data.datasets[0].backgroundColor = e.features.map(function (f) { return f.contrib > 0 ? C.red : C.blue; });
      ch.update();
    }
    sA.addEventListener('change', update); update();
    p.appendChild(el('p', {class: 'frd-note'}, T.expNote));
    var split = el('div', {class: 'frd-split'}); p.appendChild(split);
    var a = el('div'), b = el('div'); split.appendChild(a); split.appendChild(b);
    a.appendChild(el('h4', {}, T.impT));
    var I = D.card.importance;
    new Chart(box(a, 'frd-chart-s'), {type: 'bar', data: {labels: I.map(function (r) { return r.name; }), datasets: [{label: '', data: I.map(function (r) { return r.mean_abs; }), backgroundColor: C.main, borderRadius: 4}]},
      options: Object.assign(opts(null, null), {indexAxis: 'y', plugins: {legend: {display: false}}})});
    b.appendChild(el('h4', {}, T.psiT));
    table(b, ['', 'PSI'], D.card.psi.map(function (r) { return [r[0], fmt(r[1], 2)]; }));
    b.appendChild(el('p', {class: 'frd-note'}, T.psiNote.replace('{s}', fmt(D.card.psi_score, 2))));
  }

  // ---- 4. payment graph -------------------------------------------------------------------------
  function graph(p, D) {
    var G = D.graph, show = ['Random forest, all features', 'Random forest, local features', 'GraphSAGE, local features'], col = [C.main, C.grey, C.alt];
    p.appendChild(el('h4', {}, T.gT));
    var ch = new Chart(box(p), {type: 'line', data: {labels: G.steps, datasets: show.map(function (k, i) {
      return {label: mn(k), data: G.by_step[k], borderColor: col[i], backgroundColor: col[i], borderWidth: 2, pointRadius: 3, spanGaps: true}; })},
      options: opts(function (v) { return fmt(v, 1); }, T.step, T.f1)});
    ch.options.scales.y.min = 0; ch.options.scales.y.max = 1; ch.update();
    p.appendChild(el('p', {class: 'frd-note'}, T.gNote));
    table(p, T.gHead, Object.keys(G.models).map(function (k) { var m = G.models[k]; return [mn(k), fmt(m.f1, 3), fmt(m.precision, 3), fmt(m.recall, 3)]; }));
    p.appendChild(el('h4', {}, T.cnt));
    var steps = []; for (var s = 1; s <= 49; s++) steps.push(s);
    new Chart(box(p, 'frd-chart-s'), {type: 'bar', data: {labels: steps, datasets: [
      {label: T.illicit, data: G.illicit_by_step, backgroundColor: C.red}, {label: T.licit, data: G.licit_by_step, backgroundColor: 'rgba(100,116,139,.45)'}]},
      options: (function () { var o = opts(function (v) { return fmt(v); }, T.step); o.scales.x.stacked = true; o.scales.y.stacked = true; return o; })()});
  }

  // ---- 5. name screening ------------------------------------------------------------------------
  function screen(p, D) {
    var ctl = el('div', {class: 'frd-ctls'}); p.appendChild(ctl);
    var q = control(ctl, T.sQ, el('input', {type: 'text', placeholder: T.sPh, value: 'Aleksandr Ivanov'}));
    var out = el('output'), sT = control(ctl, T.sT, el('input', {type: 'range', min: 70, max: 100, step: 1, value: 88}), out);
    var res = el('div'); p.appendChild(res);
    res.appendChild(el('p', {}, T.loadNames));
    var src = root.getAttribute('data-src').replace('data.json', 'names.json');
    fetch(src).then(function (r) { return r.json(); }).then(function (L) {
      var keys = L.map(function (r) { return FX.fold(FX.normalise(r[0])); });
      var timer;
      function run() {
        out.textContent = sT.value;
        var hits = FX.search(keys, q.value, +sT.value, 12);
        res.innerHTML = '';
        if (!hits.length) { res.appendChild(el('p', {}, T.none)); return; }
        table(res, T.sHead, hits.map(function (h) { var r = L[h[0]]; return [esc(r[0]), fmt(h[1], 1), T.src[r[1]] || r[1], T.types[r[2]] || r[2], esc(r[3])]; }));
      }
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 200); });
      sT.addEventListener('input', run);
      run();
    }).catch(function (e) { res.innerHTML = '<p>names.json: ' + e + '</p>'; });
    p.appendChild(el('h4', {}, T.curveT));
    var K = D.sanctions.curve;
    var ch = new Chart(box(p, 'frd-chart-s'), {type: 'line', data: {labels: K.map(function (r) { return r.threshold; }), datasets: [
      {label: T.recall, data: K.map(function (r) { return r.recall; }), borderColor: C.main, backgroundColor: C.main, borderWidth: 2, pointRadius: 4},
      {label: T.alertRate, data: K.map(function (r) { return r.alert_rate; }), borderColor: C.alt, backgroundColor: C.alt, borderWidth: 2, pointRadius: 4}]},
      options: opts(function (v) { return pct(v, 0); }, T.sT)});
    ch.options.scales.y.min = 0; ch.options.scales.y.max = 1; ch.update();
    p.appendChild(el('p', {class: 'frd-note'}, T.sNote));
  }
})();
