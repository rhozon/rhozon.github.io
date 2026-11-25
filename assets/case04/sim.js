/* Interactive part of the causal NPS case. Plain JavaScript + Chart.js. The data are generated in
   the browser by the same simulator as nps-causal-demo.py, and the three estimators are run on
   them: difference in means, regression adjustment (OLS) and inverse-probability weighting. */
(function () {
  // ---- numerics -----------------------------------------------------------------------------
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normal(u) { var s = null; return function () { if (s !== null) { var r = s; s = null; return r; } var a = 1 - u(), b = u(), m = Math.sqrt(-2 * Math.log(a)); s = m * Math.sin(2 * Math.PI * b); return m * Math.cos(2 * Math.PI * b); }; }
  function poisson(u, lam) { var L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; }

  function simulate(o) {
    var u = rng(o.seed), z = normal(u), n = o.n, k = o.conf, rows = [];
    for (var i = 0; i < n; i++) {
      var size = z(), tenure = -6 * (Math.log(1 - u()) + Math.log(1 - u()));
      var tickets = poisson(u, 2 + 0.8 * Math.max(size, 0));
      var lo = -0.7 + k * (0.9 * size + 0.02 * tenure - 0.15 * tickets), p = 1 / (1 + Math.exp(-lo));
      var d = u() < p ? 1 : 0;
      var y = 6.4 + k * 0.85 * size + 0.02 * tenure - 0.3 * tickets + o.effect * d + 1.4 * z();
      rows.push({size: size, tenure: tenure, tickets: tickets, d: d, y: Math.min(10, Math.max(0, y)), p: p});
    }
    return rows;
  }

  function solve(A, b) { // Gauss-Jordan; returns [x, inverse]
    var n = A.length, M = A.map(function (r, i) { return r.slice().concat(b ? [b[i]] : []).concat(r.map(function (_, j) { return i === j ? 1 : 0; })); });
    var off = b ? 1 : 0;
    for (var c = 0; c < n; c++) {
      var piv = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      var t = M[c]; M[c] = M[piv]; M[piv] = t;
      var v = M[c][c]; for (var j = 0; j < M[c].length; j++) M[c][j] /= v;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c]; if (f) for (j = 0; j < M[r].length; j++) M[r][j] -= f * M[c][j]; }
    }
    return [b ? M.map(function (r) { return r[n]; }) : null, M.map(function (r) { return r.slice(n + off); })];
  }
  function wls(X, y, w) { // returns {beta, se}; nonrobust, like statsmodels OLS/WLS
    var n = X.length, k = X[0].length, A = [], b = [], i, j, l;
    for (j = 0; j < k; j++) { A.push(new Array(k).fill(0)); b.push(0); }
    for (i = 0; i < n; i++) { var wi = w ? w[i] : 1; for (j = 0; j < k; j++) { b[j] += wi * X[i][j] * y[i]; for (l = 0; l < k; l++) A[j][l] += wi * X[i][j] * X[i][l]; } }
    var s = solve(A, b), beta = s[0], inv = s[1], ssr = 0;
    for (i = 0; i < n; i++) { var e = y[i]; for (j = 0; j < k; j++) e -= X[i][j] * beta[j]; ssr += (w ? w[i] : 1) * e * e; }
    var s2 = ssr / (n - k);
    return {beta: beta, se: inv.map(function (r, j) { return Math.sqrt(s2 * r[j]); })};
  }
  function logit(X, d) {
    var k = X[0].length, beta = new Array(k).fill(0);
    for (var it = 0; it < 50; it++) {
      var H = [], g = new Array(k).fill(0), j, l;
      for (j = 0; j < k; j++) H.push(new Array(k).fill(0));
      for (var i = 0; i < X.length; i++) {
        var eta = 0; for (j = 0; j < k; j++) eta += X[i][j] * beta[j];
        var p = 1 / (1 + Math.exp(-eta)), w = p * (1 - p);
        for (j = 0; j < k; j++) { g[j] += (d[i] - p) * X[i][j]; for (l = 0; l < k; l++) H[j][l] += w * X[i][j] * X[i][l]; }
      }
      var step = solve(H, g)[0], m = 0;
      for (j = 0; j < k; j++) { beta[j] += step[j]; m = Math.max(m, Math.abs(step[j])); }
      if (m < 1e-10) break;
    }
    return beta;
  }
  function estimate(rows, adj) {
    var y = rows.map(function (r) { return r.y; }), d = rows.map(function (r) { return r.d; });
    var t = rows.filter(function (r) { return r.d; }), c = rows.filter(function (r) { return !r.d; });
    function mv(a) { var m = a.reduce(function (s, x) { return s + x; }, 0) / a.length; var v = a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1); return [m, v]; }
    var a = mv(t.map(function (r) { return r.y; })), b = mv(c.map(function (r) { return r.y; }));
    var naive = {est: a[0] - b[0], ci: 1.96 * Math.sqrt(a[1] / t.length + b[1] / c.length)};
    var cov = function (r) { return [1].concat(adj.map(function (v) { return r[v]; })); };
    var ols = wls(rows.map(function (r) { return [r.d].concat(cov(r)); }), y);
    var reg = {est: ols.beta[0], ci: 1.96 * ols.se[0]};
    var Xc = rows.map(cov), bl = logit(Xc, d);
    var ps = Xc.map(function (x) { var e = 0; for (var j = 0; j < x.length; j++) e += x[j] * bl[j]; return Math.min(0.98, Math.max(0.02, 1 / (1 + Math.exp(-e)))); });
    var w = rows.map(function (r, i) { return r.d ? 1 / ps[i] : 1 / (1 - ps[i]); });
    var fit = wls(rows.map(function (r) { return [1, r.d]; }), y, w);
    var ipw = {est: fit.beta[1], ci: 1.96 * fit.se[1]};
    function smd(v, wt) {
      var st = 0, sc = 0, wt1 = 0, wt0 = 0, i;
      for (i = 0; i < rows.length; i++) { var ww = wt ? wt[i] : 1; if (rows[i].d) { st += ww * rows[i][v]; wt1 += ww; } else { sc += ww * rows[i][v]; wt0 += ww; } }
      var mt = st / wt1, mc = sc / wt0, vt = mv(t.map(function (r) { return r[v]; }))[1], vc = mv(c.map(function (r) { return r[v]; }))[1];
      return (mt - mc) / Math.sqrt((vt + vc) / 2);
    }
    var balance = ['size', 'tenure', 'tickets'].map(function (v) { return {v: v, raw: smd(v), weighted: smd(v, w)}; });
    return {naive: naive, reg: reg, ipw: ipw, treated: t.length, balance: balance};
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = {simulate: simulate, estimate: estimate}; return; }

  // ---- page ---------------------------------------------------------------------------------
  var root = document.getElementById('nps-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    effect: 'Efeito verdadeiro da ligação (pontos de NPS)', conf: 'Força da confusão', n: 'Contas', adj: 'Ajustar por', size: 'Porte', tenure: 'Tempo de casa', tickets: 'Chamados de suporte',
    resample: 'Nova amostra', naive: 'Comparação direta', reg: 'Ajuste por regressão', ipw: 'Ponderação pela propensão', truth: 'Efeito verdadeiro', bias: 'viés', treated: 'contas receberam a ligação',
    xTitle: 'Efeito estimado sobre o NPS (pontos), com intervalo de 95%', balTitle: 'Equilíbrio entre os grupos (diferença padronizada de médias)', before: 'Antes da ponderação', after: 'Depois da ponderação',
    balNote: 'Abaixo de 0,1 em módulo, os grupos são considerados comparáveis naquela variável.',
    note: 'Dados gerados no seu navegador pelo mesmo simulador do script, nada de cliente. Zere a força da confusão e as três estimativas coincidem; tire uma variável do ajuste e veja o viés voltar.',
    confHelp: '1 é o cenário do case: porte pesa na chance de receber a ligação e no NPS; 0 é como um sorteio.', inCI: 'o efeito verdadeiro está dentro do intervalo', outCI: 'o efeito verdadeiro está fora do intervalo'
  } : {
    effect: 'True effect of the call (NPS points)', conf: 'Strength of the confounding', n: 'Accounts', adj: 'Adjust for', size: 'Size', tenure: 'Tenure', tickets: 'Support tickets',
    resample: 'New sample', naive: 'Raw comparison', reg: 'Regression adjustment', ipw: 'Propensity weighting', truth: 'True effect', bias: 'bias', treated: 'accounts received the call',
    xTitle: 'Estimated effect on NPS (points), with 95% interval', balTitle: 'Balance between the groups (standardised mean difference)', before: 'Before weighting', after: 'After weighting',
    balNote: 'Below 0.1 in absolute value, the groups are considered comparable on that variable.',
    note: 'Data generated in your browser by the same simulator as the script, nothing from a client. Set the confounding to zero and the three estimates coincide; drop a variable from the adjustment and watch the bias come back.',
    confHelp: '1 is the case’s scenario: size drives both the chance of a call and the NPS; 0 is as good as a lottery.', inCI: 'the true effect is inside the interval', outCI: 'the true effect is outside the interval'
  };
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out, help) { var w = el('label', {class: 'nps-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); if (help) w.appendChild(el('small', {}, help)); parent.appendChild(w); return input; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'nps-card'}); c.appendChild(el('div', {class: 'nps-card-l'}, label)); var v = el('div', {class: 'nps-card-v'}); c.appendChild(v); var s = el('div', {class: 'nps-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  var C = {naive: '#64748b', reg: '#0f766e', ipw: '#0369a1', truth: '#b91c1c'};

  var ctl = el('div', {class: 'nps-ctls'}); root.appendChild(ctl);
  var eo = el('output'), sE = control(ctl, T.effect, range(0, 2, 0.05, 0.8), eo);
  var co = el('output'), sC = control(ctl, T.conf, range(0, 2, 0.1, 1), co, T.confHelp);
  var no = el('output'), sN = control(ctl, T.n, range(1000, 20000, 1000, 6000), no);
  var adjBox = el('div', {class: 'nps-ctl'}); adjBox.appendChild(el('span', {}, T.adj)); ctl.appendChild(adjBox);
  var checks = ['size', 'tenure', 'tickets'].map(function (v) { var l = el('label', {class: 'nps-check'}), c = el('input', {type: 'checkbox', value: v}); c.checked = true; l.appendChild(c); l.appendChild(document.createTextNode(' ' + T[v])); adjBox.appendChild(l); return c; });
  var btn = el('button', {type: 'button', class: 'nps-btn'}, T.resample); adjBox.appendChild(btn);
  var cards = el('div', {class: 'nps-cards'}); root.appendChild(cards);
  var cN = card(cards, T.naive), cR = card(cards, T.reg), cI = card(cards, T.ipw);
  var box = el('div', {class: 'nps-chart'}); var cv = el('canvas'); box.appendChild(cv); root.appendChild(box);
  var meta = el('p', {class: 'nps-note'}); root.appendChild(meta);
  root.appendChild(el('h4', {}, T.balTitle));
  var box2 = el('div', {class: 'nps-chart nps-chart-s'}); var cv2 = el('canvas'); box2.appendChild(cv2); root.appendChild(box2);
  root.appendChild(el('p', {class: 'nps-note'}, T.balNote + ' ' + T.note));
  var seed = 20260828;
  var tc = getComputedStyle(root).color;
  var chart = new Chart(cv, {type: 'bar', data: {labels: [T.naive, T.reg, T.ipw], datasets: []}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {legend: {display: false}, tooltip: {callbacks: {label: function (x) { return x.dataset.type === 'scatter' ? fmt(x.raw.x, 2) : fmt(x.raw[0], 2) + ' – ' + fmt(x.raw[1], 2); }}}},
    scales: {x: {title: {display: true, text: T.xTitle, color: tc}, ticks: {color: tc}, grid: {color: function (c) { return 'rgba(127,127,127,.15)'; }}}, y: {ticks: {color: tc}, grid: {display: false}}}}});
  var bal = new Chart(cv2, {type: 'bar', data: {labels: [T.size, T.tenure, T.tickets], datasets: []}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {legend: {labels: {color: tc, boxWidth: 14}}, tooltip: {callbacks: {label: function (x) { return x.dataset.label + ': ' + fmt(x.raw, 2); }}}},
    scales: {x: {ticks: {color: tc}, grid: {color: 'rgba(127,127,127,.15)'}}, y: {ticks: {color: tc}, grid: {display: false}}}}});
  var pending = null;
  function upd() {
    eo.textContent = fmt(+sE.value, 2); co.textContent = fmt(+sC.value, 1); no.textContent = fmt(+sN.value, 0);
    if (pending) clearTimeout(pending);
    pending = setTimeout(run, 60);
  }
  function run() {
    var truth = +sE.value, rows = simulate({seed: seed, n: +sN.value, conf: +sC.value, effect: truth});
    var adj = checks.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
    var r = estimate(rows, adj), keys = ['naive', 'reg', 'ipw'];
    [cN, cR, cI].forEach(function (c, i) {
      var e = r[keys[i]];
      c.v.textContent = fmt(e.est, 2) + ' ± ' + fmt(e.ci, 2);
      c.s.textContent = T.bias + ' ' + (e.est - truth >= 0 ? '+' : '') + fmt(e.est - truth, 2) + '; ' + (Math.abs(e.est - truth) <= e.ci ? T.inCI : T.outCI);
    });
    chart.data.datasets = [
      {data: keys.map(function (k) { return [r[k].est - r[k].ci, r[k].est + r[k].ci]; }), backgroundColor: keys.map(function (k) { return C[k]; }), borderRadius: 3, barPercentage: .35},
      {type: 'scatter', data: keys.map(function (k, i) { return {x: r[k].est, y: chart.data.labels[i]}; }), backgroundColor: tc, pointRadius: 5},
      {type: 'line', label: T.truth, data: [{x: truth, y: T.naive}, {x: truth, y: T.ipw}], borderColor: C.truth, borderDash: [6, 4], borderWidth: 2, pointRadius: 0}
    ];
    var lo = Math.min(truth, r.naive.est - r.naive.ci, r.reg.est - r.reg.ci, r.ipw.est - r.ipw.ci), hi = Math.max(truth, r.naive.est + r.naive.ci, r.reg.est + r.reg.ci, r.ipw.est + r.ipw.ci);
    chart.options.scales.x.min = Math.floor((lo - 0.1) * 10) / 10; chart.options.scales.x.max = Math.ceil((hi + 0.1) * 10) / 10;
    chart.update();
    meta.textContent = fmt(r.treated, 0) + ' / ' + fmt(rows.length, 0) + ' ' + T.treated + '. ' + T.truth + ': ' + fmt(truth, 2) + '.';
    bal.data.datasets = [
      {label: T.before, data: r.balance.map(function (b) { return b.raw; }), backgroundColor: C.naive, borderRadius: 3},
      {label: T.after, data: r.balance.map(function (b) { return b.weighted; }), backgroundColor: C.ipw, borderRadius: 3}];
    bal.update();
  }
  [sE, sC, sN].forEach(function (s) { s.addEventListener('input', upd); });
  checks.forEach(function (c) { c.addEventListener('change', upd); });
  btn.addEventListener('click', function () { seed += 1; upd(); });
  upd();
})();
