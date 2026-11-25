/* Demonstration app for the commodity forecasting case: the methods on public futures prices
   (Yahoo Finance), not the results of the manuscripts. Plain JavaScript + Chart.js. */
(function () {
  var root = document.getElementById('cf-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['A forma da distribuição', 'Regimes', 'Testar respeitando o tempo'],
    com: 'Commodity', corn: 'Milho', soybeans: 'Soja', wheat: 'Trigo', coffee: 'Café', sugar: 'Açúcar',
    win: 'Janela (dias úteis)', date: 'Data final da janela', hist: 'Retornos diários na janela (%)', normal: 'Normal com a mesma média e desvio',
    sd: 'Desvio-padrão diário', skew: 'Assimetria', kurt: 'Curtose em excesso', q5: 'Pior dia em 20 (quantil de 5%)', q95: 'Melhor dia em 20 (quantil de 95%)', vsN: 'a normal diria',
    rollSkew: 'Assimetria em janela móvel', rollKurt: 'Curtose em excesso em janela móvel',
    shapeNote: 'Se a distribuição fosse fixa, assimetria e curtose ficariam paradas. Elas mudam com o tempo e com o mercado, e uma normal erra justamente as caudas, que é onde está o custo de errar. É isso que motiva modelar cada parâmetro da distribuição, como no GAMLSS.',
    price: 'Preço semanal (US¢)', pHigh: 'Probabilidade do regime turbulento', calm: 'Regime calmo', turb: 'Regime turbulento', sigma: 'desvio diário', dur: 'duração média', days: 'dias', share: 'Dias no regime turbulento',
    regNote: 'Modelo de dois regimes com variância que muda de regime (Markov), ajustado com statsmodels na amostra toda; as probabilidades são as suavizadas, que usam a série inteira. É o parente mais simples do MSGARCH, que põe um GARCH dentro de cada regime.',
    p: 'Defasagens do modelo AR(p) para a volatilidade semanal', origin: 'Primeira previsão fora da amostra', rmseIn: 'Erro dentro da amostra', rmseOut: 'Erro fora da amostra (origem móvel)',
    naive: 'Ingênuo (volatilidade da semana anterior)', mean: 'Média histórica', ar: 'AR', dm: 'Diebold-Mariano contra o ingênuo', better: 'melhor que o ingênuo', worse: 'pior que o ingênuo', tie: 'sem diferença significativa',
    lags: 'Defasagens', realized: 'Volatilidade realizada (log)', fcast: 'Previsão AR um passo à frente',
    testNote: 'Alvo: o log da volatilidade realizada da semana seguinte. Dentro da amostra, mais defasagens sempre ajudam. Fora dela, com o modelo reajustado a cada semana só com o passado, o ganho logo para, e defasagens a mais podem piorar a previsão. O ingênuo e a média histórica passam pelo mesmo teste.',
    demo: 'Demonstração dos métodos em preços públicos de futuros. Não são os resultados dos artigos em revisão.', loading: 'Carregando...'
  } : {
    tabs: ['The shape of the distribution', 'Regimes', 'Testing that respects time'],
    com: 'Commodity', corn: 'Corn', soybeans: 'Soybeans', wheat: 'Wheat', coffee: 'Coffee', sugar: 'Sugar',
    win: 'Window (trading days)', date: 'Window end date', hist: 'Daily returns in the window (%)', normal: 'Normal with the same mean and spread',
    sd: 'Daily standard deviation', skew: 'Skewness', kurt: 'Excess kurtosis', q5: 'Worst day in 20 (5% quantile)', q95: 'Best day in 20 (95% quantile)', vsN: 'a normal would say',
    rollSkew: 'Skewness over a moving window', rollKurt: 'Excess kurtosis over a moving window',
    shapeNote: 'If the distribution were fixed, skewness and kurtosis would stand still. They move with time and with the market, and a normal gets the tails wrong, which is where being wrong costs money. That is what motivates modelling every parameter of the distribution, as GAMLSS does.',
    price: 'Weekly price (US¢)', pHigh: 'Probability of the turbulent regime', calm: 'Calm regime', turb: 'Turbulent regime', sigma: 'daily spread', dur: 'average duration', days: 'days', share: 'Days in the turbulent regime',
    regNote: 'Two-regime Markov model whose variance switches with the regime, fitted with statsmodels on the whole sample; the probabilities are the smoothed ones, which use the whole series. It is the simplest relative of MSGARCH, which puts a GARCH inside each regime.',
    p: 'Lags of the AR(p) model for weekly volatility', origin: 'First out-of-sample forecast', rmseIn: 'In-sample error', rmseOut: 'Out-of-sample error (rolling origin)',
    naive: 'Naive (last week’s volatility)', mean: 'Historical mean', ar: 'AR', dm: 'Diebold-Mariano against the naive', better: 'better than the naive', worse: 'worse than the naive', tie: 'no significant difference',
    lags: 'Lags', realized: 'Realised volatility (log)', fcast: 'AR forecast one step ahead',
    testNote: 'Target: the log of next week’s realised volatility. In sample, more lags always help. Out of sample, with the model refitted every week on the past only, the gain soon stops, and extra lags can make the forecast worse. The naive and the historical mean go through the same test.',
    demo: 'A demonstration of the methods on public futures prices. These are not the results of the manuscripts under review.', loading: 'Loading...'
  };
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', band: 'rgba(15,118,110,.18)'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'cf-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'cf-card'}); c.appendChild(el('div', {class: 'cf-card-l'}, label)); var v = el('div', {class: 'cf-card-v'}); c.appendChild(v); var s = el('div', {class: 'cf-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function chartBox(p, cls) { var b = el('div', {class: 'cf-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  var tc = function () { return getComputedStyle(root).color; };
  function lineOpts(yfmt, xmax) {
    var c = tc();
    return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {labels: {color: c, boxWidth: 14}}},
      scales: {x: {ticks: {color: c, maxTicksLimit: xmax || 8, maxRotation: 0}, grid: {display: false}}, y: {ticks: {color: c, callback: yfmt}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }
  function quantile(sorted, q) { var h = (sorted.length - 1) * q, i = Math.floor(h); return sorted[i] + (h - i) * ((sorted[i + 1] !== undefined ? sorted[i + 1] : sorted[i]) - sorted[i]); }
  function moments(a) {
    var n = a.length, m = 0, i; for (i = 0; i < n; i++) m += a[i]; m /= n;
    var m2 = 0, m3 = 0, m4 = 0; for (i = 0; i < n; i++) { var d = a[i] - m, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
    m2 /= n; m3 /= n; m4 /= n;
    return {mean: m, sd: Math.sqrt(m2 * n / (n - 1)), skew: m3 / Math.pow(m2, 1.5), kurt: m4 / (m2 * m2) - 3};
  }
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t; var v = M[c][c]; if (Math.abs(v) < 1e-12) return null;
      for (var j = c; j <= n; j++) M[c][j] /= v;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c]; for (j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(function (r) { return r[n]; });
  }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    root.appendChild(el('p', {class: 'cf-demo'}, T.demo));
    var top = el('div', {class: 'cf-ctls'}); root.appendChild(top);
    var sC = el('select'); Object.keys(D.series).forEach(function (c) { sC.appendChild(el('option', {value: c}, T[c] || c)); }); sC.value = 'soybeans';
    control(top, T.com, sC);
    var nav = el('div', {class: 'cf-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'cf-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    var views = [shape(panes[0].p, D), regimes(panes[1].p, D), testing(panes[2].p, D)], cur = 0;
    function show(i) { cur = i; panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); views[i](sC.value); }
    sC.addEventListener('change', function () { show(cur); });
    show(0);
  }

  function shape(p, D) {
    var n = D.dates.length, ctl = el('div', {class: 'cf-ctls'}); p.appendChild(ctl);
    var wo = el('output'), sW = control(ctl, T.win, range(60, 500, 10, 250), wo);
    var dO = el('output'), sD = control(ctl, T.date, range(500, n - 1, 1, n - 1), dO);
    var cards = el('div', {class: 'cf-cards'}); p.appendChild(cards);
    var cS = card(cards, T.sd), cK = card(cards, T.skew + ' / ' + T.kurt), c5 = card(cards, T.q5), c95 = card(cards, T.q95);
    var h = new Chart(chartBox(p), {type: 'bar', data: {labels: [], datasets: []}, options: lineOpts(function (v) { return v; }, 10)});
    h.options.scales.x.title = {display: true, text: T.hist, color: tc()};
    var rs = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: lineOpts(function (v) { return fmt(v, 1); })});
    var rk = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: lineOpts(function (v) { return fmt(v, 0); })});
    p.appendChild(el('p', {class: 'cf-note'}, T.shapeNote));
    var com = null, rollCache = {};
    function rolling(c, w) {
      var key = c + w; if (rollCache[key]) return rollCache[key];
      var r = D.series[c].r, sk = [], ku = [], lab = [];
      for (var i = w; i < r.length; i += 5) { var m = moments(r.slice(i - w, i)); sk.push(m.skew); ku.push(m.kurt); lab.push(D.dates[i - 1]); }
      return (rollCache[key] = {sk: sk, ku: ku, lab: lab});
    }
    function upd() {
      var c = com, w = +sW.value, end = +sD.value, r = D.series[c].r.slice(Math.max(0, end - w + 1), end + 1);
      wo.textContent = w; dO.textContent = D.dates[end];
      var m = moments(r), s = r.slice().sort(function (a, b) { return a - b; });
      cS.v.textContent = fmt(m.sd, 2) + '%'; cS.s.textContent = '';
      cK.v.textContent = fmt(m.skew, 2) + ' / ' + fmt(m.kurt, 2); cK.s.textContent = PT ? 'normal: 0 / 0' : 'normal: 0 / 0';
      c5.v.textContent = fmt(quantile(s, 0.05), 2) + '%'; c5.s.textContent = T.vsN + ' ' + fmt(m.mean - 1.645 * m.sd, 2) + '%';
      c95.v.textContent = fmt(quantile(s, 0.95), 2) + '%'; c95.s.textContent = T.vsN + ' ' + fmt(m.mean + 1.645 * m.sd, 2) + '%';
      var lo = Math.floor(s[0]), hi = Math.ceil(s[s.length - 1]), bw = Math.max(0.25, (hi - lo) / 40), nb = Math.ceil((hi - lo) / bw), bins = new Array(nb).fill(0), labels = [], pdf = [];
      r.forEach(function (x) { bins[Math.min(nb - 1, Math.floor((x - lo) / bw))]++; });
      for (var i = 0; i < nb; i++) { var x = lo + (i + 0.5) * bw; labels.push(fmt(x, 1)); pdf.push(r.length * bw * Math.exp(-0.5 * Math.pow((x - m.mean) / m.sd, 2)) / (m.sd * Math.sqrt(2 * Math.PI))); }
      h.data.labels = labels;
      h.data.datasets = [{label: T.hist, data: bins, backgroundColor: C.band, borderColor: C.main, borderWidth: 1, barPercentage: 1, categoryPercentage: 1},
        {type: 'line', label: T.normal, data: pdf, borderColor: C.alt, borderWidth: 2, pointRadius: 0}];
      h.update();
      var R = rolling(c, w), mark = R.lab.map(function (d) { return d <= D.dates[end] && d > D.dates[Math.max(0, end - 5)] ? 1 : 0; });
      [[rs, R.sk, T.rollSkew], [rk, R.ku, T.rollKurt]].forEach(function (z) {
        z[0].data.labels = R.lab; z[0].data.datasets = [{label: z[2], data: z[1], borderColor: C.main, borderWidth: 1.5, pointRadius: mark.map(function (k) { return k ? 5 : 0; }), pointBackgroundColor: C.alt}];
        z[0].update();
      });
    }
    var t = null; [sW, sD].forEach(function (x) { x.addEventListener('input', function () { clearTimeout(t); t = setTimeout(upd, 40); }); });
    return function (c) { com = c; upd(); };
  }

  function regimes(p, D) {
    var cards = el('div', {class: 'cf-cards'}); p.appendChild(cards);
    var cC = card(cards, T.calm), cT = card(cards, T.turb), cS = card(cards, T.share);
    var pr = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: lineOpts(function (v) { return fmt(v, 0); })});
    var o = lineOpts(function (v) { return fmt(100 * v, 0) + '%'; }); o.scales.y.min = 0; o.scales.y.max = 1;
    var ph = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: o});
    p.appendChild(el('p', {class: 'cf-note'}, T.regNote));
    return function (c) {
      var S = D.series[c], g = S.regime;
      cC.v.textContent = fmt(g.sigma[0], 2) + '%'; cC.s.textContent = T.sigma + '; ' + T.dur + ' ' + fmt(g.duration[0], 0) + ' ' + T.days;
      cT.v.textContent = fmt(g.sigma[1], 2) + '%'; cT.s.textContent = T.sigma + '; ' + T.dur + ' ' + fmt(g.duration[1], 0) + ' ' + T.days;
      cS.v.textContent = fmt(100 * g.p_high.filter(function (v) { return v > 0.5; }).length / g.p_high.length, 0) + '%'; cS.s.textContent = '';
      pr.data.labels = D.weekly_dates; pr.data.datasets = [{label: T.price, data: S.price, borderColor: C.grey, borderWidth: 1.5, pointRadius: 0}]; pr.update();
      ph.data.labels = D.dates.slice(1); ph.data.datasets = [{label: T.pHigh, data: g.p_high, borderColor: C.alt, backgroundColor: 'rgba(194,65,12,.18)', fill: true, borderWidth: 1, pointRadius: 0}]; ph.update();
    };
  }

  function testing(p, D) {
    var ctl = el('div', {class: 'cf-ctls'}); p.appendChild(ctl);
    var po = el('output'), sP = control(ctl, T.p, range(1, 12, 1, 2), po);
    var oo = el('output'), sO = control(ctl, T.origin, range(150, 400, 10, 260), oo);
    var cards = el('div', {class: 'cf-cards'}); p.appendChild(cards);
    var cA = card(cards, T.ar + ' — ' + T.rmseOut), cN = card(cards, T.naive), cM = card(cards, T.mean), cD = card(cards, T.dm);
    var o1 = lineOpts(function (v) { return fmt(v, 3); }, 12); o1.scales.x.title = {display: true, text: T.lags, color: tc()};
    var ch = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: o1});
    var fc = new Chart(chartBox(p, 'cf-chart-s'), {type: 'line', data: {labels: [], datasets: []}, options: lineOpts(function (v) { return fmt(v, 1); })});
    p.appendChild(el('p', {class: 'cf-note'}, T.testNote));
    var weekly = {};
    function weeks(c) {
      if (weekly[c]) return weekly[c];
      var r = D.series[c].r, y = [], lab = [], ss = 0, k = 0, prevDow = -1;
      D.dates.slice(1).forEach(function (d, i) {
        var dow = new Date(d + 'T12:00:00Z').getUTCDay();
        if (prevDow >= 0 && dow <= prevDow && k) { y.push(0.5 * Math.log(ss)); lab.push(d); ss = 0; k = 0; }
        ss += r[i] * r[i]; k++; prevDow = dow;
      });
      return (weekly[c] = {y: y, lab: lab});
    }
    function evaluate(y, P, start) {
      // in-sample: fit on all; out-of-sample: expanding window, refit every week (recursive X'X, X'y)
      var res = {ins: [], out: [], f: {}};
      for (var p = 1; p <= P; p++) {
        var k = p + 1, A = [], b = [], i, j, l;
        for (i = 0; i < k; i++) { A.push(new Array(k).fill(0)); b.push(0); }
        var add = function (t) { var x = [1]; for (var q = 1; q <= p; q++) x.push(y[t - q]); for (var a = 0; a < k; a++) { b[a] += x[a] * y[t]; for (var c2 = 0; c2 < k; c2++) A[a][c2] += x[a] * x[c2]; } };
        for (i = p; i < start; i++) add(i);
        var se = 0, n = 0, fs = [];
        for (var t = start; t < y.length; t++) {
          var beta = solve(A, b); var x = [1]; for (j = 1; j <= p; j++) x.push(y[t - j]);
          var f = 0; for (j = 0; j < k; j++) f += beta[j] * x[j];
          fs.push(f); se += Math.pow(y[t] - f, 2); n++; add(t);
        }
        res.out.push(Math.sqrt(se / n)); res.f[p] = fs;
        var beta2 = solve(A, b), sse = 0, m = 0;
        for (t = P; t < y.length; t++) { var x2 = [1]; for (l = 1; l <= p; l++) x2.push(y[t - l]); var f2 = 0; for (l = 0; l < k; l++) f2 += beta2[l] * x2[l]; sse += Math.pow(y[t] - f2, 2); m++; }
        res.ins.push(Math.sqrt(sse / m));
      }
      return res;
    }
    var com = null, cache = {};
    function upd() {
      var W = weeks(com), y = W.y, P = 12, start = +sO.value, p = +sP.value;
      po.textContent = p; oo.textContent = W.lab[start];
      var key = com + start, E = cache[key] || (cache[key] = evaluate(y, P, start));
      var nv = 0, mn = 0, sum = 0, n = 0, dl = [];
      for (var i = 0; i < start; i++) sum += y[i];
      for (var t = start; t < y.length; t++) {
        var mean = sum / t, eN = Math.pow(y[t] - y[t - 1], 2), eA = Math.pow(y[t] - E.f[p][t - start], 2);
        nv += eN; mn += Math.pow(y[t] - mean, 2); n++; dl.push(eA - eN); sum += y[t];
      }
      var dbar = dl.reduce(function (a, b) { return a + b; }, 0) / dl.length, v = dl.reduce(function (a, b) { return a + (b - dbar) * (b - dbar); }, 0) / (dl.length - 1);
      var dm = dbar / Math.sqrt(v / dl.length);
      cA.v.textContent = fmt(E.out[p - 1], 3); cA.s.textContent = T.rmseIn + ' ' + fmt(E.ins[p - 1], 3);
      cN.v.textContent = fmt(Math.sqrt(nv / n), 3); cN.s.textContent = 'RMSE';
      cM.v.textContent = fmt(Math.sqrt(mn / n), 3); cM.s.textContent = 'RMSE';
      cD.v.textContent = fmt(dm, 2); cD.s.textContent = dm < -1.96 ? T.better : dm > 1.96 ? T.worse : T.tie;
      ch.data.labels = E.ins.map(function (_, i) { return i + 1; });
      ch.data.datasets = [{label: T.rmseIn, data: E.ins, borderColor: C.grey, borderDash: [5, 3], borderWidth: 2, pointRadius: 2},
        {label: T.rmseOut, data: E.out, borderColor: C.main, borderWidth: 2, pointRadius: E.out.map(function (_, i) { return i === p - 1 ? 6 : 2; }), pointBackgroundColor: C.alt}];
      ch.update();
      fc.data.labels = W.lab.slice(start); fc.data.datasets = [{label: T.realized, data: y.slice(start), borderColor: C.grey, borderWidth: 1, pointRadius: 0},
        {label: T.fcast + ' (p = ' + p + ')', data: E.f[p], borderColor: C.main, borderWidth: 1.5, pointRadius: 0}];
      fc.update();
    }
    sP.addEventListener('input', upd); var t = null; sO.addEventListener('input', function () { clearTimeout(t); t = setTimeout(upd, 80); });
    return function (c) { com = c; upd(); };
  }
})();
